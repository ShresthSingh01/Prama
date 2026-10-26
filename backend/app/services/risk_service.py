import math
from datetime import datetime
from typing import Dict, Any, Tuple
from sqlalchemy.orm import Session
from backend.app.models.entities import Instrument, Institution, Flag, FlagSeverityEnum
from backend.app.services.clock_service import get_simulated_now

SEVERITY_WEIGHTS = {
    FlagSeverityEnum.LOW.value: 5.0,
    FlagSeverityEnum.MEDIUM.value: 15.0,
    FlagSeverityEnum.HIGH.value: 30.0,
    FlagSeverityEnum.CRITICAL.value: 50.0
}

def compute_instrument_risk_score(db: Session, instrument: Instrument) -> Tuple[float, str, float]:
    """
    Computes multi-factor regulatory risk score (0-100), risk band, 
    and estimated probability of renewal lapse P(lapse).
    """
    simulated_now = get_simulated_now(db)
    
    # 1. Urgency factor (days to maturity)
    urgency_score = 0.0
    days_to_maturity = 999
    try:
        mat_date = datetime.strptime(instrument.maturity_date, "%Y-%m-%d")
        days_to_maturity = (mat_date.date() - simulated_now.date()).days
        if days_to_maturity < 0:
            urgency_score = 40.0  # Already overdue
        elif days_to_maturity <= 30:
            urgency_score = 35.0
        elif days_to_maturity <= 60:
            urgency_score = 25.0
        elif days_to_maturity <= 90:
            urgency_score = 15.0
        else:
            urgency_score = 5.0
    except Exception:
        urgency_score = 20.0
        
    # 2. Amount exposure factor (log-scaled)
    # 5L = 5.7, 50L = 6.7, 5Cr = 7.7
    log_amt = math.log10(max(instrument.amount, 100000))
    amt_factor = min(max((log_amt - 5.0) * 8.0, 0.0), 25.0)
    
    # 3. Open flags factor
    flags = db.query(Flag).filter(
        Flag.instrument_id == instrument.id,
        Flag.status == "open"
    ).all()
    flags_penalty = sum(SEVERITY_WEIGHTS.get(f.severity, 10.0) for f in flags)
    flags_factor = min(flags_penalty, 35.0)
    
    # 4. Institution compliance history factor
    inst = db.query(Institution).filter(Institution.id == instrument.institution_id).first()
    comp_score = inst.compliance_score if inst else 100.0
    delinquency_factor = max((100.0 - comp_score) * 0.2, 0.0)
    
    total_raw_risk = urgency_score + amt_factor + flags_factor + delinquency_factor
    final_score = min(max(round(total_raw_risk, 1), 0.0), 100.0)
    
    # Assign risk band
    if final_score >= 75.0 or any(f.severity == FlagSeverityEnum.CRITICAL.value for f in flags):
        band = "CRITICAL"
    elif final_score >= 50.0:
        band = "HIGH"
    elif final_score >= 25.0:
        band = "MEDIUM"
    else:
        band = "LOW"
        
    # P(lapse) estimation (survival proxy using logistic sigmoid)
    # Higher risk score and lower days remaining dramatically increase lapse probability
    logit = (final_score - 50.0) / 15.0 - (days_to_maturity / 60.0)
    p_lapse = 1.0 / (1.0 + math.exp(-logit))
    p_lapse = round(min(max(p_lapse, 0.01), 0.99), 2)
    
    return final_score, band, p_lapse
