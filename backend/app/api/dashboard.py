from datetime import datetime, timedelta
from typing import Dict, Any, List
from collections import defaultdict
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.models.database import get_db
from backend.app.models.entities import (
    Instrument, Flag, Verification, ReleaseRequest,
    InstrumentStatusEnum, TrustTierEnum
)
from backend.app.services.clock_service import get_simulated_now

router = APIRouter(prefix="/dashboard", tags=["Dashboard Intelligence"])

@router.get("/summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    """Computes all summary statistics live from the database."""
    simulated_now = get_simulated_now(db)
    
    total_count = db.query(Instrument).count()
    total_amount = db.query(func.sum(Instrument.amount)).scalar() or 0.0
    
    # Status Breakdown
    status_counts = dict(
        db.query(Instrument.status, func.count(Instrument.id))
        .group_by(Instrument.status)
        .all()
    )
    
    # Trust Tier Breakdown
    tier_counts = dict(
        db.query(Instrument.trust_tier, func.count(Instrument.id))
        .group_by(Instrument.trust_tier)
        .all()
    )
    
    # Risk Band Breakdown
    risk_counts = dict(
        db.query(Instrument.risk_band, func.count(Instrument.id))
        .group_by(Instrument.risk_band)
        .all()
    )
    
    # Expiring Within 30 / 60 / 90 Days
    all_instruments = db.query(Instrument).filter(
        Instrument.status.in_([InstrumentStatusEnum.ACTIVE.value, InstrumentStatusEnum.EXPIRING.value])
    ).all()
    
    expiring_30 = 0
    expiring_60 = 0
    expiring_90 = 0
    for inst in all_instruments:
        try:
            mat = datetime.strptime(inst.maturity_date, "%Y-%m-%d")
            diff = (mat.date() - simulated_now.date()).days
            if 0 <= diff <= 30:
                expiring_30 += 1
            if 0 <= diff <= 60:
                expiring_60 += 1
            if 0 <= diff <= 90:
                expiring_90 += 1
        except Exception:
            pass

    open_flags = db.query(Flag).filter(Flag.status == "open").count()
    pending_releases = db.query(ReleaseRequest).filter(ReleaseRequest.status.in_(["submitted", "under_review"])).count()
    
    return {
        "simulated_date": simulated_now.strftime("%Y-%m-%d"),
        "total_instruments": total_count,
        "total_security_cover_amount": total_amount,
        "total_security_cover_cr": round(total_amount / 10000000.0, 2),
        "status_distribution": {
            "active": status_counts.get(InstrumentStatusEnum.ACTIVE.value, 0),
            "expiring": status_counts.get(InstrumentStatusEnum.EXPIRING.value, 0),
            "matured": status_counts.get(InstrumentStatusEnum.MATURED.value, 0),
            "renewed": status_counts.get(InstrumentStatusEnum.RENEWED.value, 0),
            "released": status_counts.get(InstrumentStatusEnum.RELEASED.value, 0),
            "flagged": status_counts.get(InstrumentStatusEnum.FLAGGED.value, 0),
            "overdue": status_counts.get(InstrumentStatusEnum.OVERDUE.value, 0),
            "submitted": status_counts.get(InstrumentStatusEnum.SUBMITTED.value, 0)
        },
        "trust_tiers": {
            "bank_confirmed": tier_counts.get(TrustTierEnum.BANK_CONFIRMED.value, 0),
            "cross_validated": tier_counts.get(TrustTierEnum.CROSS_VALIDATED.value, 0),
            "doc_extracted": tier_counts.get(TrustTierEnum.DOC_EXTRACTED.value, 0),
            "self_declared": tier_counts.get(TrustTierEnum.SELF_DECLARED.value, 0)
        },
        "risk_bands": {
            "critical": risk_counts.get("CRITICAL", 0),
            "high": risk_counts.get("HIGH", 0),
            "medium": risk_counts.get("MEDIUM", 0),
            "low": risk_counts.get("LOW", 0)
        },
        "expiring_windows": {
            "days_30": expiring_30,
            "days_60": expiring_60,
            "days_90": expiring_90
        },
        "open_flags": open_flags,
        "pending_release_requests": pending_releases
    }

@router.get("/timeline")
def get_maturity_timeline(db: Session = Depends(get_db)):
    """Maturity cliff heatmap: aggregated monthly expiry exposure for the next 24 months."""
    instruments = db.query(Instrument).filter(
        Instrument.status.in_([
            InstrumentStatusEnum.ACTIVE.value,
            InstrumentStatusEnum.EXPIRING.value,
            InstrumentStatusEnum.MATURED.value
        ])
    ).all()
    
    monthly_map = defaultdict(lambda: {"count": 0, "amount": 0.0, "critical_count": 0})
    for inst in instruments:
        try:
            # Group by YYYY-MM
            month_key = inst.maturity_date[:7]
            monthly_map[month_key]["count"] += 1
            monthly_map[month_key]["amount"] += inst.amount
            if inst.risk_band == "CRITICAL":
                monthly_map[month_key]["critical_count"] += 1
        except Exception:
            pass
            
    sorted_months = sorted(monthly_map.keys())
    timeline = []
    for m in sorted_months[:24]:
        timeline.append({
            "month": m,
            "count": monthly_map[m]["count"],
            "amount_cr": round(monthly_map[m]["amount"] / 10000000.0, 2),
            "critical_count": monthly_map[m]["critical_count"]
        })
    return timeline

@router.get("/queue")
def get_act_today_queue(limit: int = 25, db: Session = Depends(get_db)):
    """Priority triage queue sorted by risk score with actionable reason chips."""
    simulated_now = get_simulated_now(db)
    
    instruments = (
        db.query(Instrument)
        .filter(Instrument.status.notin_([InstrumentStatusEnum.RELEASED.value, InstrumentStatusEnum.RENEWED.value]))
        .order_by(Instrument.risk_score.desc())
        .limit(limit)
        .all()
    )
    
    queue = []
    for inst in instruments:
        days_to_mat = 0
        try:
            mat = datetime.strptime(inst.maturity_date, "%Y-%m-%d")
            days_to_mat = (mat.date() - simulated_now.date()).days
        except Exception:
            pass
            
        open_flags = [f.explanation for f in inst.flags if f.status == "open"]
        
        # Primary reason chip
        if open_flags:
            primary_reason = f"Flags Raised: {open_flags[0]}"
        elif days_to_mat < 0:
            primary_reason = f"Lapsed by {abs(days_to_mat)} days"
        elif days_to_mat <= 30:
            primary_reason = f"Critical Expiry in {days_to_mat} days"
        elif inst.trust_tier == TrustTierEnum.SELF_DECLARED.value:
            primary_reason = "Unverified Self-Declaration"
        else:
            primary_reason = "Routine Regulatory Review"
            
        queue.append({
            "id": inst.id,
            "fdr_number": inst.fdr_number,
            "institution_name": inst.institution.name if inst.institution else "",
            "state": inst.institution.state if inst.institution else "",
            "bank_name": inst.bank.name if inst.bank else "",
            "amount": inst.amount,
            "amount_cr": round(inst.amount / 10000000.0, 2),
            "maturity_date": inst.maturity_date,
            "days_to_maturity": days_to_mat,
            "status": inst.status,
            "trust_tier": inst.trust_tier,
            "risk_score": inst.risk_score,
            "risk_band": inst.risk_band,
            "primary_reason": primary_reason,
            "open_flags_count": len(open_flags)
        })
    return queue
