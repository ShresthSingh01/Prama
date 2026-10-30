import re
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from backend.app.models.entities import (
    Instrument, Bank, Institution, Flag, 
    FlagSeverityEnum, Document, utc_now
)
from backend.app.core.crypto import hamming_distance
from backend.app.services.knowledge import get_rule_parameter

def evaluate_instrument_rules(db: Session, instrument: Instrument, ocr_data: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """Evaluates validation rules R01-R09 and returns newly raised flags."""
    new_flags = []
    
    bank = db.query(Bank).filter(Bank.id == instrument.bank_id).first()
    inst = db.query(Institution).filter(Institution.id == instrument.institution_id).first()
    
    # R01: FDR number format regex match
    if bank and bank.fdr_number_regex:
        if not re.match(bank.fdr_number_regex, instrument.fdr_number):
            new_flags.append({
                "code": "R01_INVALID_FDR_FORMAT",
                "severity": FlagSeverityEnum.HIGH.value,
                "explanation": f"FDR serial '{instrument.fdr_number}' does not match official {bank.name} regex standard ({bank.fdr_number_regex}). Possible invalid instrument.",
                "evidence": {"bank": bank.name, "regex": bank.fdr_number_regex, "fdr_number": instrument.fdr_number}
            })
            
    # R02: Maturity Date == Issue Date + Tenure
    try:
        issue_dt = datetime.strptime(instrument.issue_date, "%Y-%m-%d")
        expected_maturity = issue_dt + timedelta(days=instrument.tenure_days)
        actual_maturity = datetime.strptime(instrument.maturity_date, "%Y-%m-%d")
        diff_days = abs((actual_maturity - expected_maturity).days)
        tolerance_days = int(get_rule_parameter("R02", "tolerance_days", default=2))
        if diff_days > tolerance_days:
            new_flags.append({
                "code": "R02_TENURE_MATURITY_MISMATCH",
                "severity": FlagSeverityEnum.HIGH.value,
                "explanation": f"Declared tenure ({instrument.tenure_days} days) does not match maturity date. Expected ~{expected_maturity.strftime('%Y-%m-%d')}, declared {instrument.maturity_date} (variance: {diff_days} days, tolerance: {tolerance_days} days).",
                "evidence": {"issue_date": instrument.issue_date, "tenure_days": instrument.tenure_days, "expected": expected_maturity.strftime('%Y-%m-%d'), "declared": instrument.maturity_date, "tolerance_days": tolerance_days}
            })

        # Check statutory minimum lock-in (AICTE norms require minimum 5-8 years for technical institutions)
        min_lockin_days = int(get_rule_parameter("R02", "min_lockin_days", default=1825))
        if instrument.tenure_days < min_lockin_days:
            new_flags.append({
                "code": "R02_TENURE_BELOW_STATUTORY_MINIMUM",
                "severity": FlagSeverityEnum.HIGH.value,
                "explanation": f"Declared tenure of {instrument.tenure_days} days (~{round(instrument.tenure_days/365, 1)} years) is below mandatory AICTE statutory lock-in period ({min_lockin_days} days / ~5-8 years). Risk of premature encashment before academic cycle completion.",
                "evidence": {"tenure_days": instrument.tenure_days, "min_lockin_days": min_lockin_days}
            })
    except Exception as e:
        new_flags.append({
            "code": "R02_DATE_PARSE_ERROR",
            "severity": FlagSeverityEnum.MEDIUM.value,
            "explanation": f"Failed to parse issue or maturity dates: {str(e)}",
            "evidence": {"issue_date": instrument.issue_date, "maturity_date": instrument.maturity_date}
        })
        
    # R03: Minimum security deposit requirement (AICTE handbook parameter binding)
    min_amount = float(get_rule_parameter("R03", "min_amount", default=500000.0))
    if instrument.amount < min_amount:
        new_flags.append({
            "code": "R03_INSUFFICIENT_SECURITY_AMOUNT",
            "severity": FlagSeverityEnum.HIGH.value,
            "explanation": f"Deposit amount of Rs {instrument.amount:,.2f} is below mandatory AICTE regulatory baseline (Rs {min_amount:,.2f}).",
            "evidence": {"amount": instrument.amount, "minimum_required": min_amount}
        })

    # R04: Plausible interest rate band (from OKF rule parameters)
    min_rate = float(get_rule_parameter("R04", "min_rate", default=3.0))
    max_rate = float(get_rule_parameter("R04", "max_rate", default=9.5))
    if instrument.interest_rate < min_rate or instrument.interest_rate > max_rate:
        new_flags.append({
            "code": "R04_IMPLAUSIBLE_INTEREST_RATE",
            "severity": FlagSeverityEnum.MEDIUM.value,
            "explanation": f"Declared interest rate of {instrument.interest_rate}% is outside commercial bank regulatory bounds ({min_rate}% - {max_rate}%).",
            "evidence": {"interest_rate": instrument.interest_rate, "valid_range": f"{min_rate}% - {max_rate}%"}
        })

    # R05: Dates plausible (issue date not in distant future)
    try:
        now_dt = utc_now()
        issue_dt = datetime.strptime(instrument.issue_date, "%Y-%m-%d")
        if issue_dt > now_dt + timedelta(days=1):
            new_flags.append({
                "code": "R05_FUTURE_ISSUE_DATE",
                "severity": FlagSeverityEnum.HIGH.value,
                "explanation": f"Instrument issue date ({instrument.issue_date}) is in the future relative to system clock.",
                "evidence": {"issue_date": instrument.issue_date}
            })
    except Exception:
        pass

    # R08: Duplicate Detection Across Different Institutions (CRITICAL FRAUD RING CHECK)
    # Check 1: Same bank + same FDR number
    duplicate_fdr = db.query(Instrument).filter(
        Instrument.bank_id == instrument.bank_id,
        Instrument.fdr_number == instrument.fdr_number,
        Instrument.institution_id != instrument.institution_id
    ).first()
    
    if duplicate_fdr:
        colluding_inst = db.query(Institution).filter(Institution.id == duplicate_fdr.institution_id).first()
        inst_name = colluding_inst.name if colluding_inst else f"Institution #{duplicate_fdr.institution_id}"
        new_flags.append({
            "code": "R08_CROSS_INSTITUTION_DUPLICATE_FDR",
            "severity": FlagSeverityEnum.CRITICAL.value,
            "explanation": f"CRITICAL: FDR serial number '{instrument.fdr_number}' is already pledged by another institution: '{inst_name}' (AICTE ID: {colluding_inst.aicte_id if colluding_inst else 'N/A'})! Probable syndicated collusion.",
            "evidence": {
                "conflicting_instrument_id": duplicate_fdr.id,
                "conflicting_institution": inst_name,
                "conflicting_aicte_id": colluding_inst.aicte_id if colluding_inst else None,
                "fdr_number": instrument.fdr_number
            }
        })
        
    # Check 2: Same document SHA-256 or perceptual hash match across institutions
    current_docs = db.query(Document).filter(Document.instrument_id == instrument.id).all()
    for doc in current_docs:
        dup_doc = db.query(Document).join(Instrument).filter(
            Document.sha256 == doc.sha256,
            Instrument.institution_id != instrument.institution_id
        ).first()
        if dup_doc:
            conflicting_inst = db.query(Institution).filter(Institution.id == dup_doc.instrument.institution_id).first()
            new_flags.append({
                "code": "R08_IDENTICAL_DOCUMENT_HASH_REUSE",
                "severity": FlagSeverityEnum.CRITICAL.value,
                "explanation": f"CRITICAL: Identical binary document hash ({doc.sha256[:12]}...) was submitted by '{conflicting_inst.name if conflicting_inst else 'Another Institute'}'. Exact same PDF uploaded for two different institutes.",
                "evidence": {
                    "sha256": doc.sha256,
                    "conflicting_institution": conflicting_inst.name if conflicting_inst else None
                }
            })

        # Check 3: Perceptual hash similarity (near-duplicate scanned documents)
        if doc.phash and doc.phash != ("0" * 16):
            other_docs = db.query(Document).join(Instrument).filter(
                Document.phash.isnot(None),
                Document.id != doc.id,
                Instrument.institution_id != instrument.institution_id
            ).limit(50).all()
            for other in other_docs:
                if other.phash and other.phash != ("0" * 16):
                    dist = hamming_distance(doc.phash, other.phash)
                    if dist <= 5:
                        conflicting_inst = db.query(Institution).filter(Institution.id == other.instrument.institution_id).first()
                        new_flags.append({
                            "code": "R08_PERCEPTUAL_NEAR_DUPLICATE_DOCUMENT",
                            "severity": FlagSeverityEnum.CRITICAL.value,
                            "explanation": f"CRITICAL: Visual layout of document strongly matches an instrument uploaded by '{conflicting_inst.name if conflicting_inst else 'Another Institute'}' (Hamming Distance: {dist}/64). Potential counterfeit template reuse.",
                            "evidence": {
                                "distance": dist,
                                "conflicting_institution": conflicting_inst.name if conflicting_inst else None
                            }
                        })
                        break
            
    # Save newly generated flags to DB
    for flag_data in new_flags:
        # Check if already raised
        exists = db.query(Flag).filter(
            Flag.instrument_id == instrument.id,
            Flag.code == flag_data["code"]
        ).first()
        if not exists:
            f = Flag(
                instrument_id=instrument.id,
                code=flag_data["code"],
                severity=flag_data["severity"],
                explanation=flag_data["explanation"],
                evidence=flag_data["evidence"],
                status="open",
                raised_by="system"
            )
            db.add(f)
            
    db.commit()
    return new_flags
