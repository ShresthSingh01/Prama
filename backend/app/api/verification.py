import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.models.database import get_db
from backend.app.models.entities import (
    Instrument, Bank, Verification, FieldProvenance,
    Flag, InstrumentStatusEnum, TrustTierEnum, 
    ProvenanceSourceEnum, FlagSeverityEnum, User
)
from backend.app.services.qr_service import verify_bank_signed_qr_payload
from backend.app.services.audit_service import log_audit_entry
from backend.app.schemas.api_schemas import VerifyQRRequest, BankConfirmRequest
from backend.app.api.auth import get_optional_user, get_current_user

router = APIRouter(prefix="", tags=["Verification"])

@router.post("/instruments/{id}/verify/qr")
def verify_instrument_qr(
    id: int,
    req: VerifyQRRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    inst = db.query(Instrument).filter(Instrument.id == id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Instrument not found")
        
    bank = db.query(Bank).filter(Bank.id == inst.bank_id).first()
    if not bank or not bank.public_key:
        raise HTTPException(status_code=400, detail="Issuing bank public key not registered")
        
    res = verify_bank_signed_qr_payload(bank.public_key, req.qr_content)
    
    if res["valid"]:
        payload = res["payload"]
        
        # Check payload vs declared values across all signed attributes
        mismatches = []
        if str(payload.get("fdr", "")).strip() != inst.fdr_number.strip():
            mismatches.append(f"FDR serial mismatch: QR has {payload.get('fdr')}, claimed {inst.fdr_number}")
        if abs(float(payload.get("amt", 0)) - inst.amount) > 0.01:
            mismatches.append(f"Amount mismatch: QR has {payload.get('amt')}, claimed {inst.amount}")
        if payload.get("iss") and str(payload.get("iss")).strip() != str(inst.issue_date).strip():
            mismatches.append(f"Issue date mismatch: QR has {payload.get('iss')}, claimed {inst.issue_date}")
        if payload.get("mat") and str(payload.get("mat")).strip() != str(inst.maturity_date).strip():
            mismatches.append(f"Maturity date mismatch: QR has {payload.get('mat')}, claimed {inst.maturity_date}")
            
        if mismatches:
            flag = Flag(
                instrument_id=inst.id,
                code="QR_DECLARED_DATA_MISMATCH",
                severity=FlagSeverityEnum.CRITICAL.value,
                explanation="; ".join(mismatches),
                evidence={"qr_payload": payload, "claimed_fdr": inst.fdr_number, "claimed_amt": inst.amount},
                status="open",
                raised_by="system"
            )
            db.add(flag)
            inst.status = InstrumentStatusEnum.FLAGGED.value
            db.commit()
            return {"success": False, "verified": False, "reason": "Payload values differ from declared values", "mismatches": mismatches}

        # Granular Provenance upgrade: only fields verified in the cryptographic envelope
        signed_fields = {"fdr_number", "amount", "issue_date", "maturity_date"}
        for p in inst.provenance_fields:
            if p.field_name in signed_fields:
                p.source = ProvenanceSourceEnum.BANK_CONFIRMED.value
                p.confidence = 1.0
            
        inst.trust_tier = TrustTierEnum.BANK_CONFIRMED.value
        inst.status = InstrumentStatusEnum.VERIFIED.value
        
        ver = Verification(
            instrument_id=inst.id,
            method="signed_qr",
            result="confirmed",
            evidence=payload
        )
        db.add(ver)
        db.commit()
        
        log_audit_entry(db, "VERIFY_SIGNED_QR_SUCCESS", "instrument", inst.id, {
            "bank_id": bank.id,
            "fdr_number": inst.fdr_number,
            "signature": res.get("signature")
        })
        return {
            "success": True,
            "verified": True,
            "trust_tier": inst.trust_tier,
            "message": "Ed25519 cryptographic signature authentic. Provenance upgraded to BANK_CONFIRMED."
        }
    else:
        # Signature verification failed!
        flag = Flag(
            instrument_id=inst.id,
            code="CRITICAL_FORGERY_SIGNATURE_FAILED",
            severity=FlagSeverityEnum.CRITICAL.value,
            explanation=f"CRITICAL TAMPER WARNING: Ed25519 digital signature on FDR QR code failed cryptographic validation for bank '{bank.name}'. High probability of counterfeit instrument.",
            evidence={"reason": res["reason"], "bank_ifsc": bank.ifsc_prefix},
            status="open",
            raised_by="system"
        )
        db.add(flag)
        inst.status = InstrumentStatusEnum.FLAGGED.value
        
        ver = Verification(
            instrument_id=inst.id,
            method="signed_qr",
            result="failed",
            evidence={"reason": res["reason"]}
        )
        db.add(ver)
        db.commit()
        
        log_audit_entry(db, "VERIFY_SIGNED_QR_FAILED", "instrument", inst.id, {
            "bank_id": bank.id,
            "fdr_number": inst.fdr_number,
            "reason": res["reason"]
        })
        return {
            "success": False,
            "verified": False,
            "trust_tier": inst.trust_tier,
            "message": res["reason"]
        }

@router.post("/instruments/{id}/verify/link")
def create_bank_verify_link(id: int, db: Session = Depends(get_db)):
    inst = db.query(Instrument).filter(Instrument.id == id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Instrument not found")
        
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    expires_at = datetime.utcnow() + timedelta(days=7)
    
    ver = Verification(
        instrument_id=inst.id,
        method="verify_link",
        result="pending",
        token_hash=token_hash,
        expires_at=expires_at
    )
    db.add(ver)
    db.commit()
    
    log_audit_entry(db, "DISPATCH_BANK_VERIFY_LINK", "instrument", inst.id, {
        "token_hash": token_hash,
        "expires_at": expires_at.strftime("%Y-%m-%d")
    })
    
    return {
        "success": True,
        "token": token,
        "verify_url": f"/bank-verify/{token}",
        "expires_at": expires_at.strftime("%Y-%m-%d %H:%M UTC")
    }

@router.get("/bank-verify/{token}")
def get_bank_verify_data(token: str, db: Session = Depends(get_db)):
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    ver = db.query(Verification).filter(Verification.token_hash == token_hash).first()
    if not ver or (ver.expires_at and ver.expires_at < datetime.utcnow()):
        raise HTTPException(status_code=404, detail="Verification link invalid or expired")
        
    inst = ver.instrument
    return {
        "institution_name": inst.institution.name,
        "fdr_number": inst.fdr_number,
        "bank_name": inst.bank.name,
        "amount": inst.amount,
        "issue_date": inst.issue_date,
        "maturity_date": inst.maturity_date,
        "status": ver.result
    }

@router.post("/bank-verify/{token}")
def submit_bank_confirmation(token: str, req: BankConfirmRequest, db: Session = Depends(get_db)):
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    ver = db.query(Verification).filter(Verification.token_hash == token_hash).first()
    if not ver or (ver.expires_at and ver.expires_at < datetime.utcnow()):
        raise HTTPException(status_code=400, detail="Verification link invalid or expired")
        
    if ver.responded_at is not None:
        raise HTTPException(status_code=400, detail="Verification token has already been consumed. Replay rejected.")
        
    inst = ver.instrument
    ver.result = "confirmed" if req.decision == "confirmed" else "denied"
    ver.responded_at = datetime.utcnow()
    ver.responder_email = req.officer_email
    ver.evidence = {"remarks": req.remarks, "decision": req.decision}
    
    if req.decision == "confirmed":
        for p in inst.provenance_fields:
            p.source = ProvenanceSourceEnum.BANK_CONFIRMED.value
            p.confidence = 1.0
        inst.trust_tier = TrustTierEnum.BANK_CONFIRMED.value
        inst.status = InstrumentStatusEnum.VERIFIED.value
    else:
        flag = Flag(
            instrument_id=inst.id,
            code="BANK_DISOWNED_INSTRUMENT",
            severity=FlagSeverityEnum.CRITICAL.value,
            explanation=f"Issuing bank nodal officer explicitly denied and disowned FDR {inst.fdr_number}. Remarks: {req.remarks or 'No remarks'}",
            evidence={"responder": req.officer_email},
            status="open",
            raised_by="bank_officer"
        )
        db.add(flag)
        inst.status = InstrumentStatusEnum.FLAGGED.value
        
    db.commit()
    log_audit_entry(db, "BANK_VERIFY_RESPONSE", "instrument", inst.id, {
        "decision": req.decision,
        "responder": req.officer_email
    })
    return {"success": True, "result": ver.result}

@router.post("/bank-portal/confirm")
def submit_bank_confirmation_alias(
    token: str,
    req: BankConfirmRequest,
    db: Session = Depends(get_db)
):
    return submit_bank_confirmation(token, req, db)
