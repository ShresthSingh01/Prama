from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.models.database import get_db
from backend.app.core.config import settings
from backend.app.services.clock_service import (
    advance_simulated_clock, get_system_clock, get_simulated_now
)
from backend.app.schemas.api_schemas import AdvanceClockRequest

router = APIRouter(prefix="/demo", tags=["Demo & Time Machine"])

@router.get("/status")
def get_clock_status(db: Session = Depends(get_db)):
    clock = get_system_clock(db)
    simulated_now = get_simulated_now(db)
    return {
        "offset_days": clock.offset_days,
        "simulated_date": simulated_now.strftime("%Y-%m-%d"),
        "simulated_datetime": simulated_now.strftime("%Y-%m-%d %H:%M:%S UTC")
    }

@router.post("/advance-clock")
def advance_clock(req: AdvanceClockRequest, db: Session = Depends(get_db)):
    if not settings.DEMO_MODE:
        raise HTTPException(status_code=403, detail="Simulated clock manipulation is disabled when DEMO_MODE is false.")
    return advance_simulated_clock(db, req.days)

@router.post("/reset-clock")
def reset_clock(db: Session = Depends(get_db)):
    if not settings.DEMO_MODE:
        raise HTTPException(status_code=403, detail="Simulated clock manipulation is disabled when DEMO_MODE is false.")
    clock = get_system_clock(db)
    clock.offset_days = 0
    db.commit()
    simulated_now = get_simulated_now(db)
    return {
        "success": True,
        "offset_days": 0,
        "simulated_date": simulated_now.strftime("%Y-%m-%d")
    }
