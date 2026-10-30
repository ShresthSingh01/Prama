import os
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from backend.app.models.database import get_db
from backend.app.models.entities import (
    Instrument, ReleaseRequest, User, Flag,
    InstrumentStatusEnum, TrustTierEnum, RoleEnum
)
from backend.app.core.config import settings
from backend.app.services.audit_service import log_audit_entry, get_latest_audit_hash
from backend.app.services.release_policy import evaluate_release_readiness
from backend.app.services.certificate_service import generate_release_certificate
from backend.app.schemas.api_schemas import ReleaseRequestCreate, ReleaseDecision
from backend.app.api.auth import get_optional_user, get_current_user

router = APIRouter(prefix="", tags=["Release Workflow"])

@router.get("/instruments/{id}/release-readiness")
def check_release_readiness(id: int, db: Session = Depends(get_db)):
    """Live AICTE APH 2024-2027 Clause 6.46 release prerequisite evaluation."""
    inst = db.query(Instrument).filter(Instrument.id == id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Instrument not found")
    return evaluate_release_readiness(db, inst)

@router.post("/instruments/{id}/release-requests")
def submit_release_request(
    id: int,
    req: ReleaseRequestCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    inst = db.query(Instrument).filter(Instrument.id == id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Instrument not found")
        
    # Evaluate Versioned Regulatory Readiness (AICTE APH Clause 6.46)
    readiness = evaluate_release_readiness(db, inst)
    if not readiness["is_ready"]:
        blockers_str = "; ".join(readiness["blockers"])
        raise HTTPException(
            status_code=400,
            detail=f"Release Pre-check Failed (APH Clause 6.46): {blockers_str}"
        )
        
    requested_by = current_user.id if current_user else 1
    rel = ReleaseRequest(
        instrument_id=inst.id,
        requested_by=requested_by,
        reason=req.reason,
        status="submitted"
    )
    inst.status = InstrumentStatusEnum.RELEASE_REQUESTED.value
    db.add(rel)
    db.commit()
    db.refresh(rel)
    
    log_audit_entry(db, "SUBMIT_RELEASE_REQUEST", "release_request", rel.id, {
        "instrument_id": inst.id,
        "reason": req.reason,
        "readiness_checklist": readiness["checklist"]
    }, requested_by, current_user.role if current_user else "institution_admin")
    
    return {"success": True, "release_request_id": rel.id, "status": rel.status}

@router.get("/release-requests")
def list_release_requests(db: Session = Depends(get_db)):
    requests = (
        db.query(ReleaseRequest)
        .options(
            joinedload(ReleaseRequest.instrument).joinedload(Instrument.institution)
        )
        .order_by(ReleaseRequest.id.desc())
        .all()
    )
    out = []
    for r in requests:
        inst = r.instrument
        out.append({
            "id": r.id,
            "instrument_id": r.instrument_id,
            "fdr_number": inst.fdr_number,
            "institution_name": inst.institution.name,
            "amount": inst.amount,
            "reason": r.reason,
            "status": r.status,
            "maker_id": r.maker_id,
            "checker_id": r.checker_id,
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else "",
            "certificate_hash": r.certificate_hash,
            "certificate_url": f"/api/v1/release-requests/{r.id}/certificate" if r.status == "released" else None
        })
    return out

@router.patch("/release-requests/{id}/maker-scrutiny")
def maker_scrutiny(
    id: int,
    decision: ReleaseDecision,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """Scrutiny Officer (Maker) verifies documents and prechecks."""
    rel = db.query(ReleaseRequest).filter(ReleaseRequest.id == id).first()
    if not rel:
        raise HTTPException(status_code=404, detail="Release request not found")
        
    maker_id = current_user.id if current_user else 2
    if decision.decision == "approved":
        rel.status = "under_review"
        rel.maker_id = maker_id
        rel.remarks = decision.remarks or "Maker verified all compliance requirements."
    else:
        rel.status = "rejected"
        rel.maker_id = maker_id
        rel.remarks = decision.remarks or "Maker rejected release request."
        rel.instrument.status = InstrumentStatusEnum.ACTIVE.value
        
    db.commit()
    log_audit_entry(db, "MAKER_SCRUTINY_DECISION", "release_request", rel.id, {
        "decision": decision.decision,
        "maker_id": maker_id
    }, maker_id, "scrutiny_officer")
    
    return {"success": True, "status": rel.status}

@router.patch("/release-requests/{id}/checker-approval")
def checker_approval(
    id: int,
    decision: ReleaseDecision,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """Senior Officer (Checker/Approver) final release approval. Enforces maker != checker."""
    rel = db.query(ReleaseRequest).filter(ReleaseRequest.id == id).first()
    if not rel:
        raise HTTPException(status_code=404, detail="Release request not found")
        
    checker_id = current_user.id if current_user else 3
    
    # Enforce Maker-Checker Separation
    if rel.maker_id and rel.maker_id == checker_id:
        raise HTTPException(
            status_code=403,
            detail="Maker-Checker Violation: Approver (Checker) cannot be the same officer who performed Scrutiny (Maker)."
        )
        
    if decision.decision == "approved":
        rel.status = "released"
        rel.checker_id = checker_id
        rel.decided_at = datetime.utcnow()
        rel.instrument.status = InstrumentStatusEnum.RELEASED.value
        
        # Generate tamper-evident release certificate hash
        cert_hash = get_latest_audit_hash(db)
        rel.certificate_hash = cert_hash
        
        # Generate Genuine Printable PDF Discharge Certificate on disk
        generate_release_certificate(db, rel)
        rel.certificate_url = f"/api/v1/release-requests/{rel.id}/certificate"
    else:
        rel.status = "rejected"
        rel.checker_id = checker_id
        rel.decided_at = datetime.utcnow()
        rel.instrument.status = InstrumentStatusEnum.ACTIVE.value
        
    db.commit()
    log_audit_entry(db, "CHECKER_RELEASE_FINAL_APPROVAL", "release_request", rel.id, {
        "decision": decision.decision,
        "checker_id": checker_id,
        "certificate_hash": rel.certificate_hash
    }, checker_id, "senior_officer")
    
    return {
        "success": True,
        "status": rel.status,
        "certificate_hash": rel.certificate_hash,
        "certificate_url": rel.certificate_url
    }

@router.get("/release-requests/{id}/certificate")
def download_release_certificate_pdf(id: int, db: Session = Depends(get_db)):
    """Downloads authentic, generated AICTE Statutory Lien Discharge Certificate PDF."""
    rel = db.query(ReleaseRequest).filter(ReleaseRequest.id == id).first()
    if not rel:
        raise HTTPException(status_code=404, detail="Release request not found")
    if rel.status != "released":
        raise HTTPException(status_code=400, detail="Certificate is only generated for finalized, released deposits")
        
    cert_dir = os.path.join(settings.STORAGE_DIR, "certificates")
    pdf_path = os.path.join(cert_dir, f"release_{rel.id}.pdf")
    if not os.path.exists(pdf_path):
        generate_release_certificate(db, rel)
        
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=f"AICTE_Release_Certificate_{rel.id}.pdf"
    )
