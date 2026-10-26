import json
from datetime import datetime
from typing import Dict, Any, Tuple, Optional, List
from sqlalchemy.orm import Session
from backend.app.models.entities import AuditLog
from backend.app.core.crypto import canonical_json, compute_chain_hash

GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000"

def get_latest_audit_hash(db: Session) -> str:
    latest = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
    return latest.hash if latest else GENESIS_HASH

def log_audit_entry(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: int,
    payload: Dict[str, Any],
    actor_id: Optional[int] = None,
    actor_role: Optional[str] = None
) -> AuditLog:
    """Appends an immutable, cryptographic SHA-256 hash-chained log entry."""
    prev_hash = get_latest_audit_hash(db)
    
    full_payload = {
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "actor_id": actor_id,
        "actor_role": actor_role,
        "data": payload
    }
    
    entry_hash = compute_chain_hash(prev_hash, full_payload)
    
    entry = AuditLog(
        actor_id=actor_id,
        actor_role=actor_role,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        payload=full_payload,
        prev_hash=prev_hash,
        hash=entry_hash,
        ts=datetime.utcnow()
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry

def verify_audit_chain(db: Session) -> Dict[str, Any]:
    """
    Verifies the cryptographic integrity of the entire audit chain.
    Returns status, total entries checked, and the first broken block ID if compromised.
    """
    entries = db.query(AuditLog).order_by(AuditLog.id.asc()).all()
    if not entries:
        return {
            "valid": True,
            "total_entries": 0,
            "message": "Audit chain empty. Genesis state valid."
        }
    
    expected_prev_hash = GENESIS_HASH
    for i, entry in enumerate(entries):
        # 1. Verify prev_hash link
        if entry.prev_hash != expected_prev_hash:
            return {
                "valid": False,
                "broken_at_id": entry.id,
                "reason": f"Hash chain broken at entry #{entry.id}: prev_hash mismatch. Expected {expected_prev_hash}, found {entry.prev_hash}",
                "total_checked": i
            }
        
        # 2. Recompute hash
        payload_dict = json.loads(entry.payload) if isinstance(entry.payload, str) else entry.payload
        computed_hash = compute_chain_hash(entry.prev_hash, payload_dict)
        if entry.hash != computed_hash:
            return {
                "valid": False,
                "broken_at_id": entry.id,
                "reason": f"Payload tampering detected at entry #{entry.id}! Stored hash {entry.hash} != computed hash {computed_hash}",
                "total_checked": i
            }
        
        expected_prev_hash = entry.hash
        
    return {
        "valid": True,
        "total_entries": len(entries),
        "latest_hash": expected_prev_hash,
        "message": f"Cryptographic integrity verified: all {len(entries)} audit blocks strictly untampered."
    }
