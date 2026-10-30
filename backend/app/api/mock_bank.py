from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.models.database import get_db
from backend.app.models.entities import Bank
from backend.app.services.qr_service import generate_bank_signed_qr

router = APIRouter(prefix="/mock-bank", tags=["Mock Bank Gateway"])

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

@router.post("/issue-sample-fdr")
def issue_sample_fdr(bank_id: int, fdr_number: str, amount: float, maturity_date: str, holder_name: str, issue_date: str = "2026-01-15", db: Session = Depends(get_db)):
    bank = db.query(Bank).filter(Bank.id == bank_id).first()
    if not bank or not bank.private_key:
        raise HTTPException(status_code=404, detail="Bank not found or private key unavailable")
        
    res = generate_bank_signed_qr(
        bank_private_key_hex=bank.private_key,
        bank_ifsc=bank.ifsc_prefix,
        fdr_number=fdr_number,
        amount=amount,
        issue_date=issue_date,
        maturity_date=maturity_date,
        holder_name=holder_name
    )
    return {
        "success": True,
        "bank_name": bank.name,
        "qr_envelope": res["envelope"],
        "envelope_json": res["envelope_json"],
        "signature": res["signature"]
    }

@router.post("/issue-tampered-sample-fdr")
def issue_tampered_sample_fdr(bank_id: int, fdr_number: str, amount: float, maturity_date: str, holder_name: str, issue_date: str = "2026-01-15", db: Session = Depends(get_db)):
    """
    Generates a valid bank signature on Rs 5,00,000, then maliciously modifies
    the envelope amount to Rs 50,00,000 to demonstrate signature validation failure!
    """
    bank = db.query(Bank).filter(Bank.id == bank_id).first()
    if not bank or not bank.private_key:
        raise HTTPException(status_code=404, detail="Bank not found or private key unavailable")
        
    # Sign genuine lower amount (5 Lakhs)
    res = generate_bank_signed_qr(
        bank_private_key_hex=bank.private_key,
        bank_ifsc=bank.ifsc_prefix,
        fdr_number=fdr_number,
        amount=500000.0,
        issue_date=issue_date,
        maturity_date=maturity_date,
        holder_name=holder_name
    )
    
    # Maliciously tamper with envelope amount (change to 50 Lakhs) without resigning
    tampered_envelope = res["envelope"].copy()
    tampered_envelope["payload"] = tampered_envelope["payload"].copy()
    tampered_envelope["payload"]["amt"] = 5000000.0  # Inflated 10x!
    
    import json
    return {
        "success": True,
        "bank_name": bank.name,
        "tampered_envelope": tampered_envelope,
        "tampered_envelope_json": json.dumps(tampered_envelope, separators=(',', ':')),
        "original_signed_amount": 500000.0,
        "tampered_claimed_amount": 5000000.0,
        "note": "Amount in payload changed after signing. Offline signature verification will fail instantly."
    }
