from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    institution_id: Optional[int] = None

class InstitutionOut(BaseModel):
    id: int
    aicte_id: str
    name: str
    state: str
    district: str
    compliance_score: float

class ProvenanceFieldOut(BaseModel):
    field_name: str
    value: Optional[str]
    source: str
    confidence: float
    updated_at: str

class FlagOut(BaseModel):
    id: int
    code: str
    severity: str
    explanation: str
    evidence: Optional[Dict[str, Any]]
    status: str
    created_at: str

class InstrumentOut(BaseModel):
    id: int
    institution_id: int
    institution_name: str
    bank_id: int
    bank_name: str
    fdr_number: str
    amount: float
    issue_date: str
    maturity_date: str
    tenure_days: int
    interest_rate: float
    status: str
    trust_tier: str
    risk_score: float
    risk_band: str
    days_to_maturity: int

class InstrumentCreate(BaseModel):
    institution_id: int
    bank_id: int
    fdr_number: str
    amount: float
    issue_date: str
    maturity_date: str
    tenure_days: int
    interest_rate: float
    purpose: Optional[str] = "AICTE Mandatory Security Deposit"

class VerifyQRRequest(BaseModel):
    qr_content: str

class BankConfirmRequest(BaseModel):
    decision: str  # confirmed, denied
    remarks: Optional[str] = None
    officer_email: str

class ReleaseRequestCreate(BaseModel):
    reason: str

class ReleaseDecision(BaseModel):
    decision: str  # approved, rejected
    remarks: Optional[str] = None

class AdvanceClockRequest(BaseModel):
    days: int = 30
