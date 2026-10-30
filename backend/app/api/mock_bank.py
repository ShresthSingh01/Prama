import json
import random
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from backend.app.models.database import get_db
from backend.app.models.entities import Bank
from backend.app.services.qr_service import generate_bank_signed_qr

router = APIRouter(prefix="/mock-bank", tags=["Mock Bank Gateway"])

SAMPLE_CASES: List[Dict[str, Any]] = [
    {
        "id": "genuine_10yr",
        "title": "Case 1: Standard 10-Yr Genuine SBI Deposit",
        "subtitle": "Fully compliant institutional deposit with valid Ed25519 bank signature",
        "badge": "Genuine Compliant",
        "badge_color": "emerald",
        "bank_id": 1,
        "amount": 1500000.0,
        "issue_date": "2026-01-15",
        "maturity_date": "2036-01-15",
        "tenure_days": 3652,
        "interest_rate": 7.25,
        "purpose": "Mandatory Institutional Security Deposit pledged jointly to AICTE",
        "holder_name": "National Institute of Technology, Pune",
        "institution_id": 1,
        "is_tampered": False,
        "rule_tested": "All AICTE Rules R01–R09 Pass; Bank Verification succeeds"
    },
    {
        "id": "tampered_amount",
        "title": "Case 2: Malicious Amount Forgery (10x Tampered)",
        "subtitle": "Submitted as Rs 50 Lakhs, but original bank receipt was issued for Rs 5 Lakhs",
        "badge": "Tamper Test (Fraud)",
        "badge_color": "rose",
        "bank_id": 1,
        "amount": 5000000.0,
        "issue_date": "2026-01-15",
        "maturity_date": "2036-01-15",
        "tenure_days": 3652,
        "interest_rate": 7.25,
        "purpose": "Mandatory Institutional Security Deposit pledged jointly to AICTE",
        "holder_name": "Apex College of Engineering, Bengaluru",
        "institution_id": 2,
        "is_tampered": True,
        "original_signed_amount": 500000.0,
        "rule_tested": "Triggers 10x Amount Discrepancy & Offline Cryptographic Signature Mismatch"
    },
    {
        "id": "tenure_anomaly",
        "title": "Case 3: Premature Maturity (3-Year Tenure Anomaly)",
        "subtitle": "Form declares 10-year term, but attached bank receipt matures in 3 years",
        "badge": "Rule R02 Warning",
        "badge_color": "amber",
        "bank_id": 2,
        "amount": 1500000.0,
        "issue_date": "2026-01-15",
        "maturity_date": "2029-01-15",
        "tenure_days": 3652,
        "interest_rate": 6.85,
        "purpose": "Institutional Deposit pledged jointly to AICTE",
        "holder_name": "Bharati Polytechnic, Chennai",
        "institution_id": 3,
        "is_tampered": False,
        "rule_tested": "Triggers AICTE Rule R02 tenure mismatch (Form: 3,652 days vs Receipt: 1,096 days)"
    },
    {
        "id": "sub_minimum",
        "title": "Case 4: Below Statutory Minimum Security Cover",
        "subtitle": "Institutional deposit of only Rs 2.5 Lakhs (Statutory floor is Rs 5.0L+)",
        "badge": "Rule R03 Warning",
        "badge_color": "amber",
        "bank_id": 3,
        "amount": 250000.0,
        "issue_date": "2026-01-15",
        "maturity_date": "2036-01-15",
        "tenure_days": 3652,
        "interest_rate": 7.10,
        "purpose": "Mandatory Institutional Security Deposit pledged jointly to AICTE",
        "holder_name": "St. Xavier's Institute of Tech, Mumbai",
        "institution_id": 4,
        "is_tampered": False,
        "rule_tested": "Triggers AICTE Rule R03 minimum cover shortfall (< Rs 5 Lakhs floor)"
    }
]


@router.get("/banks")
def list_banks(db: Session = Depends(get_db)):
    banks = db.query(Bank).all()
    return [
        {
            "id": b.id,
            "name": b.name,
            "ifsc": b.ifsc_prefix,
            "regex": b.fdr_number_regex,
            "public_key": b.public_key
        } for b in banks
    ]


@router.get("/sample-cases")
def list_sample_cases():
    """Returns curated demo scenarios for live presentation to evaluators."""
    return SAMPLE_CASES


def _execute_issue_sample_fdr(
    bank_id: Optional[int],
    fdr_number: Optional[str],
    amount: Optional[float],
    maturity_date: Optional[str],
    holder_name: Optional[str],
    issue_date: str,
    tenure_days: Optional[int],
    interest_rate: Optional[float],
    purpose: Optional[str],
    case: Optional[str],
    db: Session
):
    # If a specific scenario is selected, initialize defaults from it
    case_preset = None
    if case:
        case_preset = next((c for c in SAMPLE_CASES if c["id"] == case), None)
        if case_preset and case_preset.get("is_tampered"):
            return _execute_issue_tampered_sample_fdr(
                bank_id=bank_id or case_preset["bank_id"],
                fdr_number=fdr_number,
                amount=amount or case_preset["amount"],
                maturity_date=maturity_date or case_preset["maturity_date"],
                holder_name=holder_name or case_preset["holder_name"],
                issue_date=issue_date or case_preset["issue_date"],
                tenure_days=tenure_days or case_preset["tenure_days"],
                interest_rate=interest_rate or case_preset["interest_rate"],
                purpose=purpose or case_preset["purpose"],
                db=db
            )

    # Resolve bank
    bank = None
    target_bank_id = bank_id or (case_preset["bank_id"] if case_preset else 1)
    if target_bank_id:
        bank = db.query(Bank).filter(Bank.id == target_bank_id).first()
    if not bank:
        bank = db.query(Bank).first()
    if not bank or not bank.private_key:
        raise HTTPException(status_code=404, detail="Bank not found or private key unavailable")

    resolved_fdr_number = fdr_number.strip() if fdr_number else f"{bank.ifsc_prefix}/2026/{random.randint(100000, 999999)}"
    resolved_amount = amount if amount is not None else (case_preset["amount"] if case_preset else 1500000.0)
    resolved_issue_date = issue_date or (case_preset["issue_date"] if case_preset else "2026-01-15")
    resolved_maturity = maturity_date or (case_preset["maturity_date"] if case_preset else "2036-01-15")
    resolved_holder = holder_name or (case_preset["holder_name"] if case_preset else "National Institute of Technology, Pune")
    resolved_tenure = tenure_days or (case_preset["tenure_days"] if case_preset else 3652)
    resolved_rate = interest_rate if interest_rate is not None else (case_preset["interest_rate"] if case_preset else 7.25)
    resolved_purpose = purpose or (case_preset["purpose"] if case_preset else "Mandatory Institutional Security Deposit pledged jointly to AICTE")
    institution_id = case_preset["institution_id"] if case_preset else 1

    res = generate_bank_signed_qr(
        bank_private_key_hex=bank.private_key,
        bank_ifsc=bank.ifsc_prefix,
        fdr_number=resolved_fdr_number,
        amount=resolved_amount,
        issue_date=resolved_issue_date,
        maturity_date=resolved_maturity,
        holder_name=resolved_holder
    )

    return {
        "success": True,
        "bank_id": bank.id,
        "bank_name": bank.name,
        "bank_ifsc": bank.ifsc_prefix,
        "institution_id": institution_id,
        "fdr_number": resolved_fdr_number,
        "amount": resolved_amount,
        "issue_date": resolved_issue_date,
        "maturity_date": resolved_maturity,
        "tenure_days": resolved_tenure,
        "interest_rate": resolved_rate,
        "purpose": resolved_purpose,
        "holder_name": resolved_holder,
        "qr_envelope": res["envelope"],
        "envelope_json": res["envelope_json"],
        "signature": res["signature"]
    }


def _execute_issue_tampered_sample_fdr(
    bank_id: Optional[int],
    fdr_number: Optional[str],
    amount: Optional[float],
    maturity_date: Optional[str],
    holder_name: Optional[str],
    issue_date: str,
    tenure_days: Optional[int],
    interest_rate: Optional[float],
    purpose: Optional[str],
    db: Session
):
    bank = None
    target_bank_id = bank_id or 1
    if target_bank_id:
        bank = db.query(Bank).filter(Bank.id == target_bank_id).first()
    if not bank:
        bank = db.query(Bank).first()
    if not bank or not bank.private_key:
        raise HTTPException(status_code=404, detail="Bank not found or private key unavailable")

    resolved_fdr_number = fdr_number.strip() if fdr_number else f"{bank.ifsc_prefix}/2026/{random.randint(100000, 999999)}"
    # Claimed amount on submission (tampered to 50 Lakhs if default)
    claimed_amount = amount if amount is not None else 5000000.0
    original_signed_amount = 500000.0 if claimed_amount != 500000.0 else 50000.0

    resolved_issue_date = issue_date or "2026-01-15"
    resolved_maturity = maturity_date or "2036-01-15"
    resolved_holder = holder_name or "Apex College of Engineering, Bengaluru"
    resolved_tenure = tenure_days or 3652
    resolved_rate = interest_rate if interest_rate is not None else 7.25
    resolved_purpose = purpose or "Mandatory Institutional Security Deposit pledged jointly to AICTE"

    # Genuine signature created for lower amount
    res = generate_bank_signed_qr(
        bank_private_key_hex=bank.private_key,
        bank_ifsc=bank.ifsc_prefix,
        fdr_number=resolved_fdr_number,
        amount=original_signed_amount,
        issue_date=resolved_issue_date,
        maturity_date=resolved_maturity,
        holder_name=resolved_holder
    )

    # Maliciously modify amount in payload without re-signing
    tampered_envelope = res["envelope"].copy()
    tampered_envelope["payload"] = tampered_envelope["payload"].copy()
    tampered_envelope["payload"]["amt"] = claimed_amount

    tampered_envelope_json = json.dumps(tampered_envelope, separators=(',', ':'))

    return {
        "success": True,
        "bank_id": bank.id,
        "bank_name": bank.name,
        "bank_ifsc": bank.ifsc_prefix,
        "institution_id": 2,
        "fdr_number": resolved_fdr_number,
        "amount": claimed_amount,
        "issue_date": resolved_issue_date,
        "maturity_date": resolved_maturity,
        "tenure_days": resolved_tenure,
        "interest_rate": resolved_rate,
        "purpose": resolved_purpose,
        "holder_name": resolved_holder,
        "qr_envelope": tampered_envelope,
        "envelope_json": tampered_envelope_json,
        "signature": res["signature"],
        "tampered_envelope": tampered_envelope,
        "tampered_envelope_json": tampered_envelope_json,
        "original_signed_amount": original_signed_amount,
        "tampered_claimed_amount": claimed_amount,
        "note": "Amount in payload changed after signing. Offline signature verification will fail instantly."
    }


# Dual routing handlers supporting both hyphens and underscores, GET and POST

@router.get("/issue-sample-fdr")
@router.post("/issue-sample-fdr")
@router.get("/issue_sample_fdr")
@router.post("/issue_sample_fdr")
def issue_sample_fdr(
    bank_id: Optional[int] = Query(None),
    fdr_number: Optional[str] = Query(None),
    amount: Optional[float] = Query(None),
    maturity_date: Optional[str] = Query(None),
    holder_name: Optional[str] = Query(None),
    issue_date: str = Query("2026-01-15"),
    tenure_days: Optional[int] = Query(None),
    interest_rate: Optional[float] = Query(None),
    purpose: Optional[str] = Query(None),
    case: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    return _execute_issue_sample_fdr(
        bank_id=bank_id,
        fdr_number=fdr_number,
        amount=amount,
        maturity_date=maturity_date,
        holder_name=holder_name,
        issue_date=issue_date,
        tenure_days=tenure_days,
        interest_rate=interest_rate,
        purpose=purpose,
        case=case,
        db=db
    )


@router.get("/issue-tampered-sample-fdr")
@router.post("/issue-tampered-sample-fdr")
@router.get("/issue_tampered_sample_fdr")
@router.post("/issue_tampered_sample_fdr")
def issue_tampered_sample_fdr(
    bank_id: Optional[int] = Query(None),
    fdr_number: Optional[str] = Query(None),
    amount: Optional[float] = Query(None),
    maturity_date: Optional[str] = Query(None),
    holder_name: Optional[str] = Query(None),
    issue_date: str = Query("2026-01-15"),
    tenure_days: Optional[int] = Query(None),
    interest_rate: Optional[float] = Query(None),
    purpose: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    return _execute_issue_tampered_sample_fdr(
        bank_id=bank_id,
        fdr_number=fdr_number,
        amount=amount,
        maturity_date=maturity_date,
        holder_name=holder_name,
        issue_date=issue_date,
        tenure_days=tenure_days,
        interest_rate=interest_rate,
        purpose=purpose,
        db=db
    )


@router.get("/sample-case/{case_id}")
def get_sample_case(case_id: str, db: Session = Depends(get_db)):
    """Fetch sample case payload by case identifier."""
    return _execute_issue_sample_fdr(
        bank_id=None,
        fdr_number=None,
        amount=None,
        maturity_date=None,
        holder_name=None,
        issue_date="2026-01-15",
        tenure_days=None,
        interest_rate=None,
        purpose=None,
        case=case_id,
        db=db
    )


def _generate_simple_pdf(lines: List[str]) -> bytes:
    stream_text = " ".join(lines)
    clean_text = "".join(c for c in stream_text if 32 <= ord(c) < 127)
    stream_data = f"BT /F1 12 Tf 50 720 Td ({clean_text}) Tj ET"
    stream_bytes = stream_data.encode("latin-1")
    length = len(stream_bytes)
    
    header = "%PDF-1.4\n"
    obj1 = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    obj2 = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
    obj3 = "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
    obj4 = f"4 0 obj\n<< /Length {length} >>\nstream\n{stream_data}\nendstream\nendobj\n"
    obj5 = "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
    
    offsets = [0]
    curr = len(header)
    for obj in [obj1, obj2, obj3, obj4, obj5]:
        offsets.append(curr)
        curr += len(obj)
        
    xref_offset = curr
    xref = "xref\n0 6\n0000000000 65535 f \n"
    for o in offsets[1:]:
        xref += f"{o:010d} 00000 n \n"
    trailer = f"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n"
    return (header + obj1 + obj2 + obj3 + obj4 + obj5 + xref + trailer).encode("latin-1")


@router.get("/generate-sample-pdf")
def generate_sample_pdf(
    fdr_number: Optional[str] = "SBIN/2026/842911",
    amount: Optional[float] = 1500000.0,
    bank_name: Optional[str] = "State Bank of India",
    issue_date: Optional[str] = "2026-01-15",
    maturity_date: Optional[str] = "2036-01-15",
    holder_name: Optional[str] = "National Institute of Technology, Pune",
    kind: str = "receipt",
    case: Optional[str] = None
):
    """
    Generates and returns an authentic sample PDF byte stream on the fly.
    Enables one-click demo file attachment and real OCR/extraction pipeline execution.
    """
    resolved_fdr = fdr_number or "SBIN/2026/842911"
    resolved_amt = amount if amount is not None else 1500000.0
    resolved_bank = bank_name or "State Bank of India"
    resolved_issue = issue_date or "2026-01-15"
    resolved_maturity = maturity_date or "2036-01-15"
    resolved_holder = holder_name or "National Institute of Technology, Pune"

    # Specific scenario enforcement to guarantee clear visual proof for jury
    if case == "tampered_amount":
        # The authentic bank-issued receipt was for Rs 5,00,000,
        # but the applicant submitted Rs 50,00,000 in the form.
        resolved_amt = 500000.0
    elif case == "tenure_anomaly":
        resolved_maturity = "2029-01-15"
    elif case == "sub_minimum":
        resolved_amt = 250000.0

    if kind == "affidavit":
        lines = [
            "AFFIDAVIT 6 UNDERTAKING",
            "STATUTORY COMPLIANCE DECLARATION PLEDGED TO AICTE",
            f"Institution: {resolved_holder}",
            f"FDR Reference: {resolved_fdr}",
            f"Amount: Rs. {resolved_amt:,.2f}",
            f"Date of Issue: {resolved_issue}",
            f"Date of Maturity: {resolved_maturity}",
            "We solemnly declare that this Fixed Deposit is pledged jointly to AICTE."
        ]
        filename = f"affidavit_{resolved_fdr.replace('/', '_')}.pdf"
    else:
        lines = [
            f"{resolved_bank.upper()} - OFFICIAL FIXED DEPOSIT RECEIPT",
            "TERM DEPOSIT ADVICE / E-FDR CERTIFICATE",
            f"FDR Number: {resolved_fdr}",
            f"Amount: Rs. {resolved_amt:,.2f}",
            f"Date of Issue: {resolved_issue}",
            f"Date of Maturity: {resolved_maturity}",
            f"Account Holder: {resolved_holder} - Joint Lien AICTE"
        ]
        filename = f"fdr_receipt_{resolved_fdr.replace('/', '_')}.pdf"

    pdf_bytes = _generate_simple_pdf(lines)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

