import json
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.app.models.database import get_db
from backend.app.models.entities import CopilotQuery, User, Instrument
from backend.app.services.document_index import get_document_index, Passage
from backend.app.services.knowledge import get_knowledge_bundle
from backend.app.services.llm_client import get_llm_client
from backend.app.services.audit_service import log_audit_entry
from backend.app.api.auth import get_optional_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/copilot", tags=["Compliance Copilot"])

class CopilotAskRequest(BaseModel):
    question: str
    instrument_id: Optional[int] = None

class CitationItem(BaseModel):
    doc_title: str
    section: str
    pages: str
    quote: str

class CopilotAskResponse(BaseModel):
    answer: str
    citations: List[CitationItem]
    knowledge_refs: List[str]
    confidence_note: str
    advisory: bool = True

COPILOT_SYNTHESIS_SCHEMA = {
    "type": "object",
    "properties": {
        "answer": {"type": "string"},
        "citations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "doc_title": {"type": "string"},
                    "section": {"type": "string"},
                    "pages": {"type": "string"},
                    "quote": {"type": "string"}
                },
                "required": ["doc_title", "section", "pages", "quote"]
            }
        },
        "knowledge_refs": {"type": "array", "items": {"type": "string"}},
        "confidence_note": {"type": "string"}
    },
    "required": ["answer", "citations", "knowledge_refs", "confidence_note"]
}

@router.post("/ask", response_model=CopilotAskResponse)
def ask_compliance_copilot(
    req: CopilotAskRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user)
):
    """
    Answers regulatory questions about AICTE regulations/handbook with section and page citations
    using PageIndex hierarchical retrieval and OKF policy concepts.
    """
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    doc_index = get_document_index()
    retrieval = doc_index.query([], question)

    # Out-of-scope check
    if not retrieval.passages or retrieval.passages[0].score < 2.0:
        # Refusal without invented citations
        refusal_resp = CopilotAskResponse(
            answer="No supporting clause found in the loaded documents. The loaded AICTE regulations do not contain provisions addressing this inquiry.",
            citations=[],
            knowledge_refs=[],
            confidence_note="Query out of regulatory scope.",
            advisory=True
        )
        # Log to audit chain
        log_audit_entry(
            db,
            action="COPILOT_QUERY_REFUSED_OUT_OF_SCOPE",
            entity_type="copilot_query",
            entity_id=0,
            payload={"question": question, "reason": "No supporting clause"},
            actor_id=user.id if user else None,
            actor_role=user.role if user else "officer"
        )
        return refusal_resp

    # Gather matching OKF concepts
    bundle = get_knowledge_bundle()
    knowledge_refs = []
    q_lower = question.lower()
    for path, c in bundle.concepts.items():
        if path.endswith(".md") and any(term in q_lower for term in [c["id"].lower(), c["type"].lower()]):
            knowledge_refs.append(c["path"])

    # Prepare passages context for LLM
    passages_text = ""
    for p in retrieval.passages:
        passages_text += (
            f"\n[Source Document: {p.doc_title}]\n"
            f"[Section: {p.section_title}]\n"
            f"[Pages: {p.page_start}-{p.page_end}]\n"
            f"[Clause Text]: {p.text}\n"
        )

    # Specific instrument context if supplied
    inst_context = ""
    if req.instrument_id:
        inst = db.query(Instrument).filter(Instrument.id == req.instrument_id).first()
        if inst:
            inst_context = f"\nCurrent Instrument: Serial {inst.fdr_number}, Amount Rs {inst.amount:,.2f}, Status {inst.status}, Risk {inst.risk_band}."

    prompt = (
        "You are the AICTE Regulation Compliance Copilot. Answer the officer's question accurately.\n"
        "RULES:\n"
        "1. Base your answer ONLY on the retrieved regulatory passages provided below.\n"
        "2. Do NOT hallucinate or assume facts not in the text.\n"
        "3. Every citation MUST reference the exact section title and page number from the passages.\n"
        "4. Include concise quotes (<=25 words).\n"
        f"Officer Question: {question}\n"
        f"{inst_context}\n"
        f"Retrieved Regulatory Passages:\n{passages_text}"
    )

    client = get_llm_client()
    try:
        raw_res = client.extract_json(prompt, COPILOT_SYNTHESIS_SCHEMA, passages_text)
        answer = raw_res.get("answer", "")
        raw_citations = raw_res.get("citations", [])
        conf_note = raw_res.get("confidence_note", "Verified against AICTE Approval Process Handbook.")

        # STRICT CITATION GUARD: Every citation must match an actually retrieved passage
        valid_citations = []
        retrieved_sections = {p.section_title.lower(): p for p in retrieval.passages}

        for c in raw_citations:
            c_sec = c.get("section", "").lower()
            matching_p = next((p for s_name, p in retrieved_sections.items() if s_name in c_sec or c_sec in s_name), None)
            if matching_p:
                valid_citations.append(CitationItem(
                    doc_title=matching_p.doc_title,
                    section=matching_p.section_title,
                    pages=f"{matching_p.page_start}-{matching_p.page_end}",
                    quote=c.get("quote", matching_p.text[:100])
                ))

        if not valid_citations:
            # Fall back to default primary passage
            top_p = retrieval.passages[0]
            valid_citations.append(CitationItem(
                doc_title=top_p.doc_title,
                section=top_p.section_title,
                pages=f"{top_p.page_start}-{top_p.page_end}",
                quote=top_p.text[:120] + "..."
            ))

        if not answer:
            answer = f"According to {retrieval.passages[0].section_title}: {retrieval.passages[0].text[:300]}..."

    except Exception as e:
        logger.warning(f"Copilot synthesis error: {e}. Generating deterministic passage response.")
        top_p = retrieval.passages[0]
        answer = f"Per {top_p.section_title} (Page {top_p.page_start}): {top_p.text}"
        valid_citations = [
            CitationItem(
                doc_title=top_p.doc_title,
                section=top_p.section_title,
                pages=f"{top_p.page_start}-{top_p.page_end}",
                quote=top_p.text[:100] + "..."
            )
        ]
        conf_note = "Direct regulatory passage extract (offline synthesis fallback)."

    # Record in copilot_queries
    query_record = CopilotQuery(
        user_id=user.id if user else None,
        instrument_id=req.instrument_id,
        question=question,
        cited=[c.model_dump() for c in valid_citations],
        answer=answer
    )
    db.add(query_record)
    db.commit()
    db.refresh(query_record)

    # Append to hash-chained audit log
    log_audit_entry(
        db,
        action="COPILOT_QUERY_ANSWERED",
        entity_type="copilot_query",
        entity_id=query_record.id,
        payload={
            "question": question,
            "cited_sections": [c.section for c in valid_citations],
            "pages": [c.pages for c in valid_citations],
            "instrument_id": req.instrument_id
        },
        actor_id=user.id if user else None,
        actor_role=user.role if user else "officer"
    )

    return CopilotAskResponse(
        answer=answer,
        citations=valid_citations,
        knowledge_refs=knowledge_refs,
        confidence_note=conf_note,
        advisory=True
    )

@router.get("/sources")
def get_indexed_sources():
    """Returns all indexed regulatory sources and cached trees."""
    doc_index = get_document_index()
    sources = []
    for doc_id, meta in doc_index.trees.items():
        tree = meta.get("tree", {})
        sources.append({
            "doc_id": doc_id,
            "title": meta.get("doc_title", doc_id),
            "sha256": meta.get("sha256", ""),
            "total_pages": tree.get("total_pages", 0),
            "chapters": [c.get("title") for c in tree.get("chapters", [])]
        })
    return {"sources": sources}
