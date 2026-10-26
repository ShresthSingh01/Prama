from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.app.models.database import get_db
from backend.app.services.graph_service import build_syndicate_graph

router = APIRouter(prefix="/graph", tags=["Fraud Syndicate Graph"])

@router.get("/rings")
@router.get("/syndicate")
def get_graph_data(db: Session = Depends(get_db)):
    return build_syndicate_graph(db)
