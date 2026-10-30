import os
import re
import uuid
import shutil
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload, selectinload
from backend.app.models.database import get_db
from backend.app.models.entities import (
    Instrument, Institution, Bank, Document, FieldProvenance,
    Flag, Verification, Observation, User, InstrumentStatusEnum,
    TrustTierEnum, ProvenanceSourceEnum, OcrResult
)
from backend.app.core.config import settings
from backend.app.core.crypto import compute_file_sha256, compute_image_dhash
from backend.app.services.clock_service import get_simulated_now
from backend.app.services.audit_service import log_audit_entry
from backend.app.services.rules_engine import evaluate_instrument_rules
from backend.app.services.risk_service import compute_instrument_risk_score
from backend.app.services.forensic_service import (
    perform_error_level_analysis, inspect_pdf_metadata,
    get_instrument_forensics
)
from backend.app.services.extraction_service import extract_from_document
from backend.app.services.certificate_service import generate_deficiency_notice
from backend.app.schemas.api_schemas import InstrumentCreate, ManualVerifyRequest
from backend.app.api.auth import get_optional_user, get_current_user, check_institution_access

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
            "lien_marked": bool(inst.lien_marked) if inst.lien_marked is not None else False,
            "joint_holding_confirmed": bool(inst.joint_holding_confirmed) if inst.joint_holding_confirmed is not None else False,
            "flags_count": len([f for f in inst.flags if f.status == 'open'])
        })
    return items

@router.get("/{id}")
def get_instrument_detail(
    id: int, 
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    inst = db.query(Instrument).options(
        joinedload(Instrument.institution),
        joinedload(Instrument.bank),
        selectinload(Instrument.provenance_fields),
        selectinload(Instrument.documents).selectinload(Document.ocr_result),
        selectinload(Instrument.flags),
        selectinload(Instrument.verifications)
    ).filter(Instrument.id == id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Instrument not found")
        
    if current_user:
        check_institution_access(current_user, inst.institution_id)
        
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

    # Lineage computation (parent and renewals)
    parent_info = None
    if inst.parent_instrument_id:
        p = db.query(Instrument).filter(Instrument.id == inst.parent_instrument_id).first()
        if p:
            parent_info = {
                "id": p.id,
                "fdr_number": p.fdr_number,
                "status": p.status,
                "amount": p.amount,
                "amount_lakhs": round(p.amount / 100000.0, 2),
                "maturity_date": p.maturity_date
            }

    renewals = db.query(Instrument).filter(Instrument.parent_instrument_id == inst.id).order_by(Instrument.id.asc()).all()
    renewals_info = [
        {
            "id": c.id,
            "fdr_number": c.fdr_number,
            "status": c.status,
            "amount": c.amount,
            "amount_lakhs": round(c.amount / 100000.0, 2),
            "issue_date": c.issue_date,
            "maturity_date": c.maturity_date
        }
        for c in renewals
    ]
        
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
        "lien_marked": bool(inst.lien_marked) if inst.lien_marked is not None else False,
        "joint_holding_confirmed": bool(inst.joint_holding_confirmed) if inst.joint_holding_confirmed is not None else False,
        "parent_instrument_id": inst.parent_instrument_id,
        "lineage": {
            "parent": parent_info,
            "renewals": renewals_info
        },
        "provenance": prov_map,
        "documents": [
            {
                "id": d.id,
                "kind": d.kind,
                "sha256": d.sha256,
                "storage_key": d.storage_key,
                "created_at": d.created_at.strftime("%Y-%m-%d %H:%M"),
                "ocr_extracted": bool(d.ocr_result and d.ocr_result.fields),
                "extracted_fields": d.ocr_result.fields if d.ocr_result else None
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
    target_institution_id = req.institution_id
    if current_user and current_user.role == "institution_admin":
        target_institution_id = current_user.institution_id or req.institution_id

    inst = Instrument(
        institution_id=target_institution_id,
        bank_id=req.bank_id,
        fdr_number=req.fdr_number.strip(),
        amount=req.amount,
        issue_date=req.issue_date,
        maturity_date=req.maturity_date,
        tenure_days=req.tenure_days,
        interest_rate=req.interest_rate,
        purpose=req.purpose or "AICTE Mandatory Security Deposit",
        lien_marked=bool(req.lien_marked),
        joint_holding_confirmed=bool(req.joint_holding_confirmed),
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
    open_flags = [f for f in inst.flags if f.status == "open"]
    if open_flags and inst.status in [InstrumentStatusEnum.SUBMITTED.value, InstrumentStatusEnum.ACTIVE.value]:
        inst.status = InstrumentStatusEnum.FLAGGED.value
    db.commit()
    db.commit()
    
    actor_id = current_user.id if current_user else 1
    actor_role = current_user.role if current_user else "institution_admin"
    log_audit_entry(db, "SUBMIT_FDR", "instrument", inst.id, {
        "fdr_number": inst.fdr_number,
        "amount": inst.amount,
        "institution_id": inst.institution_id
    }, actor_id, actor_role)
    
    return {"success": True, "id": inst.id, "message": "FDR instrument successfully submitted"}

@router.post("/{id}/renew")
def renew_instrument(
    id: int,
    req: InstrumentCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """
    Submits a renewed / replacement FDR instrument, preserving complete parent-child lineage.
    Mandated by AICTE PS 26265 Renewal & Replacement Monitoring.
    """
    parent = db.query(Instrument).filter(Instrument.id == id).first()
    if not parent:
        raise HTTPException(status_code=404, detail="Parent instrument not found")
        
    if current_user:
        check_institution_access(current_user, parent.institution_id)
        
    if parent.status in [InstrumentStatusEnum.RENEWED.value, InstrumentStatusEnum.RELEASED.value]:
        raise HTTPException(status_code=400, detail=f"Cannot renew an instrument that is already {parent.status}")
        
    child = Instrument(
        institution_id=parent.institution_id,
        bank_id=req.bank_id or parent.bank_id,
        fdr_number=req.fdr_number.strip(),
        amount=req.amount or parent.amount,
        issue_date=req.issue_date,
        maturity_date=req.maturity_date,
        tenure_days=req.tenure_days,
        interest_rate=req.interest_rate,
        purpose=req.purpose or f"Renewal/Replacement of FDR #{parent.fdr_number}",
        status=InstrumentStatusEnum.SUBMITTED.value,
        trust_tier=TrustTierEnum.SELF_DECLARED.value,
        parent_instrument_id=parent.id
    )
    db.add(child)
    parent.status = InstrumentStatusEnum.RENEWED.value
    db.commit()
    db.refresh(child)
    
    # Initialize child provenance fields
    fields = [
        ("fdr_number", child.fdr_number),
        ("amount", str(child.amount)),
        ("issue_date", child.issue_date),
        ("maturity_date", child.maturity_date),
        ("interest_rate", str(child.interest_rate))
    ]
    for name, val in fields:
        prov = FieldProvenance(
            instrument_id=child.id,
            field_name=name,
            value=val,
            source=ProvenanceSourceEnum.SELF_DECLARED.value,
            confidence=1.0
        )
        db.add(prov)
    db.commit()
    
    evaluate_instrument_rules(db, child)
    risk, band, _ = compute_instrument_risk_score(db, child)
    child.risk_score = risk
    child.risk_band = band
    db.commit()
    
    actor_id = current_user.id if current_user else 1
    actor_role = current_user.role if current_user else "institution_admin"
    log_audit_entry(db, "RENEW_INSTRUMENT", "instrument", child.id, {
        "parent_instrument_id": parent.id,
        "new_fdr_number": child.fdr_number,
        "amount": child.amount,
        "maturity_date": child.maturity_date
    }, actor_id, actor_role)
    
    return {
        "success": True,
        "parent_id": parent.id,
        "renewed_instrument_id": child.id,
        "message": f"Instrument renewed successfully. Linked to parent FDR #{parent.fdr_number}."
    }

@router.post("/{id}/documents")
async def upload_document(
    id: int,
    file: UploadFile = File(...),
    kind: str = Form("FDR_RECEIPT"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """
    Uploads an original FDR receipt or supporting record.
    Performs secure key generation, SHA-256 digesting, text/field extraction,
    and automatic discrepancy checks against declared form data.
    """
    inst = db.query(Instrument).filter(Instrument.id == id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Instrument not found")
        
    if current_user:
        check_institution_access(current_user, inst.institution_id)
        
    doc_dir = os.path.join(settings.STORAGE_DIR, "documents")
    os.makedirs(doc_dir, exist_ok=True)
    
    safe_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', file.filename or "receipt.pdf")
    storage_key = f"doc_{inst.id}_{uuid.uuid4().hex[:10]}_{safe_name}"
    save_path = os.path.join(doc_dir, storage_key)
    
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    sha256 = compute_file_sha256(save_path)
    
    phash = None
    if save_path.lower().endswith(('.png', '.jpg', '.jpeg')):
        phash = compute_image_dhash(save_path)
        ela_dir = os.path.join(settings.STORAGE_DIR, "ela")
        os.makedirs(ela_dir, exist_ok=True)
        ela_out = os.path.join(ela_dir, f"ela_{storage_key}.jpg")
        perform_error_level_analysis(save_path, ela_out)

    uploaded_by = current_user.id if current_user else None
    doc = Document(
        instrument_id=inst.id,
        kind=kind,
        storage_key=storage_key,
        sha256=sha256,
        phash=phash,
        mime=file.content_type or "application/pdf",
        uploaded_by=uploaded_by
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    
    # Execute Document Text & Field Extraction
    extraction = extract_from_document(save_path)
    
    ocr = OcrResult(
        document_id=doc.id,
        raw_text=extraction.get("raw_text", ""),
        fields=extraction.get("fields", {}),
        engine=extraction.get("engine", "pypdf+regex_v2")
    )
    db.add(ocr)
    
    # Provenance Upgrade to DOC_EXTRACTED
    extracted_fields = extraction.get("fields", {})
    if extraction.get("success"):
        for prov in inst.provenance_fields:
            if prov.field_name in extracted_fields and extracted_fields[prov.field_name] is not None:
                prov.source = ProvenanceSourceEnum.OCR_EXTRACTED.value
                prov.confidence = extraction.get("field_confidence", {}).get(prov.field_name, 0.90)
        if inst.trust_tier == TrustTierEnum.SELF_DECLARED.value:
            inst.trust_tier = TrustTierEnum.DOC_EXTRACTED.value

    # Reconcile Form vs Document Data -> Flag Discrepancies
    if extracted_fields.get("amount") is not None:
        doc_amt = float(extracted_fields["amount"])
        if abs(doc_amt - inst.amount) > 1.0:
            f = Flag(
                instrument_id=inst.id,
                code="FORM_DOC_AMOUNT_DISCREPANCY",
                severity="HIGH",
                explanation=f"Amount Discrepancy: Pledging institution declared Rs {inst.amount:,.2f}, but uploaded bank receipt shows Rs {doc_amt:,.2f}.",
                evidence={"form_amount": inst.amount, "extracted_amount": doc_amt, "document_id": doc.id},
                status="open",
                raised_by="system"
            )
            db.add(f)
            inst.status = InstrumentStatusEnum.FLAGGED.value

    if extracted_fields.get("fdr_number") is not None:
        clean_ext = re.sub(r'[^A-Za-z0-9]', '', str(extracted_fields["fdr_number"])).upper()
        clean_dec = re.sub(r'[^A-Za-z0-9]', '', inst.fdr_number).upper()
        if clean_ext and clean_dec and clean_ext != clean_dec:
            f = Flag(
                instrument_id=inst.id,
                code="FORM_DOC_SERIAL_MISMATCH",
                severity="HIGH",
                explanation=f"FDR Serial Mismatch: Form serial '{inst.fdr_number}' does not match document serial '{extracted_fields['fdr_number']}'.",
                evidence={"form_fdr": inst.fdr_number, "extracted_fdr": extracted_fields["fdr_number"], "document_id": doc.id},
                status="open",
                raised_by="system"
            )
            db.add(f)
            inst.status = InstrumentStatusEnum.FLAGGED.value

    # Metadata Check
    meta = inspect_pdf_metadata(save_path)
    if meta.get("is_suspicious"):
        f = Flag(
            instrument_id=inst.id,
            code="FORENSIC_UNAUTHORIZED_EDITOR",
            severity="HIGH",
            explanation=meta.get("explanation", "Suspicious editor tool used"),
            evidence=meta,
            status="open",
            raised_by="system"
        )
        db.add(f)
        inst.status = InstrumentStatusEnum.FLAGGED.value
        
    evaluate_instrument_rules(db, inst)
    risk, band, _ = compute_instrument_risk_score(db, inst)
    inst.risk_score = risk
    inst.risk_band = band
    open_flags = [f for f in inst.flags if f.status == "open"]
    if open_flags and inst.status in [InstrumentStatusEnum.SUBMITTED.value, InstrumentStatusEnum.ACTIVE.value]:
        inst.status = InstrumentStatusEnum.FLAGGED.value
    db.commit()
    
    actor_id = current_user.id if current_user else 1
    actor_role = current_user.role if current_user else "institution_admin"
    log_audit_entry(db, "UPLOAD_DOCUMENT", "document", doc.id, {
        "instrument_id": inst.id,
        "storage_key": storage_key,
        "sha256": sha256,
        "extracted_fields": extracted_fields
    }, actor_id, actor_role)
    
    return {
        "success": True, 
        "document_id": doc.id, 
        "sha256": sha256,
        "storage_key": storage_key,
        "extracted_fields": extracted_fields,
        "ocr_extracted": extraction.get("success", False),
        "extraction_success": extraction.get("success", False)
    }

@router.get("/{id}/documents/{doc_id}/download")
def download_document(
    id: int,
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """Secure, authorized download endpoint for uploaded institutional documents."""
    inst = db.query(Instrument).filter(Instrument.id == id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Instrument not found")
        
    if current_user:
        check_institution_access(current_user, inst.institution_id)
        
    doc = db.query(Document).filter(Document.id == doc_id, Document.instrument_id == inst.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    doc_path = os.path.join(settings.STORAGE_DIR, "documents", doc.storage_key)
    if not os.path.exists(doc_path):
        raise HTTPException(status_code=404, detail="Document file not found on disk")
        
    return FileResponse(
        path=doc_path,
        media_type=doc.mime or "application/octet-stream",
        filename=doc.storage_key
    )

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
    }, author_id, current_user.role if current_user else "officer")
    return {"success": True, "id": obs.id}

@router.get("/{id}/deficiency-notice")
@router.post("/{id}/deficiency-notice")
def download_deficiency_notice(
    id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """
    Generates and returns an official, printable statutory AICTE Notice of Deficiency & Rectification Directive
    for an FDR with discrepancies, upcoming maturity, or flagged irregularities.
    """
    inst = db.query(Instrument).options(
        joinedload(Instrument.institution),
        joinedload(Instrument.bank),
        selectinload(Instrument.flags)
    ).filter(Instrument.id == id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Instrument not found")

    officer_name = current_user.name if current_user else "P. S. Narayanan"
    pdf_path = generate_deficiency_notice(db, inst, officer_name=officer_name)

    actor_id = current_user.id if current_user else 1
    actor_role = current_user.role if current_user else "scrutiny_officer"
    log_audit_entry(db, "ISSUE_DEFICIENCY_NOTICE", "instrument", inst.id, {
        "fdr_number": inst.fdr_number,
        "institution_id": inst.institution_id,
        "officer": officer_name
    }, actor_id, actor_role)

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=f"AICTE_Deficiency_Notice_{inst.fdr_number}.pdf"
    )

@router.post("/{id}/verify/manual")
def record_manual_bank_verification(
    id: int,
    payload: ManualVerifyRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """
    Records an official physical bank confirmation letter (e.g. Speed Post dispatch or branch endorsement).
    Upgrades trust tier to BANK_CONFIRMED, moves status to VERIFIED, and logs to Merkle audit trail.
    """
    inst = db.query(Instrument).filter(Instrument.id == id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Instrument not found")

    user_id = current_user.id if current_user else 1
    user_role = current_user.role if current_user else "scrutiny_officer"
    user_name = current_user.name if current_user else "Statutory Scrutiny Officer"

    ver = Verification(
        instrument_id=inst.id,
        method="manual",
        result="valid",
        responder_email=current_user.email if current_user else "attestation@aicte.gov.in",
        responded_at=datetime.utcnow(),
        evidence={
            "dispatch_reference": payload.dispatch_reference,
            "confirmation_date": payload.confirmation_date,
            "officer_remarks": payload.officer_remarks or "Physical bank confirmation letter verified on record.",
            "attesting_officer": user_name,
            "method": "manual_speed_post_attestation"
        }
    )
    db.add(ver)

    inst.trust_tier = TrustTierEnum.BANK_CONFIRMED.value
    if inst.status in [InstrumentStatusEnum.SUBMITTED.value, InstrumentStatusEnum.UNDER_SCRUTINY.value]:
        inst.status = InstrumentStatusEnum.VERIFIED.value

    compute_instrument_risk_score(db, inst)

    log_audit_entry(
        db,
        action="MANUAL_BANK_VERIFICATION",
        entity_type="instrument",
        entity_id=inst.id,
        payload={
            "fdr_number": inst.fdr_number,
            "dispatch_reference": payload.dispatch_reference,
            "confirmation_date": payload.confirmation_date,
            "remarks": payload.officer_remarks
        },
        actor_id=user_id,
        actor_role=user_role
    )
    db.commit()
    db.refresh(inst)

    return {
        "success": True,
        "instrument_id": inst.id,
        "trust_tier": inst.trust_tier,
        "status": inst.status,
        "verification_id": ver.id
    }

