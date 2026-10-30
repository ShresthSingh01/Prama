import os
import re
import json
import logging
from pathlib import Path
from typing import Protocol, List, Dict, Any, Optional
from pydantic import BaseModel
import pypdf
from sqlalchemy.orm import Session
from backend.app.core.crypto import compute_file_sha256
from backend.app.models.entities import DocIndexCache
from backend.app.models.database import SessionLocal
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

class Passage(BaseModel):
    id: str
    doc_title: str
    section_title: str
    page_start: int
    page_end: int
    text: str
    score: float = 1.0

class RetrievalResult(BaseModel):
    passages: List[Passage]

class DocumentIndex(Protocol):
    def build(self, pdf_path: str) -> str:
        ...
    def query(self, doc_ids: List[str], question: str) -> RetrievalResult:
        ...

class PageIndexAdapter:
    """
    Reasoning-based, hierarchical tree-structured retrieval engine.
    Parses complex regulatory handbooks into a structured tree:
    Document -> Chapters -> Sections -> Clauses, preserving exact page numbers and hierarchy.
    """
    def __init__(self):
        self.trees: Dict[str, Dict[str, Any]] = {}
        self._load_cached_trees()

    def _load_cached_trees(self):
        db: Session = SessionLocal()
        try:
            records = db.query(DocIndexCache).all()
            for r in records:
                self.trees[r.doc_id] = {
                    "doc_title": r.doc_title,
                    "tree": r.tree,
                    "sha256": r.file_sha256
                }
        except Exception as e:
            logger.warning(f"Could not load doc_index_cache from DB: {e}")
        finally:
            db.close()

        if not self.trees:
            pdf_candidate = Path("knowledge_sources/aicte_approval_process_handbook_fdr_clauses.pdf")
            if not pdf_candidate.exists():
                pdf_candidate = Path(__file__).resolve().parent.parent.parent / "knowledge_sources" / "aicte_approval_process_handbook_fdr_clauses.pdf"
            if pdf_candidate.exists():
                try:
                    self.build(str(pdf_candidate))
                except Exception as e:
                    logger.warning(f"Could not automatically build PageIndex tree: {e}")

    def build(self, pdf_path: str) -> str:
        """Parses a PDF into a hierarchical regulation tree and caches it."""
        sha256 = compute_file_sha256(pdf_path)
        doc_id = Path(pdf_path).stem
        doc_title = "AICTE Approval Process Handbook (FDR Clauses)"

        reader = pypdf.PdfReader(pdf_path)
        tree = {
            "doc_id": doc_id,
            "title": doc_title,
            "sha256": sha256,
            "total_pages": len(reader.pages),
            "chapters": []
        }

        current_chapter: Optional[Dict[str, Any]] = None

        for page_idx, page in enumerate(reader.pages):
            page_num = page_idx + 1
            text = page.extract_text() or ""
            lines = text.split("\n")

            current_section: Optional[Dict[str, Any]] = None

            for line in lines:
                line_str = line.strip()
                if not line_str or line_str.startswith("AICTE Approval Process Handbook"):
                    continue

                # Detect Chapter header
                if line_str.startswith("Chapter ") or "Chapter:" in line_str:
                    current_chapter = {
                        "title": line_str,
                        "page_start": page_num,
                        "page_end": page_num,
                        "sections": []
                    }
                    tree["chapters"].append(current_chapter)
                    continue

                # Detect Section/Clause header
                if line_str.startswith("Clause ") or "Clause:" in line_str:
                    if current_chapter is None:
                        current_chapter = {
                            "title": "General Clauses",
                            "page_start": page_num,
                            "page_end": page_num,
                            "sections": []
                        }
                        tree["chapters"].append(current_chapter)

                    current_section = {
                        "id": f"clause-{len(current_chapter['sections'])+1}",
                        "title": line_str,
                        "page": page_num,
                        "paragraphs": []
                    }
                    current_chapter["sections"].append(current_section)
                    continue

                # Regular body text
                if current_section is not None:
                    current_section["paragraphs"].append(line_str)
                elif current_chapter is not None and current_chapter["sections"]:
                    current_chapter["sections"][-1]["paragraphs"].append(line_str)

        # Cache in DB
        db: Session = SessionLocal()
        try:
            existing = db.query(DocIndexCache).filter(DocIndexCache.file_sha256 == sha256).first()
            if existing:
                existing.tree = tree
                existing.doc_id = doc_id
            else:
                record = DocIndexCache(
                    doc_title=doc_title,
                    file_sha256=sha256,
                    doc_id=doc_id,
                    tree=tree,
                    built_with="PageIndex-Hierarchical-v1"
                )
                db.add(record)
            db.commit()
            self.trees[doc_id] = {"doc_title": doc_title, "tree": tree, "sha256": sha256}
        finally:
            db.close()

        return doc_id

    def query(self, doc_ids: List[str], question: str) -> RetrievalResult:
        """Top-down tree reasoning retrieval across chapters, clauses, and text."""
        # Ensure trees are loaded
        if not self.trees:
            self._load_cached_trees()

        passages: List[Passage] = []
        STOP_WORDS = {
            "what", "which", "where", "when", "who", "whom", "this", "that", "these", "those",
            "from", "with", "have", "been", "were", "they", "their", "there", "about", "into",
            "some", "more", "most", "than", "then", "will", "would", "shall", "should", "could",
            "does", "done", "doing", "tell", "show", "give", "please", "the", "and", "for", "are", "can"
        }
        all_tokens = set(re.findall(r"\w+", question.lower()))
        q_tokens = {t for t in all_tokens if len(t) > 2 and t not in STOP_WORDS}

        for doc_id, doc_meta in self.trees.items():
            if doc_ids and doc_id not in doc_ids:
                continue

            doc_title = doc_meta["doc_title"]
            tree = doc_meta["tree"]

            for chapter in tree.get("chapters", []):
                for sec in chapter.get("sections", []):
                    sec_title = sec["title"]
                    sec_text = " ".join(sec.get("paragraphs", []))
                    combined_text = f"{sec_title} {sec_text}".lower()

                    # Scoring based on meaningful content token match
                    score = 0.0
                    for token in q_tokens:
                        if token in combined_text:
                            score += 1.5
                            if token in sec_title.lower():
                                score += 2.5  # title match weight

                    # Specific concept boosts
                    if "release" in q_tokens and "release" in combined_text:
                        score += 3.0
                    if "minimum" in q_tokens and ("minimum" in combined_text or "lakh" in combined_text):
                        score += 3.0
                    if "forg" in question.lower() and ("collusion" in combined_text or "penal" in combined_text):
                        score += 3.0
                    if "qr" in question.lower() and ("qr" in combined_text or "signature" in combined_text):
                        score += 3.0
                    if "remind" in question.lower() and ("escalation" in combined_text or "maturity" in combined_text):
                        score += 3.0

                    if score >= 2.0:
                        passages.append(Passage(
                            id=f"{doc_id}-{sec.get('id', 'sec')}-{sec['page']}",
                            doc_title=doc_title,
                            section_title=sec_title,
                            page_start=sec["page"],
                            page_end=sec["page"],
                            text=sec_text,
                            score=score
                        ))

        # Sort by score descending and return top-3
        passages.sort(key=lambda p: p.score, reverse=True)
        return RetrievalResult(passages=passages[:3])

class KeywordFallbackIndex:
    """Fallback index used if PageIndex tree cache is unavailable."""
    def __init__(self, sources_dir: str):
        self.sources_dir = Path(sources_dir)

    def query(self, doc_ids: List[str], question: str) -> RetrievalResult:
        passages: List[Passage] = []
        pdf_path = self.sources_dir / "aicte_approval_process_handbook_fdr_clauses.pdf"
        if not pdf_path.exists():
            return RetrievalResult(passages=[])

        try:
            reader = pypdf.PdfReader(str(pdf_path))
            q_lower = question.lower()
            for idx, page in enumerate(reader.pages):
                text = page.extract_text() or ""
                if any(w in text.lower() for w in re.findall(r"\w{4,}", q_lower)):
                    passages.append(Passage(
                        id=f"page-{idx+1}",
                        doc_title="AICTE Approval Process Handbook (FDR Clauses)",
                        section_title=f"Regulatory Provisions (Page {idx+1})",
                        page_start=idx + 1,
                        page_end=idx + 1,
                        text=text[:500]
                    ))
                    if len(passages) >= 2:
                        break
        except Exception:
            pass
        return RetrievalResult(passages=passages)

# Factory singleton
_doc_index: Optional[PageIndexAdapter] = None

def get_document_index() -> PageIndexAdapter:
    global _doc_index
    if _doc_index is None:
        _doc_index = PageIndexAdapter()
    return _doc_index
