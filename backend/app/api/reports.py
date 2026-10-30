import csv
import io
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload, selectinload
from backend.app.models.database import get_db
from backend.app.models.entities import (
    Instrument, Institution, Bank, Document, Flag,
    InstrumentStatusEnum, TrustTierEnum, FlagSeverityEnum, User
)
from backend.app.services.clock_service import get_simulated_now
from backend.app.api.auth import get_optional_user

router = APIRouter(prefix="/reports", tags=["Statutory Management Reports"])

def create_csv_response(rows: List[dict], filename: str, default_headers: Optional[List[str]] = None) -> Response:
    output = io.StringIO()
    if rows:
        writer = csv.DictWriter(output, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    elif default_headers:
        writer = csv.writer(output)
        writer.writerow(default_headers)
    else:
        return Response(content="No matching records found", media_type="text/csv")
    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/pending-verifications")
def report_pending_verifications(
    format: str = Query("json", pattern="^(json|csv)$"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """Report 1: Pending Verifications across all scheduled commercial banks."""
    simulated_now = get_simulated_now(db)
    query = (
        db.query(Instrument)
        .options(joinedload(Instrument.institution), joinedload(Instrument.bank))
        .filter(
            Instrument.trust_tier.in_([
                TrustTierEnum.SELF_DECLARED.value,
                TrustTierEnum.DOC_EXTRACTED.value
            ]),
            Instrument.status != InstrumentStatusEnum.RELEASED.value
        )
    )
    if current_user and current_user.role == "institution_admin":
        query = query.filter(Instrument.institution_id == current_user.institution_id)

    instruments = query.order_by(Instrument.id.desc()).all()

    rows = []
    for inst in instruments:
        created_str = inst.created_at.strftime("%Y-%m-%d") if inst.created_at else "N/A"
        days_pending = (simulated_now.date() - inst.created_at.date()).days if inst.created_at else 0
        rows.append({
            "fdr_number": inst.fdr_number,
            "institution_name": inst.institution.name if inst.institution else "N/A",
            "aicte_id": inst.institution.aicte_id if inst.institution else "N/A",
            "bank_name": inst.bank.name if inst.bank else "N/A",
            "amount_inr": inst.amount,
            "submission_date": created_str,
            "days_pending_verification": max(0, days_pending),
            "trust_tier": inst.trust_tier,
            "status": inst.status
        })

    if format == "csv":
        return create_csv_response(rows, f"AICTE_Pending_Verifications_{simulated_now.strftime('%Y%m%d')}.csv")
    return {"total": len(rows), "data": rows}

@router.get("/upcoming-maturities")
def report_upcoming_maturities(
    days: int = Query(90, ge=1, le=365),
    format: str = Query("json", pattern="^(json|csv)$"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """Report 2: Instruments reaching maturity within prescribed window."""
    simulated_now = get_simulated_now(db)
    query = (
        db.query(Instrument)
        .options(joinedload(Instrument.institution), joinedload(Instrument.bank))
        .filter(
            Instrument.status.in_([
                InstrumentStatusEnum.ACTIVE.value,
                InstrumentStatusEnum.EXPIRING.value,
                InstrumentStatusEnum.MATURED.value
            ])
        )
    )
    if current_user and current_user.role == "institution_admin":
        query = query.filter(Instrument.institution_id == current_user.institution_id)

    instruments = query.all()

    rows = []
    for inst in instruments:
        try:
            mat = datetime.strptime(inst.maturity_date, "%Y-%m-%d").date()
            diff = (mat - simulated_now.date()).days
            if diff <= days:
                rows.append({
                    "fdr_number": inst.fdr_number,
                    "institution_name": inst.institution.name if inst.institution else "N/A",
                    "state": inst.institution.state if inst.institution else "N/A",
                    "bank_name": inst.bank.name if inst.bank else "N/A",
                    "amount_inr": inst.amount,
                    "maturity_date": inst.maturity_date,
                    "days_to_maturity": diff,
                    "status": inst.status,
                    "risk_band": inst.risk_band
                })
        except Exception:
            pass

    rows.sort(key=lambda x: x["days_to_maturity"])

    if format == "csv":
        return create_csv_response(
            rows, 
            f"AICTE_Upcoming_Maturities_{days}days_{simulated_now.strftime('%Y%m%d')}.csv",
            default_headers=["fdr_number", "institution_name", "state", "bank_name", "amount_inr", "maturity_date", "days_to_maturity", "status", "risk_band"]
        )
    return {"total": len(rows), "window_days": days, "data": rows}

@router.get("/missing-documents")
def report_missing_documents(
    format: str = Query("json", pattern="^(json|csv)$"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """Report 3: FDR instruments missing verified supporting records."""
    simulated_now = get_simulated_now(db)
    query = (
        db.query(Instrument)
        .options(joinedload(Instrument.institution), selectinload(Instrument.documents))
        .filter(Instrument.status != InstrumentStatusEnum.RELEASED.value)
    )
    if current_user and current_user.role == "institution_admin":
        query = query.filter(Instrument.institution_id == current_user.institution_id)

    instruments = query.all()

    rows = []
    for inst in instruments:
        doc_count = len(inst.documents)
        has_fdr_receipt = any(str(d.kind).upper() == "FDR_RECEIPT" for d in inst.documents)
        if doc_count == 0 or not has_fdr_receipt:
            rows.append({
                "fdr_number": inst.fdr_number,
                "institution_name": inst.institution.name if inst.institution else "N/A",
                "aicte_id": inst.institution.aicte_id if inst.institution else "N/A",
                "amount_inr": inst.amount,
                "missing_records": "Original FDR Receipt Copy" if doc_count == 0 else "Supporting Affidavit 6 / EoA",
                "total_documents_uploaded": doc_count,
                "status": inst.status
            })

    if format == "csv":
        return create_csv_response(rows, f"AICTE_Missing_Documents_{simulated_now.strftime('%Y%m%d')}.csv")
    return {"total": len(rows), "data": rows}

@router.get("/intervention-cases")
def report_intervention_cases(
    format: str = Query("json", pattern="^(json|csv)$"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """Report 4: High risk, discrepant or overdue cases requiring regulatory intervention."""
    simulated_now = get_simulated_now(db)
    query = (
        db.query(Instrument)
        .options(
            joinedload(Instrument.institution),
            joinedload(Instrument.bank),
            selectinload(Instrument.flags)
        )
        .filter(
            (Instrument.status.in_([InstrumentStatusEnum.FLAGGED.value, InstrumentStatusEnum.OVERDUE.value])) |
            (Instrument.risk_band.in_(["CRITICAL", "HIGH"]))
        )
    )
    if current_user and current_user.role == "institution_admin":
        query = query.filter(Instrument.institution_id == current_user.institution_id)

    instruments = query.order_by(Instrument.risk_score.desc()).all()

    rows = []
    for inst in instruments:
        open_flags = [f for f in inst.flags if f.status == "open"]
        top_reason = open_flags[0].explanation if open_flags else f"Status: {inst.status}"
        rows.append({
            "fdr_number": inst.fdr_number,
            "institution_name": inst.institution.name if inst.institution else "N/A",
            "state": inst.institution.state if inst.institution else "N/A",
            "bank_name": inst.bank.name if inst.bank else "N/A",
            "amount_inr": inst.amount,
            "status": inst.status,
            "risk_score": inst.risk_score,
            "risk_band": inst.risk_band,
            "open_flags_count": len(open_flags),
            "primary_intervention_reason": top_reason[:150]
        })

    if format == "csv":
        return create_csv_response(rows, f"AICTE_Intervention_Cases_{simulated_now.strftime('%Y%m%d')}.csv")
    return {"total": len(rows), "data": rows}
