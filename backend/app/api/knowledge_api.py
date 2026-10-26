import re
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from backend.app.models.database import get_db
from backend.app.models.entities import User
from backend.app.services.knowledge import get_knowledge_bundle, reload_knowledge_bundle
from backend.app.api.auth import get_optional_user

router = APIRouter(prefix="/knowledge", tags=["OKF Knowledge Bundle"])

@router.get("/health")
def get_knowledge_health():
    """Returns OKF bundle health, concept counts by type, and validation status."""
    bundle = get_knowledge_bundle()
    return {
        "status": "healthy" if not bundle.validation_errors else "warning",
        "total_concepts": len(bundle.graph_nodes),
        "total_links": len(bundle.graph_links),
        "type_counts": bundle.type_counts,
        "validation_errors": bundle.validation_errors,
        "broken_links": bundle.broken_links
    }

@router.get("/concepts")
def get_knowledge_concepts():
    """Returns all concepts and graph nodes/edges for the interactive visual graph."""
    bundle = get_knowledge_bundle()
    concepts_list = []
    for path, c in bundle.concepts.items():
        if path.endswith(".md"):
            concepts_list.append({
                "id": c["id"],
                "path": c["path"],
                "type": c["type"],
                "title": c["title"],
                "parameters": c.get("parameters", {}),
                "related": c.get("related", []),
                "source": c.get("source")
            })

    return {
        "concepts": concepts_list,
        "graph": {
            "nodes": bundle.graph_nodes,
            "links": bundle.graph_links
        }
    }

@router.get("/concepts/{path:path}")
def get_knowledge_concept_detail(path: str):
    """Returns markdown content, parameters, and metadata for a specific OKF concept."""
    bundle = get_knowledge_bundle()
    concept = bundle.concepts.get(path) or bundle.concepts.get(path + ".md")
    if not concept:
        stem = path.split("/")[-1].replace(".md", "")
        concept = bundle.concepts.get(stem)
    if not concept:
        code_m = re.search(r'([A-Za-z]\d+)', path)
        if code_m:
            code = code_m.group(1).upper()
            concept = bundle.concepts.get(code)
    if not concept:
        raise HTTPException(status_code=404, detail=f"Knowledge concept '{path}' not found")

    return {
        "id": concept["id"],
        "path": concept["path"],
        "type": concept["type"],
        "title": concept["title"],
        "parameters": concept.get("parameters", {}),
        "related": concept.get("related", []),
        "source": concept.get("source"),
        "body": concept["body"]
    }

@router.get("/concept")
def get_knowledge_concept_by_query(path: str = Query(...)):
    """Query parameter alias for get_knowledge_concept_detail."""
    return get_knowledge_concept_detail(path)

@router.post("/reload")
def reload_bundle(db: Session = Depends(get_db), user: Optional[User] = Depends(get_optional_user)):
    """Admin endpoint to hot-reload OKF bundle from disk; writes diff to audit hash chain."""
    return reload_knowledge_bundle(db, actor_id=user.id if user else None)
