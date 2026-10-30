from datetime import datetime, timedelta
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from backend.app.models.entities import (
    SystemClock, Instrument, InstrumentStatusEnum, 
    Reminder, ReminderRule, AuditLog, utc_now
)
from backend.app.services.audit_service import log_audit_entry

def get_system_clock(db: Session) -> SystemClock:
    clock = db.query(SystemClock).filter(SystemClock.id == 1).first()
    if not clock:
        clock = SystemClock(id=1, offset_days=0)
        db.add(clock)
        db.commit()
        db.refresh(clock)
    return clock

def get_simulated_now(db: Session) -> datetime:
    clock = get_system_clock(db)
    return utc_now() + timedelta(days=clock.offset_days)

def advance_simulated_clock(db: Session, days: int) -> Dict[str, Any]:
    """Advances regulatory simulated clock and triggers time-dependent lifecycle events."""
    clock = get_system_clock(db)
    clock.offset_days += days
    clock.updated_at = utc_now()
    db.commit()
    
    simulated_now = get_simulated_now(db)
    
    # Process time-dependent lifecycle changes
    active_instruments = db.query(Instrument).filter(
        Instrument.status.in_([
            InstrumentStatusEnum.ACTIVE.value, 
            InstrumentStatusEnum.EXPIRING.value,
            InstrumentStatusEnum.MATURED.value
        ])
    ).all()
    
    rules = db.query(ReminderRule).filter(ReminderRule.active == True).all()
    
    status_changes = 0
    reminders_created = 0
    escalations_created = 0
    
    for inst in active_instruments:
        try:
            mat_date = datetime.strptime(inst.maturity_date, "%Y-%m-%d")
        except Exception:
            continue
            
        days_to_maturity = (mat_date.date() - simulated_now.date()).days
        
        # 1. State machine transitions based on simulated time
        old_status = inst.status
        if days_to_maturity < -15 and inst.status != InstrumentStatusEnum.OVERDUE.value:
            inst.status = InstrumentStatusEnum.OVERDUE.value
            status_changes += 1
            log_audit_entry(db, "STATUS_CHANGE", "instrument", inst.id, {
                "from": old_status, "to": inst.status, "reason": "Maturity exceeded by 15+ days"
            })
        elif days_to_maturity <= 0 and inst.status in (InstrumentStatusEnum.ACTIVE.value, InstrumentStatusEnum.EXPIRING.value):
            inst.status = InstrumentStatusEnum.MATURED.value
            status_changes += 1
            log_audit_entry(db, "STATUS_CHANGE", "instrument", inst.id, {
                "from": old_status, "to": inst.status, "reason": "Reached maturity date"
            })
        elif days_to_maturity <= 90 and inst.status == InstrumentStatusEnum.ACTIVE.value:
            inst.status = InstrumentStatusEnum.EXPIRING.value
            status_changes += 1
            log_audit_entry(db, "STATUS_CHANGE", "instrument", inst.id, {
                "from": old_status, "to": inst.status, "reason": f"Entering 90-day expiry window ({days_to_maturity} days remaining)"
            })
            
        # 2. Trigger reminder rules
        for rule in rules:
            if days_to_maturity <= rule.days_before:
                # Check if reminder already sent for this rule
                existing = db.query(Reminder).filter(
                    Reminder.instrument_id == inst.id,
                    Reminder.rule_id == rule.id
                ).first()
                
                if not existing:
                    recipient_email = f"{rule.recipient_role}@aicte.gov.in"
                    rem = Reminder(
                        instrument_id=inst.id,
                        rule_id=rule.id,
                        due_at=simulated_now,
                        sent_at=simulated_now,
                        channel=f"{rule.channel} (Mock Dispatcher)",
                        level=rule.level,
                        status="DELIVERED (SIMULATED)",
                        recipient=recipient_email,
                        message=f"Urgent Regulatory Notice: Institutional FDR {inst.fdr_number} matures in {days_to_maturity} days ({inst.maturity_date}). Level {rule.level} regulatory action required."
                    )
                    db.add(rem)
                    reminders_created += 1
                    if rule.level >= 2:
                        escalations_created += 1
                    
                    log_audit_entry(db, "DISPATCH_NOTIFICATION", "reminder", inst.id, {
                        "instrument_id": inst.id,
                        "rule_id": rule.id,
                        "channel": rule.channel,
                        "recipient": recipient_email,
                        "level": rule.level,
                        "status": "DELIVERED (SIMULATED)",
                        "simulated_date": simulated_now.strftime("%Y-%m-%d")
                    })

    db.commit()
    
    log_audit_entry(db, "ADVANCE_CLOCK", "system_clock", 1, {
        "advanced_by_days": days,
        "new_offset_days": clock.offset_days,
        "simulated_date": simulated_now.strftime("%Y-%m-%d"),
        "status_changes": status_changes,
        "reminders_sent": reminders_created
    })

    return {
        "success": True,
        "offset_days": clock.offset_days,
        "simulated_date": simulated_now.strftime("%Y-%m-%d"),
        "status_changes": status_changes,
        "reminders_created": reminders_created,
        "escalations_created": escalations_created
    }

def reset_simulated_clock(db: Session) -> Dict[str, Any]:
    """
    Resets simulated clock to real-time (offset_days = 0)
    and recalibrates all active/expiring/matured/overdue instrument statuses
    strictly according to the real UTC calendar.
    """
    clock = get_system_clock(db)
    clock.offset_days = 0
    clock.updated_at = utc_now()
    db.commit()

    now = utc_now()
    today = now.date()

    instruments = db.query(Instrument).filter(
        Instrument.status.in_([
            InstrumentStatusEnum.ACTIVE.value,
            InstrumentStatusEnum.EXPIRING.value,
            InstrumentStatusEnum.MATURED.value,
            InstrumentStatusEnum.OVERDUE.value,
        ])
    ).all()

    recalibrated_count = 0
    for inst in instruments:
        try:
            mat_date = datetime.strptime(inst.maturity_date, "%Y-%m-%d").date()
        except Exception:
            continue

        days_to_mat = (mat_date - today).days
        old_status = inst.status

        if days_to_mat < -15:
            new_status = InstrumentStatusEnum.OVERDUE.value
        elif days_to_mat <= 0:
            new_status = InstrumentStatusEnum.MATURED.value
        elif days_to_mat <= 90:
            new_status = InstrumentStatusEnum.EXPIRING.value
        else:
            new_status = InstrumentStatusEnum.ACTIVE.value

        if old_status != new_status:
            inst.status = new_status
            recalibrated_count += 1

    db.commit()

    log_audit_entry(db, "RESET_CLOCK", "system_clock", 1, {
        "new_offset_days": 0,
        "simulated_date": today.strftime("%Y-%m-%d"),
        "recalibrated_instruments": recalibrated_count
    })

    return {
        "success": True,
        "offset_days": 0,
        "simulated_date": today.strftime("%Y-%m-%d"),
        "recalibrated_instruments": recalibrated_count
    }
