import enum
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, ForeignKey, 
    Text, Boolean, JSON, Index, func
)
from sqlalchemy.orm import relationship
from backend.app.models.database import Base

class RoleEnum(str, enum.Enum):
    INSTITUTION_ADMIN = "institution_admin"
    SCRUTINY_OFFICER = "scrutiny_officer"  # Maker
    SENIOR_OFFICER = "senior_officer"      # Checker/Approver
    BANK_OFFICER = "bank_officer"
    ADMIN = "admin"

class InstrumentStatusEnum(str, enum.Enum):
    SUBMITTED = "SUBMITTED"
    AUTO_CHECKED = "AUTO_CHECKED"
    UNDER_SCRUTINY = "UNDER_SCRUTINY"
    VERIFIED = "VERIFIED"
    ACTIVE = "ACTIVE"
    EXPIRING = "EXPIRING"
    MATURED = "MATURED"
    RENEWED = "RENEWED"
    RELEASE_REQUESTED = "RELEASE_REQUESTED"
    RELEASE_APPROVED = "RELEASE_APPROVED"
    RELEASED = "RELEASED"
    FLAGGED = "FLAGGED"
    REJECTED = "REJECTED"
    OVERDUE = "OVERDUE"

class TrustTierEnum(str, enum.Enum):
    SELF_DECLARED = "SELF_DECLARED"
    DOC_EXTRACTED = "DOC_EXTRACTED"
    CROSS_VALIDATED = "CROSS_VALIDATED"
    BANK_CONFIRMED = "BANK_CONFIRMED"

class ProvenanceSourceEnum(str, enum.Enum):
    SELF_DECLARED = "self_declared"
    OCR_EXTRACTED = "ocr_extracted"
    CROSS_VALIDATED = "cross_validated"
    BANK_CONFIRMED = "bank_confirmed"

class FlagSeverityEnum(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default=RoleEnum.INSTITUTION_ADMIN.value)
    institution_id = Column(Integer, ForeignKey("institutions.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    institution = relationship("Institution", back_populates="users")

class Institution(Base):
    __tablename__ = "institutions"
    
    id = Column(Integer, primary_key=True, index=True)
    aicte_id = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    state = Column(String(100), nullable=False)
    district = Column(String(100), nullable=False)
    email = Column(String(150), nullable=False)
    phone = Column(String(50), nullable=True)
    compliance_score = Column(Float, default=100.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="institution")
    instruments = relationship("Instrument", back_populates="institution")

class Bank(Base):
    __tablename__ = "banks"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    ifsc_prefix = Column(String(10), nullable=False, index=True)
    fdr_number_regex = Column(String(100), nullable=False)
    layout_fingerprint = Column(JSON, nullable=True)
    public_key = Column(String(128), nullable=False)   # Ed25519 public key in hex
    private_key = Column(String(128), nullable=True)  # Ed25519 private key for mock issuance
    created_at = Column(DateTime, default=datetime.utcnow)

    instruments = relationship("Instrument", back_populates="bank")

class Instrument(Base):
    __tablename__ = "instruments"
    
    id = Column(Integer, primary_key=True, index=True)
    institution_id = Column(Integer, ForeignKey("institutions.id"), nullable=False, index=True)
    bank_id = Column(Integer, ForeignKey("banks.id"), nullable=False, index=True)
    fdr_number = Column(String(100), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    issue_date = Column(String(20), nullable=False)
    maturity_date = Column(String(20), nullable=False, index=True)
    tenure_days = Column(Integer, nullable=False)
    interest_rate = Column(Float, nullable=False)
    purpose = Column(String(255), default="AICTE Mandatory Security Deposit")
    status = Column(String(50), default=InstrumentStatusEnum.SUBMITTED.value, index=True)
    trust_tier = Column(String(50), default=TrustTierEnum.SELF_DECLARED.value, index=True)
    risk_score = Column(Float, default=0.0)
    risk_band = Column(String(20), default="LOW")
    parent_instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=True)
    lien_marked = Column(Boolean, default=False, nullable=True)
    joint_holding_confirmed = Column(Boolean, default=False, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    institution = relationship("Institution", back_populates="instruments")
    bank = relationship("Bank", back_populates="instruments")
    provenance_fields = relationship("FieldProvenance", back_populates="instrument", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="instrument", cascade="all, delete-orphan")
    flags = relationship("Flag", back_populates="instrument", cascade="all, delete-orphan")
    verifications = relationship("Verification", back_populates="instrument", cascade="all, delete-orphan")
    reminders = relationship("Reminder", back_populates="instrument", cascade="all, delete-orphan")
    release_requests = relationship("ReleaseRequest", back_populates="instrument", cascade="all, delete-orphan")
    observations = relationship("Observation", back_populates="instrument", cascade="all, delete-orphan")
    parent = relationship("Instrument", remote_side=[id], backref="renewals")

class FieldProvenance(Base):
    __tablename__ = "field_provenance"
    
    id = Column(Integer, primary_key=True, index=True)
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=False, index=True)
    field_name = Column(String(50), nullable=False)
    value = Column(String(255), nullable=True)
    source = Column(String(50), default=ProvenanceSourceEnum.SELF_DECLARED.value)
    confidence = Column(Float, default=1.0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    instrument = relationship("Instrument", back_populates="provenance_fields")

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=False, index=True)
    kind = Column(String(50), default="FDR_RECEIPT")
    storage_key = Column(String(255), nullable=False)
    sha256 = Column(String(64), nullable=False, index=True)
    phash = Column(String(32), nullable=True, index=True)
    mime = Column(String(50), default="application/pdf")
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    instrument = relationship("Instrument", back_populates="documents")
    ocr_result = relationship("OcrResult", uselist=False, back_populates="document", cascade="all, delete-orphan")

class OcrResult(Base):
    __tablename__ = "ocr_results"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False, unique=True)
    raw_text = Column(Text, nullable=True)
    fields = Column(JSON, nullable=True)
    boxes = Column(JSON, nullable=True)
    engine = Column(String(50), default="PyMuPDF+Regex")
    slm_fields = Column(JSON, nullable=True)
    slm_model = Column(String(100), nullable=True)
    slm_latency_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="ocr_result")

class Flag(Base):
    __tablename__ = "flags"
    
    id = Column(Integer, primary_key=True, index=True)
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=False, index=True)
    code = Column(String(50), nullable=False)
    severity = Column(String(20), default=FlagSeverityEnum.MEDIUM.value)
    explanation = Column(Text, nullable=False)
    explanation_text = Column(Text, nullable=True)
    explanation_text_hi = Column(Text, nullable=True)
    evidence = Column(JSON, nullable=True)
    status = Column(String(20), default="open")  # open, resolved, dismissed
    raised_by = Column(String(50), default="system")
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    instrument = relationship("Instrument", back_populates="flags")

class Verification(Base):
    __tablename__ = "verifications"
    
    id = Column(Integer, primary_key=True, index=True)
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=False, index=True)
    method = Column(String(50), nullable=False)  # signed_qr, verify_link, manual
    result = Column(String(50), nullable=False)  # confirmed, denied, pending, failed
    token_hash = Column(String(64), nullable=True, index=True)
    expires_at = Column(DateTime, nullable=True)
    responded_at = Column(DateTime, nullable=True)
    responder_email = Column(String(150), nullable=True)
    evidence = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    instrument = relationship("Instrument", back_populates="verifications")

class ReminderRule(Base):
    __tablename__ = "reminder_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    days_before = Column(Integer, nullable=False)
    level = Column(Integer, default=1)  # 1: Institution, 2: Scrutiny Officer, 3: Senior Officer
    channel = Column(String(50), default="EMAIL")
    recipient_role = Column(String(50), default="institution_admin")
    active = Column(Boolean, default=True)

class Reminder(Base):
    __tablename__ = "reminders"
    
    id = Column(Integer, primary_key=True, index=True)
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=False, index=True)
    rule_id = Column(Integer, ForeignKey("reminder_rules.id"), nullable=True)
    due_at = Column(DateTime, nullable=False)
    sent_at = Column(DateTime, nullable=True)
    channel = Column(String(50), default="EMAIL")
    level = Column(Integer, default=1)
    status = Column(String(50), default="SENT")
    recipient = Column(String(150), nullable=True)
    message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    instrument = relationship("Instrument", back_populates="reminders")
    rule = relationship("ReminderRule")

class ReleaseRequest(Base):
    __tablename__ = "release_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=False, index=True)
    requested_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(50), default="submitted")  # submitted, precheck_failed, under_review, approved, rejected, released
    maker_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    checker_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    remarks = Column(Text, nullable=True)
    certificate_url = Column(String(255), nullable=True)
    certificate_hash = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    decided_at = Column(DateTime, nullable=True)

    instrument = relationship("Instrument", back_populates="release_requests")

class Observation(Base):
    __tablename__ = "observations"
    
    id = Column(Integer, primary_key=True, index=True)
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    instrument = relationship("Instrument", back_populates="observations")
    author = relationship("User")

class AuditLog(Base):
    __tablename__ = "audit_log"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ts = Column(DateTime, default=datetime.utcnow, nullable=False)
    actor_id = Column(Integer, nullable=True)
    actor_role = Column(String(50), nullable=True)
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False, index=True)
    entity_id = Column(Integer, nullable=False, index=True)
    payload = Column(JSON, nullable=False)
    prev_hash = Column(String(64), nullable=False)
    hash = Column(String(64), nullable=False, index=True)

class SystemClock(Base):
    __tablename__ = "system_clock"
    
    id = Column(Integer, primary_key=True)
    offset_days = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class EvalRun(Base):
    __tablename__ = "eval_runs"
    
    id = Column(Integer, primary_key=True, index=True)
    dataset = Column(String(100), nullable=False)
    tp = Column(Integer, default=0)
    fp = Column(Integer, default=0)
    tn = Column(Integer, default=0)
    fn = Column(Integer, default=0)
    precision = Column(Float, default=0.0)
    recall = Column(Float, default=0.0)
    f1 = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

class DocIndexCache(Base):
    __tablename__ = "doc_index_cache"
    
    id = Column(Integer, primary_key=True, index=True)
    doc_title = Column(String(255), nullable=False)
    file_sha256 = Column(String(64), nullable=False, index=True)
    doc_id = Column(String(100), nullable=False, index=True)
    tree = Column(JSON, nullable=False)
    built_with = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class CopilotQuery(Base):
    __tablename__ = "copilot_queries"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    instrument_id = Column(Integer, nullable=True)
    question = Column(Text, nullable=False)
    cited = Column(JSON, nullable=True)
    answer = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class EvalSlmRun(Base):
    __tablename__ = "eval_slm_runs"
    
    id = Column(Integer, primary_key=True, index=True)
    model = Column(String(100), nullable=False)
    provider = Column(String(50), default="gemini")
    task = Column(String(100), nullable=False)
    metrics = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
