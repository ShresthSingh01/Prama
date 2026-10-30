from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload, selectinload
from backend.app.models.database import get_db
from backend.app.models.entities import Instrument, Flag, Document, OcrResult, Institution, Bank, User
from backend.app.services.llm_client import get_llm_client
from backend.app.services.slm_tasks import (
    extract_fdr_fields_slm,
    generate_flag_explanation_slm,
    parse_natural_language_search,
    NLSearchFilter
)
from backend.app.services.audit_service import log_audit_entry
from backend.app.services.clock_service import get_simulated_now
from backend.app.api.auth import get_optional_user

router = APIRouter(tags=["SLM & Intelligence Services"])

@router.get("/slm/health")
def get_slm_health():
    """Returns active LLM/SLM provider health, model name, and configuration."""
    client = get_llm_client()
    return client.health()

@router.post("/instruments/{id}/extract-slm")
def rerun_slm_extraction(id: int, db: Session = Depends(get_db), user: Optional[User] = Depends(get_optional_user)):
    """Re-runs SLM extraction on document OCR text and updates ocr_results.slm_fields."""
    inst = db.query(Instrument).filter(Instrument.id == id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Instrument not found")

    doc = db.query(Document).filter(Document.instrument_id == id).first()
    if not doc:
        raise HTTPException(status_code=400, detail="No document associated with instrument")

    ocr = db.query(OcrResult).filter(OcrResult.document_id == doc.id).first()
    raw_text = ocr.raw_text if ocr and ocr.raw_text else f"FDR Number: {inst.fdr_number}\nAmount: {inst.amount}\nMaturity: {inst.maturity_date}"

    guarded_fields, latency_ms, model_name = extract_fdr_fields_slm(raw_text)

    if not ocr:
        ocr = OcrResult(document_id=doc.id, raw_text=raw_text, engine="SLM-Assisted")
        db.add(ocr)

    ocr.slm_fields = guarded_fields
    ocr.slm_model = model_name
    ocr.slm_latency_ms = latency_ms

    # Audit the SLM extraction event
    log_audit_entry(
        db,
        action="SLM_EXTRACTION_COMPLETED",
        entity_type="instrument",
        entity_id=inst.id,
        payload={"model": model_name, "latency_ms": latency_ms, "fields_extracted": list(guarded_fields.keys())},
        actor_id=user.id if user else None,
        actor_role=user.role if user else "system"
    )

    db.commit()
    db.refresh(ocr)

    return {
        "instrument_id": inst.id,
        "slm_model": model_name,
        "latency_ms": latency_ms,
        "extracted_fields": guarded_fields
    }

@router.post("/flags/{id}/explain")
def explain_flag(
    id: int,
    lang: str = Query("en", pattern="^(en|hi)$"),
    db: Session = Depends(get_db)
):
    """
    Task B: Plain-language flag explanation (English or Hindi).
    Guarded against hallucinated numbers or dates.
    """
    flag = db.query(Flag).filter(Flag.id == id).first()
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")

    explanation = generate_flag_explanation_slm(
        code=flag.code,
        severity=flag.severity,
        evidence=flag.evidence or {},
        deterministic_explanation=flag.explanation,
        lang=lang
    )

    # Cache explanation in flag record
    if lang == "hi":
        flag.explanation_text_hi = explanation
    else:
        flag.explanation_text = explanation
    db.commit()

    return {
        "flag_id": flag.id,
        "code": flag.code,
        "severity": flag.severity,
        "lang": lang,
        "deterministic_explanation": flag.explanation,
        "ai_explanation": explanation
    }

@router.post("/search/nl")
def search_instruments_natural_language(
    query_payload: Dict[str, str],
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user)
):
    """
    Task D: Guarded natural-language search.
    Converts question to validated Pydantic filter object and executes with RBAC.
    """
    raw_query = query_payload.get("query", "")
    if not raw_query:
        return {"query": "", "filter": {}, "results": []}

    parsed_filter: NLSearchFilter = parse_natural_language_search(raw_query)

    # Build DB query
    query = db.query(Instrument).join(Institution).outerjoin(Bank)

    # RBAC isolation: institution admins see only their own instruments
    if user and user.role == "institution_admin" and user.institution_id:
        query = query.filter(Instrument.institution_id == user.institution_id)

    if parsed_filter.status:
        query = query.filter(Instrument.status.in_(parsed_filter.status))
    if parsed_filter.min_amount is not None:
        query = query.filter(Instrument.amount >= parsed_filter.min_amount)
    if parsed_filter.max_amount is not None:
        query = query.filter(Instrument.amount <= parsed_filter.max_amount)
    if parsed_filter.state:
        query = query.filter(Institution.state.ilike(f"%{parsed_filter.state}%"))
    if parsed_filter.bank:
        query = query.filter(Bank.name.ilike(f"%{parsed_filter.bank}%"))
    if parsed_filter.trust_tier:
        query = query.filter(Instrument.trust_tier == parsed_filter.trust_tier)

    # Days to maturity filter
    simulated_now = get_simulated_now(db)
    if parsed_filter.maturity_within_days is not None:
        # Filter instruments where maturity_date <= now + days
        target_date = (simulated_now.date() + timedelta(days=parsed_filter.maturity_within_days)).strftime("%Y-%m-%d")
        query = query.filter(Instrument.maturity_date <= target_date, Instrument.maturity_date >= simulated_now.strftime("%Y-%m-%d"))

    # Sorting
    if parsed_filter.sort == "amount_desc":
        query = query.order_by(Instrument.amount.desc())
    elif parsed_filter.sort == "maturity_asc":
        query = query.order_by(Instrument.maturity_date.asc())
    else:
        query = query.order_by(Instrument.risk_score.desc())

    instruments = query.options(
        joinedload(Instrument.institution),
        joinedload(Instrument.bank),
        selectinload(Instrument.flags)
    ).limit(parsed_filter.limit).all()

    # Filter has_open_flags in memory if specified
    if parsed_filter.has_open_flags is not None:
        if parsed_filter.has_open_flags:
            instruments = [i for i in instruments if any(f.status == "open" for f in i.flags)]
        else:
            instruments = [i for i in instruments if not any(f.status == "open" for f in i.flags)]

    results = []
    for inst in instruments:
        days_to_mat = 0
        try:
            mat = datetime.strptime(inst.maturity_date, "%Y-%m-%d")
            days_to_mat = (mat.date() - simulated_now.date()).days
        except Exception:
            pass
        results.append({
            "id": inst.id,
            "institution_id": inst.institution_id,
            "institution_name": inst.institution.name if inst.institution else "",
            "bank_id": inst.bank_id,
            "bank_name": inst.bank.name if inst.bank else "",
            "fdr_number": inst.fdr_number,
            "amount": inst.amount,
            "issue_date": inst.issue_date,
            "maturity_date": inst.maturity_date,
            "tenure_days": inst.tenure_days,
            "interest_rate": inst.interest_rate,
            "status": inst.status,
            "trust_tier": inst.trust_tier,
            "risk_score": inst.risk_score,
            "risk_band": inst.risk_band,
            "days_to_maturity": days_to_mat,
            "lien_marked": bool(inst.lien_marked) if inst.lien_marked is not None else False,
            "joint_holding_confirmed": bool(inst.joint_holding_confirmed) if inst.joint_holding_confirmed is not None else False,
            "flags_count": len([f for f in inst.flags if f.status == "open"])
        })

    return {
        "query": raw_query,
        "filter": parsed_filter.model_dump(exclude_none=True),
        "total_matches": len(results),
        "results": results
    }
