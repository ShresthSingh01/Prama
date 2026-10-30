import re
import os
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple
from pathlib import Path
import pypdf

# Common Bank Name Signatures
BANK_KEYWORDS = [
    ("State Bank of India", ["state bank", "sbi", "sbin"]),
    ("Canara Bank", ["canara", "cnrb"]),
    ("Punjab National Bank", ["punjab national", "pnb", "punb"]),
    ("Bank of Baroda", ["bank of baroda", "bob", "barb"]),
    ("Union Bank of India", ["union bank", "ubin"]),
    ("HDFC Bank", ["hdfc"]),
    ("ICICI Bank", ["icici"])
]

def parse_date_string(date_str: str) -> Optional[str]:
    """Normalizes DD/MM/YYYY or DD-MM-YYYY to standard ISO YYYY-MM-DD."""
    date_str = date_str.strip()
    # If already YYYY-MM-DD
    if re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
        return date_str
    
    formats = ["%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y", "%Y/%m/%d"]
    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None

def extract_from_document(file_path: str) -> Dict[str, Any]:
    """
    Extracts text and critical regulatory fields from an uploaded FDR certificate document.
    Does NOT fabricate data: returns None for any field not verifiable in the document text.
    """
    if not os.path.exists(file_path):
        return {
            "success": False,
            "error": "File not found",
            "raw_text": "",
            "engine": "none",
            "fields": {}
        }

    raw_text = ""
    page_count = 0
    pdf_meta = {}

    ext = Path(file_path).suffix.lower()

    if ext == ".pdf":
        try:
            reader = pypdf.PdfReader(file_path)
            page_count = len(reader.pages)
            for page in reader.pages:
                raw_text += (page.extract_text() or "") + "\n"
            
            if reader.metadata:
                for k, v in reader.metadata.items():
                    pdf_meta[str(k).replace("/", "")] = str(v)
        except Exception as e:
            return {
                "success": False,
                "error": f"PDF extraction failed: {str(e)}",
                "raw_text": "",
                "engine": "pypdf",
                "fields": {}
            }
    elif ext in [".png", ".jpg", ".jpeg", ".tiff", ".bmp"]:
        # If it's an image, in this environment we record image attributes
        # and indicate image file processing.
        page_count = 1
        raw_text = ""

    extracted_fields: Dict[str, Any] = {
        "fdr_number": None,
        "amount": None,
        "issue_date": None,
        "maturity_date": None,
        "interest_rate": None,
        "bank_name": None,
        "holder_name": None,
        "has_aicte_lien": False
    }
    field_confidence: Dict[str, float] = {}

    if raw_text.strip():
        text_clean = raw_text

        # 1. FDR Number extraction - Prioritize structured bank serials & filter stop words
        STOP_WORDS = {
            "CERTIFICATE", "DEPOSIT", "RECEIPT", "ADVICE", "STATEMENT", 
            "NUMBER", "CONFIRMATION", "VERIFICATION", "MEMORANDUM", 
            "ACKNOWLEDGMENT", "UNDERTAKING", "AFFIDAVIT", "FIXED", "OFFICIAL"
        }
        fdr_patterns = [
            r'\b([A-Z]{3,4}\/\d{4}\/[A-Z0-9-]+)\b',
            r'\b([A-Z]{3,4}-\d{4}-[A-Z0-9-]+)\b',
            r'\b(FDR-[A-Z0-9-]+)\b',
            r'(?:FDR\s*(?:No|Num|Number|Ref|Id|Code)|Deposit Receipt No|Receipt No|Certificate No)[\s.:#-]+([A-Z0-9\/-]{6,30})',
            r'(?:FDR|Receipt)[\s.:#-]+([A-Z0-9\/-]{6,30})'
        ]
        for pat in fdr_patterns:
            matches = re.finditer(pat, text_clean, re.IGNORECASE)
            for m in matches:
                cand = m.group(1).strip()
                # Exclude header words and require at least one numeric digit in the serial
                if cand.upper() in STOP_WORDS or not re.search(r'\d', cand):
                    continue
                extracted_fields["fdr_number"] = cand
                field_confidence["fdr_number"] = 0.95
                break
            if extracted_fields["fdr_number"]:
                break

        # 2. Deposit Amount extraction
        amt_match = re.search(r'(?:Rs\.?|INR|Amount|Principal)[\s.:]*([\d,]+(?:\.\d{2})?)', text_clean, re.IGNORECASE)
        if amt_match:
            raw_amt = amt_match.group(1).replace(',', '')
            try:
                val = float(raw_amt)
                if val >= 1000:
                    extracted_fields["amount"] = val
                    field_confidence["amount"] = 0.95
            except ValueError:
                pass

        # 3. Dates: look specifically for Issue and Maturity contexts
        issue_match = re.search(r'(?:Issue|Value|Deposit)\s*Date[\s.:]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}-\d{2}-\d{2})', text_clean, re.IGNORECASE)
        if issue_match:
            parsed = parse_date_string(issue_match.group(1))
            if parsed:
                extracted_fields["issue_date"] = parsed
                field_confidence["issue_date"] = 0.92

        mat_match = re.search(r'(?:Maturity|Expiry|Due)\s*Date[\s.:]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}-\d{2}-\d{2})', text_clean, re.IGNORECASE)
        if mat_match:
            parsed = parse_date_string(mat_match.group(1))
            if parsed:
                extracted_fields["maturity_date"] = parsed
                field_confidence["maturity_date"] = 0.92

        # Fallback date search if context headers not matched
        if not extracted_fields["issue_date"] or not extracted_fields["maturity_date"]:
            all_dates = re.findall(r'\b(\d{4}-\d{2}-\d{2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})\b', text_clean)
            parsed_dates = [parse_date_string(d) for d in all_dates if parse_date_string(d)]
            parsed_dates = sorted(list(set(parsed_dates)))
            if len(parsed_dates) >= 2:
                if not extracted_fields["issue_date"]:
                    extracted_fields["issue_date"] = parsed_dates[0]
                    field_confidence["issue_date"] = 0.75
                if not extracted_fields["maturity_date"]:
                    extracted_fields["maturity_date"] = parsed_dates[-1]
                    field_confidence["maturity_date"] = 0.75

        # 4. Interest Rate
        rate_match = re.search(r'(\d{1,2}(?:\.\d{1,2})?)\s*%\s*(?:p\.?a\.?|per annum)?', text_clean, re.IGNORECASE)
        if rate_match:
            try:
                rate_val = float(rate_match.group(1))
                if 1.0 <= rate_val <= 25.0:
                    extracted_fields["interest_rate"] = rate_val
                    field_confidence["interest_rate"] = 0.90
            except ValueError:
                pass

        # 5. Bank Name Recognition
        lower_text = text_clean.lower()
        for b_name, aliases in BANK_KEYWORDS:
            if any(alias in lower_text for alias in aliases):
                extracted_fields["bank_name"] = b_name
                field_confidence["bank_name"] = 0.90
                break

        # 6. AICTE Joint Pledge / Statutory Lien clause detection
        if "aicte" in lower_text and ("joint" in lower_text or "pledge" in lower_text or "lien" in lower_text or "member secretary" in lower_text):
            extracted_fields["has_aicte_lien"] = True
            extracted_fields["lien_clause"] = True
            field_confidence["has_aicte_lien"] = 0.98

    is_success = bool(raw_text.strip() and (extracted_fields["fdr_number"] or extracted_fields["amount"]))

    return {
        "success": is_success,
        "engine": "pypdf+regex_v2",
        "page_count": page_count,
        "char_count": len(raw_text),
        "raw_text": raw_text[:3000],
        "fields": extracted_fields,
        "field_confidence": field_confidence,
        "pdf_metadata": pdf_meta
    }
