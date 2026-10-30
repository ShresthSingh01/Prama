from datetime import datetime
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.models.database import get_db
from backend.app.models.entities import Flag, Instrument, User, InstrumentStatusEnum, utc_now
from backend.app.services.audit_service import log_audit_entry
from backend.app.services.risk_service import compute_instrument_risk_score
from backend.app.schemas.api_schemas import FlagActionRequest
from backend.app.api.auth import get_optional_user

router = APIRouter(prefix="/flags", tags=["Flags"])

@router.post("/{id}/resolve")
def resolve_flag(
    id: int,
    payload: FlagActionRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """
    Statutory resolution of a regulatory discrepancy or forensic flag.
    Marks flag as resolved, captures officer remarks, recomputes risk, and logs to Merkle audit.
    """
    flag = db.query(Flag).filter(Flag.id == id).first()
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")

    if current_user and current_user.role == "institution_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Institutions are not authorized to resolve regulatory flags."
        )

    user_id = current_user.id if current_user else 1
    user_role = current_user.role if current_user else "scrutiny_officer"
    
    flag.status = "resolved"
    flag.resolved_by = user_id
    flag.resolved_at = utc_now()
    
    current_evidence = dict(flag.evidence) if isinstance(flag.evidence, dict) else {}
    current_evidence["resolution_remarks"] = payload.remarks or "Flag marked as resolved by statutory scrutiny officer."
    current_evidence["resolved_action"] = "resolved"
    flag.evidence = current_evidence

    # If all flags on this instrument are now resolved/dismissed, recompute risk score
    inst = db.query(Instrument).filter(Instrument.id == flag.instrument_id).first()
    if inst:
        open_flags = [f for f in inst.flags if f.status == "open"]
        if not open_flags and inst.status == InstrumentStatusEnum.FLAGGED.value:
            inst.status = InstrumentStatusEnum.ACTIVE.value
        compute_instrument_risk_score(db, inst)

    log_audit_entry(
        db,
        action="RESOLVE_FLAG",
        entity_type="flag",
        entity_id=flag.id,
        payload={
            "flag_code": flag.code,
            "instrument_id": flag.instrument_id,
            "remarks": payload.remarks
        },
        actor_id=user_id,
        actor_role=user_role
    )
    db.commit()
    db.refresh(flag)

    return {
        "success": True,
        "flag_id": flag.id,
        "status": flag.status,
        "resolved_at": flag.resolved_at.isoformat() if flag.resolved_at else None,
        "instrument_id": flag.instrument_id
    }

@router.post("/{id}/dismiss")
def dismiss_flag(
    id: int,
    payload: FlagActionRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """
    Dismisses a flag as a false-positive after scrutiny validation.
    """
    flag = db.query(Flag).filter(Flag.id == id).first()
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")

    if current_user and current_user.role == "institution_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Institutions are not authorized to dismiss regulatory flags."
        )

    user_id = current_user.id if current_user else 1
    user_role = current_user.role if current_user else "scrutiny_officer"
    
    flag.status = "dismissed"
    flag.resolved_by = user_id
    flag.resolved_at = utc_now()
    
    current_evidence = dict(flag.evidence) if isinstance(flag.evidence, dict) else {}
    current_evidence["dismissal_remarks"] = payload.remarks or "Flag dismissed as false positive by statutory scrutiny officer."
    current_evidence["resolved_action"] = "dismissed"
    flag.evidence = current_evidence

    inst = db.query(Instrument).filter(Instrument.id == flag.instrument_id).first()
    if inst:
        open_flags = [f for f in inst.flags if f.status == "open"]
        if not open_flags and inst.status == InstrumentStatusEnum.FLAGGED.value:
            inst.status = InstrumentStatusEnum.ACTIVE.value
        compute_instrument_risk_score(db, inst)

    log_audit_entry(
        db,
        action="DISMISS_FLAG",
        entity_type="flag",
        entity_id=flag.id,
        payload={
            "flag_code": flag.code,
            "instrument_id": flag.instrument_id,
            "remarks": payload.remarks
        },
        actor_id=user_id,
        actor_role=user_role
    )
    db.commit()
    db.refresh(flag)

    return {
        "success": True,
        "flag_id": flag.id,
        "status": flag.status,
        "resolved_at": flag.resolved_at.isoformat() if flag.resolved_at else None,
        "instrument_id": flag.instrument_id
    }

