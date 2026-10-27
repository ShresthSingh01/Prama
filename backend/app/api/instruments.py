import os
import shutil
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request, status
from sqlalchemy.orm import Session, joinedload, selectinload
from backend.app.models.database import get_db
from backend.app.models.entities import (
    Instrument, Institution, Bank, Document, FieldProvenance,
    Flag, Verification, Observation, User, InstrumentStatusEnum,
    TrustTierEnum, ProvenanceSourceEnum
)
from backend.app.core.config import settings
from backend.app.core.crypto import compute_file_sha256, compute_image_dhash
from backend.app.services.clock_service import get_simulated_now
from backend.app.services.audit_service import log_audit_entry
from backend.app.services.rules_engine import evaluate_instrument_rules
from backend.app.services.risk_service import compute_instrument_risk_score
from backend.app.services.forensic_service import (
    perform_error_level_analysis, inspect_pdf_metadata, extract_document_fields,
    get_instrument_forensics
)
from backend.app.schemas.api_schemas import InstrumentCreate
from backend.app.api.auth import get_optional_user, get_current_user

router = APIRouter(prefix="/instruments", tags=["Instruments"])

@router.get("")
def list_instruments(
    status: Optional[str] = None,
    trust_tier: Optional[str] = None,
    risk_band: Optional[str] = None,
    search: Optional[str] = None,
    institution_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    query = db.query(Instrument)
    
    # Institution Isolation Rule (RBAC)
    if current_user and current_user.role == "institution_admin":
        query = query.filter(Instrument.institution_id == current_user.institution_id)
    elif institution_id:
        query = query.filter(Instrument.institution_id == institution_id)
        
    if status:
        query = query.filter(Instrument.status == status)
    if trust_tier:
        query = query.filter(Instrument.trust_tier == trust_tier)
    if risk_band:
        query = query.filter(Instrument.risk_band == risk_band)
        
    if search:
        s = f"%{search.strip()}%"
        query = query.join(Institution).filter(
            (Instrument.fdr_number.ilike(s)) | (Institution.name.ilike(s))
        )
        
    simulated_now = get_simulated_now(db)
    results = query.options(
        joinedload(Instrument.institution),
        joinedload(Instrument.bank),
        selectinload(Instrument.flags)
    ).order_by(Instrument.risk_score.desc(), Instrument.id.desc()).all()
    
    items = []
    for inst in results:
        days_to_mat = 0
        try:
            mat = datetime.strptime(inst.maturity_date, "%Y-%m-%d")
            days_to_mat = (mat.date() - simulated_now.date()).days
        except Exception:
            pass
            
        items.append({
            "id": inst.id,
            "institution_id": inst.institution_id,
            "institution_name": inst.institution.name if inst.institution else "",
            "bank_id": inst.bank_id,
            "bank_name": inst.bank.name if inst.bank else "",
            "fdr_number": inst.fdr_number,
            "amount": inst.amount,
            "issue_date": inst.issue_date,
            "maturity_date": inst.maturity_date,
            "tenure_days": inst.tenure_days,
            "interest_rate": inst.interest_rate,
            "status": inst.status,
            "trust_tier": inst.trust_tier,
            "risk_score": inst.risk_score,
            "risk_band": inst.risk_band,
            "days_to_maturity": days_to_mat,
            "flags_count": len([f for f in inst.flags if f.status == 'open'])
        })
    return items

@router.get("/{id}")
def get_instrument_detail(id: int, db: Session = Depends(get_db)):
    inst = db.query(Instrument).options(
        joinedload(Instrument.institution),
        joinedload(Instrument.bank),
        selectinload(Instrument.provenance_fields),
        selectinload(Instrument.documents),
        selectinload(Instrument.flags),
        selectinload(Instrument.verifications)
    ).filter(Instrument.id == id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Instrument not found")
        
    simulated_now = get_simulated_now(db)
    days_to_mat = 0
    try:
        mat = datetime.strptime(inst.maturity_date, "%Y-%m-%d")
        days_to_mat = (mat.date() - simulated_now.date()).days
    except Exception:
        pass

    prov_map = {}
    for p in inst.provenance_fields:
        prov_map[p.field_name] = {
            "value": p.value,
            "source": p.source,
            "confidence": p.confidence,
            "updated_at": p.updated_at.strftime("%Y-%m-%d %H:%M") if p.updated_at else ""
        }
        
    return {
        "id": inst.id,
        "institution_id": inst.institution_id,
        "institution_name": inst.institution.name if inst.institution else "",
        "institution_aicte_id": inst.institution.aicte_id if inst.institution else "",
        "bank_id": inst.bank_id,
        "bank_name": inst.bank.name if inst.bank else "",
        "bank_ifsc": inst.bank.ifsc_prefix if inst.bank else "",
        "fdr_number": inst.fdr_number,
        "amount": inst.amount,
        "issue_date": inst.issue_date,
        "maturity_date": inst.maturity_date,
        "tenure_days": inst.tenure_days,
        "interest_rate": inst.interest_rate,
        "purpose": inst.purpose,
        "status": inst.status,
        "trust_tier": inst.trust_tier,
        "risk_score": inst.risk_score,
        "risk_band": inst.risk_band,
        "days_to_maturity": days_to_mat,
        "parent_instrument_id": inst.parent_instrument_id,
        "provenance": prov_map,
        "documents": [
            {
                "id": d.id,
                "kind": d.kind,
                "sha256": d.sha256,
                "storage_key": d.storage_key,
                "created_at": d.created_at.strftime("%Y-%m-%d %H:%M")
            } for d in inst.documents
        ],
        "flags": [
            {
                "id": f.id,
                "code": f.code,
                "severity": f.severity,
                "explanation": f.explanation,
                "evidence": f.evidence,
                "status": f.status,
                "created_at": f.created_at.strftime("%Y-%m-%d %H:%M")
            } for f in inst.flags
        ],
        "verifications": [
            {
                "id": v.id,
                "method": v.method,
                "result": v.result,
                "created_at": v.created_at.strftime("%Y-%m-%d %H:%M")
            } for v in inst.verifications
        ],
        "observations": [
            {
                "id": o.id,
                "author": o.author.name if o.author else "Officer",
                "text": o.text,
                "created_at": o.created_at.strftime("%Y-%m-%d %H:%M")
            } for o in inst.observations
        ]
    }

@router.get("/{id}/forensics")
def get_forensic_details(
    id: int,
    db: Session = Depends(get_db)
):
    """
    Returns full visual forensic artifacts:
    - Scanned bank certificate document preview URL
    - Error Level Analysis (ELA) compression variance heatmap URL
    - Bank cryptographic QR payload and URL
    - Interactive OCR bounding boxes with confidence scores
    - Tamper and splicing anomaly detection results
    """
    try:
        return get_instrument_forensics(db, id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate forensic report: {str(e)}")

@router.post("")
def create_instrument(
    req: InstrumentCreate, 
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    inst = Instrument(
        institution_id=req.institution_id,
        bank_id=req.bank_id,
        fdr_number=req.fdr_number.strip(),
        amount=req.amount,
        issue_date=req.issue_date,
        maturity_date=req.maturity_date,
        tenure_days=req.tenure_days,
        interest_rate=req.interest_rate,
        purpose=req.purpose or "AICTE Mandatory Security Deposit",
        status=InstrumentStatusEnum.SUBMITTED.value,
        trust_tier=TrustTierEnum.SELF_DECLARED.value
    )
    db.add(inst)
    db.commit()
    db.refresh(inst)
    
    # Initialize Field Provenance
    fields = [
        ("fdr_number", inst.fdr_number),
        ("amount", str(inst.amount)),
        ("issue_date", inst.issue_date),
        ("maturity_date", inst.maturity_date),
        ("interest_rate", str(inst.interest_rate))
    ]
    for name, val in fields:
        prov = FieldProvenance(
            instrument_id=inst.id,
            field_name=name,
            value=val,
            source=ProvenanceSourceEnum.SELF_DECLARED.value,
            confidence=1.0
        )
        db.add(prov)
        
    db.commit()
    
    # Run initial rules
    evaluate_instrument_rules(db, inst)
    risk, band, _ = compute_instrument_risk_score(db, inst)
    inst.risk_score = risk
    inst.risk_band = band
    db.commit()
    
    actor_id = current_user.id if current_user else None
    actor_role = current_user.role if current_user else "institution_admin"
    log_audit_entry(db, "SUBMIT_FDR", "instrument", inst.id, {
        "fdr_number": inst.fdr_number,
        "amount": inst.amount,
        "institution_id": inst.institution_id
    }, actor_id, actor_role)
    
    return {"success": True, "id": inst.id, "message": "FDR instrument successfully submitted"}

@router.post("/{id}/documents")
async def upload_document(
    id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    inst = db.query(Instrument).filter(Instrument.id == id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Instrument not found")
        
    filename = f"fdr_{inst.id}_{file.filename}"
    doc_dir = os.path.join(settings.STORAGE_DIR, "documents")
    save_path = os.path.join(doc_dir, filename)
    
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    sha256 = compute_file_sha256(save_path)
    
    phash = None
    if save_path.lower().endswith(('.png', '.jpg', '.jpeg')):
        phash = compute_image_dhash(save_path)
        ela_out = os.path.join(settings.STORAGE_DIR, "ela", f"ela_{filename}.jpg")
        perform_error_level_analysis(save_path, ela_out)

    doc = Document(
        instrument_id=inst.id,
        kind="FDR_RECEIPT",
        storage_key=filename,
        sha256=sha256,
        phash=phash,
        mime=file.content_type or "application/pdf"
    )
    db.add(doc)
    db.commit()
    
    meta = inspect_pdf_metadata(save_path)
    if meta.get("is_suspicious"):
        f = Flag(
            instrument_id=inst.id,
            code="FORENSIC_UNAUTHORIZED_EDITOR",
            severity="HIGH",
            explanation=meta["explanation"],
            evidence=meta,
            status="open",
            raised_by="system"
        )
        db.add(f)
        
    evaluate_instrument_rules(db, inst)
    risk, band, _ = compute_instrument_risk_score(db, inst)
    inst.risk_score = risk
    inst.risk_band = band
    db.commit()
    
    log_audit_entry(db, "UPLOAD_DOCUMENT", "document", doc.id, {
        "instrument_id": inst.id,
        "filename": filename,
        "sha256": sha256
    })
    
    return {"success": True, "document_id": doc.id, "sha256": sha256}

@router.post("/{id}/observations")
async def add_observation(
    id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    inst = db.query(Instrument).filter(Instrument.id == id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Instrument not found")
        
    text_val = ""
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            body = await request.json()
            text_val = body.get("text", "")
        except Exception:
            text_val = ""
    else:
        try:
            form = await request.form()
            text_val = form.get("text", "")
        except Exception:
            text_val = ""
            
    if not text_val or not str(text_val).strip():
        raise HTTPException(status_code=400, detail="Observation text cannot be empty")
        
    author_id = current_user.id if current_user else 1
    obs = Observation(
        instrument_id=inst.id,
        author_id=author_id,
        text=str(text_val).strip()
    )
    db.add(obs)
    db.commit()
    
    log_audit_entry(db, "ADD_OBSERVATION", "observation", obs.id, {
        "instrument_id": inst.id,
        "author_id": author_id,
        "text": str(text_val).strip()[:100]
    })
    return {"success": True, "id": obs.id}
