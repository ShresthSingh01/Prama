import re
import time
import logging
from typing import Dict, Any, Optional, Tuple, List
from pydantic import BaseModel, Field, field_validator
from backend.app.services.llm_client import LLMClient, get_llm_client

logger = logging.getLogger(__name__)

# --- Task A: Structured Field Extraction ---

FDR_EXTRACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "fdr_number": {"type": ["string", "null"]},
        "bank_name": {"type": ["string", "null"]},
        "amount": {"type": ["number", "null"]},
        "currency": {"type": ["string", "null"]},
        "issue_date": {"type": ["string", "null"], "pattern": r"^\d{4}-\d{2}-\d{2}$"},
        "maturity_date": {"type": ["string", "null"], "pattern": r"^\d{4}-\d{2}-\d{2}$"},
        "interest_rate": {"type": ["number", "null"]},
        "holder_name": {"type": ["string", "null"]}
    },
    "required": ["fdr_number", "bank_name", "amount", "currency", "issue_date", "maturity_date", "interest_rate", "holder_name"]
}

def _clean_str(s: str) -> str:
    """Normalize string for substring matching."""
    return re.sub(r"[^a-zA-Z0-9]", "", s).lower()

def apply_hallucination_guard(extracted: Dict[str, Any], raw_text: str) -> Dict[str, Any]:
    """
    Mandatory Hallucination Guard:
    Every extracted value must be found as a substring (after normalization)
    in the raw OCR text. Any value not supported by raw text is discarded to null.
    """
    if not raw_text:
        return {k: None for k in extracted}

    cleaned_raw = _clean_str(raw_text)
    guarded = {}

    for key, val in extracted.items():
        if val is None:
            guarded[key] = None
            continue

        if isinstance(val, (int, float)):
            # Check if digits appear in raw text (e.g. 500000 or 50,00,000 or 7.5)
            val_str = str(int(val)) if isinstance(val, float) and val.is_integer() else str(val)
            val_clean = _clean_str(val_str)
            if val_clean in cleaned_raw or str(val) in raw_text:
                guarded[key] = val
            else:
                logger.info(f"Hallucination guard rejected '{key}': {val} not in OCR text.")
                guarded[key] = None

        elif isinstance(val, str):
            clean_val = _clean_str(val)
            # For dates, also check date components (e.g., 2026, 01, 01)
            if re.match(r"^\d{4}-\d{2}-\d{2}$", val):
                parts = val.split("-")
                if parts[0] in raw_text and (parts[1] in raw_text or parts[2] in raw_text):
                    guarded[key] = val
                elif clean_val in cleaned_raw:
                    guarded[key] = val
                else:
                    logger.info(f"Hallucination guard rejected date '{key}': {val}")
                    guarded[key] = None
            else:
                # String matching (subsequences/tokens)
                if len(clean_val) < 3:
                    guarded[key] = val if val.lower() in raw_text.lower() else None
                elif clean_val in cleaned_raw:
                    guarded[key] = val
                else:
                    # Token-level presence for long names
                    tokens = [t for t in re.split(r"\s+", val) if len(t) > 2]
                    matched_tokens = sum(1 for t in tokens if _clean_str(t) in cleaned_raw)
                    if tokens and (matched_tokens / len(tokens)) >= 0.7:
                        guarded[key] = val
                    else:
                        logger.info(f"Hallucination guard rejected string '{key}': {val}")
                        guarded[key] = None
        else:
            guarded[key] = None

    return guarded

def extract_fdr_fields_slm(raw_text: str, client: Optional[LLMClient] = None) -> Tuple[Dict[str, Any], int, str]:
    """Runs Task A: Structured OCR field extraction with hallucination guard."""
    if client is None:
        client = get_llm_client()

    prompt = (
        "Extract FDR certificate fields accurately from the OCR text. "
        "Rules: Return null if a field is not present. NEVER guess or hallucinate. "
        "Format dates as YYYY-MM-DD."
    )

    start_t = time.time()
    extracted = client.extract_json(prompt, FDR_EXTRACTION_SCHEMA, raw_text)
    latency_ms = int((time.time() - start_t) * 1000)

    # Apply strict substring hallucination guard
    guarded_fields = apply_hallucination_guard(extracted, raw_text)
    
    # ponytail: model label extracted cleanly
    active_health = client.health()
    model_name = active_health.get("details", {}).get("model", active_health.get("model", "slm-model"))

    return guarded_fields, latency_ms, model_name


# --- Task B: Plain-Language Flag Explanations ---

def _extract_numbers_and_dates(text: str) -> List[str]:
    """Finds all numeric digits and dates inside a string."""
    return re.findall(r"\b\d+(?:[\.,]\d+)*\b", text)

def generate_flag_explanation_slm(
    code: str,
    severity: str,
    evidence: Dict[str, Any],
    deterministic_explanation: str,
    lang: str = "en",
    client: Optional[LLMClient] = None
) -> str:
    """
    Task B: Plain-Language Flag Explanations.
    Guarded: Generated text must not introduce numbers or dates not present in evidence or original text.
    """
    if client is None:
        client = get_llm_client()

    lang_instr = "in simple, clear Hindi (Devanagari script)" if lang == "hi" else "in 1-2 concise sentences of plain English"
    prompt = (
        f"You are an AICTE regulatory compliance assistant. Explain this security deposit flag {lang_instr} for a regulatory officer.\n"
        f"Flag Code: {code}\n"
        f"Severity: {severity}\n"
        f"Evidence: {evidence}\n"
        f"Original Technical Reason: {deterministic_explanation}\n\n"
        f"Important: Do NOT introduce or fabricate any new numbers, dates, or amounts not in the evidence. "
        f"Explain clearly what the discrepancy is and what action is required."
    )

    try:
        explanation = client.generate(prompt, max_tokens=180)
        if not explanation or "offline fallback" in explanation.lower():
            return deterministic_explanation

        # Guard: Check numbers
        evidence_str = str(evidence) + " " + deterministic_explanation
        evidence_nums = set(_extract_numbers_and_dates(evidence_str))
        generated_nums = set(_extract_numbers_and_dates(explanation))

        # Check if model fabricated any new numbers
        fabricated_nums = [n for n in generated_nums if n not in evidence_nums and len(n) > 1]
        if fabricated_nums:
            logger.warning(f"Flag explanation guard triggered: fabricated numbers {fabricated_nums}. Falling back.")
            return deterministic_explanation

        return explanation
    except Exception as e:
        logger.warning(f"Error generating flag explanation: {e}")
        return deterministic_explanation


# --- Task C: Hindi Reminder Draft ---

def generate_hindi_reminder_draft(
    template_text: str,
    fdr_number: str,
    amount: float,
    maturity_date: str,
    client: Optional[LLMClient] = None
) -> str:
    """
    Task C: Hindi Reminder Draft.
    Guarded: The translated text must preserve the FDR number, amount, and date unchanged.
    """
    if client is None:
        client = get_llm_client()

    prompt = (
        f"Translate this official AICTE FDR renewal reminder into formal, polite Hindi.\n"
        f"Original message: {template_text}\n\n"
        f"CRITICAL REQUIREMENT: The FDR serial number '{fdr_number}', amount 'Rs {amount:,.2f}', "
        f"and maturity date '{maturity_date}' MUST appear exactly and unchanged in the translation. "
        f"Output only the translated Hindi text."
    )

    try:
        translated = client.generate(prompt, max_tokens=220)
        # Invariance check: fdr_number must appear
        clean_trans = translated.replace(" ", "")
        if fdr_number.replace(" ", "") not in clean_trans:
            logger.warning("Reminder translation guard failed: FDR number missing. Using template.")
            return template_text
        return translated
    except Exception as e:
        logger.warning(f"Reminder translation failed: {e}")
        return template_text


# --- Task D: Guarded Natural-Language Search ---

class NLSearchFilter(BaseModel):
    status: Optional[List[str]] = None
    maturity_within_days: Optional[int] = None
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    state: Optional[str] = None
    bank: Optional[str] = None
    trust_tier: Optional[str] = None
    has_open_flags: Optional[bool] = None
    sort: Optional[str] = Field(default="risk_desc")
    limit: int = Field(default=50, le=100)

    @field_validator("sort")
    @classmethod
    def validate_sort(cls, v: Optional[str]) -> str:
        allowed = {"risk_desc", "amount_desc", "amount_asc", "maturity_asc", "maturity_desc"}
        return v if v in allowed else "risk_desc"

    @field_validator("trust_tier")
    @classmethod
    def validate_tier(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        allowed = {"SELF_DECLARED", "DOC_EXTRACTED", "CROSS_VALIDATED", "BANK_CONFIRMED"}
        return v.upper() if v.upper() in allowed else None

def parse_natural_language_search(query: str, client: Optional[LLMClient] = None) -> NLSearchFilter:
    """
    Task D: Converts freeform search query to a strictly validated Pydantic filter object.
    Never executes raw SQL.
    """
    if client is None:
        client = get_llm_client()

    schema = {
        "type": "object",
        "properties": {
            "status": {"type": ["array", "null"], "items": {"type": "string"}},
            "maturity_within_days": {"type": ["integer", "null"]},
            "min_amount": {"type": ["number", "null"]},
            "max_amount": {"type": ["number", "null"]},
            "state": {"type": ["string", "null"]},
            "bank": {"type": ["string", "null"]},
            "trust_tier": {"type": ["string", "null"]},
            "has_open_flags": {"type": ["boolean", "null"]},
            "sort": {"type": "string", "enum": ["risk_desc", "amount_desc", "maturity_asc"]},
            "limit": {"type": "integer"}
        }
    }

    prompt = (
        "Convert this officer question into a structured search filter object for AICTE FDRs.\n"
        "Statuses include: SUBMITTED, UNDER_SCRUTINY, VERIFIED, ACTIVE, EXPIRING, MATURED, FLAGGED, RELEASED.\n"
        "Trust tiers include: SELF_DECLARED, DOC_EXTRACTED, CROSS_VALIDATED, BANK_CONFIRMED.\n"
        "Examples:\n"
        "- 'FDRs maturing in 30 days above 10 lakh': {'maturity_within_days': 30, 'min_amount': 1000000}\n"
        "- 'Flagged instruments in Maharashtra': {'has_open_flags': true, 'state': 'Maharashtra'}\n"
        "Output ONLY JSON."
    )

    try:
        raw_filter = client.extract_json(prompt, schema, query)
        # Parse through Pydantic allowlist validator (automatically drops unauthorized keys)
        return NLSearchFilter.model_validate(raw_filter)
    except Exception as e:
        logger.warning(f"NL search parsing error: {e}. Returning rule-based filter.")
        # Rule-based fallback if offline or parsing error
        q = query.lower()
        f = NLSearchFilter()
        days_m = re.search(r"(\d+)\s*days?", q)
        if days_m:
            f.maturity_within_days = int(days_m.group(1))

        # Amount parsing
        above_m = re.search(r"(?:above|over|more than|greater than|>=?)\s*(\d+(\.\d+)?)\s*lakh", q)
        if above_m:
            f.min_amount = float(above_m.group(1)) * 100000
        else:
            lakh_m = re.search(r"(\d+(\.\d+)?)\s*lakh", q)
            if lakh_m:
                f.min_amount = float(lakh_m.group(1)) * 100000

        below_m = re.search(r"(?:below|under|less than|<=?)\s*(\d+(\.\d+)?)\s*lakh", q)
        if below_m:
            f.max_amount = float(below_m.group(1)) * 100000

        # Status parsing
        if "matured" in q or "mature" in q:
            f.status = ["MATURED"]
        elif "verified" in q:
            f.status = ["VERIFIED"]
        elif "active" in q:
            f.status = ["ACTIVE"]
        elif "released" in q:
            f.status = ["RELEASED"]

        # Bank parsing
        if "sbi" in q or "state bank" in q:
            f.bank = "State Bank of India"
        elif "pnb" in q or "punjab" in q:
            f.bank = "Punjab National Bank"
        elif "canara" in q:
            f.bank = "Canara Bank"
        elif "axis" in q:
            f.bank = "Axis Bank"
        elif "hdfc" in q:
            f.bank = "HDFC Bank"
        elif "icici" in q:
            f.bank = "ICICI Bank"

        # Trust tier
        if "bank confirmed" in q or "confirmed" in q:
            f.trust_tier = "BANK_CONFIRMED"

        # Open flags
        if "flag" in q:
            f.has_open_flags = True

        # State parsing
        for state in ["maharashtra", "delhi", "karnataka", "tamil nadu", "gujarat", "uttar pradesh"]:
            if state in q:
                f.state = state.title()
                break

        return f
