import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from backend.app.models.database import get_db
from backend.app.models.entities import AuditLog
from backend.app.services.audit_service import verify_audit_chain, invalidate_audit_cache, repair_audit_chain

router = APIRouter(prefix="/audit", tags=["Cryptographic Audit Ledger"])

@router.get("")
def get_audit_trail(limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    total = db.query(AuditLog).count()
    entries = db.query(AuditLog).order_by(AuditLog.id.desc()).offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "entries": [
            {
                "id": e.id,
                "ts": e.ts.strftime("%Y-%m-%d %H:%M:%S UTC"),
                "action": e.action,
                "entity_type": e.entity_type,
                "entity_id": e.entity_id,
                "actor_id": e.actor_id,
                "actor_role": e.actor_role,
                "prev_hash": e.prev_hash,
                "hash": e.hash,
                "payload": json.loads(e.payload) if isinstance(e.payload, str) else e.payload
            } for e in entries
        ]
    }

@router.get("/verify")
def verify_audit_integrity(db: Session = Depends(get_db)):
    """Verifies SHA-256 cryptographic chain from block 1 to latest."""
    return verify_audit_chain(db)

@router.post("/sabotage")
def simulate_database_tampering(entry_id: int, db: Session = Depends(get_db)):
    """
    Demo endpoint: Simulates a malicious unauthorized direct DB edit (e.g. rogue DBA).
    Alters a block's stored payload without re-hashing the chain to demonstrate
    tamper detection during the SIH pitch.
    """
    entry = db.query(AuditLog).filter(AuditLog.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Audit entry not found")
        
    payload_dict = json.loads(entry.payload) if isinstance(entry.payload, str) else entry.payload.copy()
    payload_dict["data"]["tampered_by"] = "MALICIOUS_BACKDOOR_INJECTION"
    payload_dict["data"]["amount"] = 99999999.0
    
    db.execute(
        text("UPDATE audit_log SET payload = :p WHERE id = :id"),
        {"p": json.dumps(payload_dict), "id": entry_id}
    )
    db.commit()
    invalidate_audit_cache()
    
    return {
        "success": True,
        "message": f"Simulated backdoor tamper executed on audit entry #{entry_id}. Re-verify chain to see cryptographic alarm."
    }

@router.post("/restore")
def restore_audit_chain(db: Session = Depends(get_db)):
    """
    Self-healing routine: Cleans any sabotage injection residue and
    recomputes contiguous SHA-256 block hashes, returning chain to verified state.
    """
    result = repair_audit_chain(db)
    return {
        "success": True,
        "message": "Audit ledger cryptographically reconciled and restored.",
        "verification": result
    }
