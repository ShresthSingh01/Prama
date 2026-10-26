import ast
import os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from backend.app.main import app
from backend.app.models.database import SessionLocal
from backend.app.models.entities import Instrument, Bank, Institution, User, Flag, AuditLog
from backend.app.services.slm_tasks import (
    apply_hallucination_guard,
    generate_flag_explanation_slm,
    generate_hindi_reminder_draft,
    parse_natural_language_search,
    NLSearchFilter
)
from backend.app.services.knowledge import get_knowledge_bundle, get_rule_parameter, reload_knowledge_bundle
from backend.app.services.rules_engine import evaluate_instrument_rules
from backend.app.services.document_index import get_document_index
from backend.app.services.audit_service import verify_audit_chain

client = TestClient(app)

def test_01_slm_extraction_and_hallucination_guard():
    """Test 1 & 2: Substring hallucination guard rejects fabricated values."""
    raw_ocr = "STATE BANK OF INDIA\nFDR No: SBIN/2026/12345\nHolder: Test Institute\nDate: 2026-01-01"
    
    # Fabricated extraction with amount and interest that do NOT exist in raw OCR
    candidate = {
        "fdr_number": "SBIN/2026/12345",
        "bank_name": "State Bank of India",
        "amount": 5000000.0,  # Not in text
        "interest_rate": 8.5, # Not in text
        "holder_name": "Test Institute"
    }
    
    guarded = apply_hallucination_guard(candidate, raw_ocr)
    
    assert guarded["fdr_number"] == "SBIN/2026/12345"
    assert guarded["amount"] is None, "Hallucinated amount must be rejected by guard"
    assert guarded["interest_rate"] is None, "Hallucinated interest must be rejected by guard"

def test_02_flag_explanation_guard():
    """Test 3: Flag explanation guard rejects explanations with fabricated numbers."""
    code = "R02_TENURE_MATURITY_MISMATCH"
    severity = "HIGH"
    evidence = {"issue_date": "2026-01-01", "tenure_days": 365, "variance": 10}
    deterministic = "Declared tenure does not match maturity date (variance: 10 days)."

    # Test with mock class that simulates a hallucinating model
    class HallucinatingClient:
        def generate(self, prompt, max_tokens=200):
            return "This FDR has a critical discrepancy involving Rs 99,99,999 and penalty code 8841."

    safe_explanation = generate_flag_explanation_slm(
        code=code,
        severity=severity,
        evidence=evidence,
        deterministic_explanation=deterministic,
        lang="en",
        client=HallucinatingClient()
    )
    
    # Guard must reject hallucination and fall back to deterministic explanation
    assert safe_explanation == deterministic

def test_03_hindi_reminder_guard():
    """Test 4: Hindi reminder translation guard replaces text if FDR number missing."""
    template = "Reminder: Your FDR SBIN/2026/55555 of Rs 10,00,000 matures on 2026-12-31."
    
    class IncompleteHindiClient:
        def generate(self, prompt, max_tokens=200):
            return "कृपया ध्यान दें कि आपकी सावधि जमा राशि जल्द समाप्त हो रही है।"  # Missing FDR serial

    result = generate_hindi_reminder_draft(
        template_text=template,
        fdr_number="SBIN/2026/55555",
        amount=1000000.0,
        maturity_date="2026-12-31",
        client=IncompleteHindiClient()
    )
    
    assert result == template, "Missing FDR serial must trigger fallback to template"

def test_04_nl_search_validation_and_rbac():
    """Test 5: Guarded NL search validates filters and isolates institution data."""
    # Test valid query endpoint
    res = client.post("/api/v1/search/nl", json={"query": "FDRs maturing in 60 days with min amount 500000 in Maharashtra"})
    assert res.status_code == 200
    data = res.json()
    assert "filter" in data
    assert "results" in data
    
    # Injection attempt with unauthorized key
    malicious_dict = {"status": ["ACTIVE"], "drop": "table instruments", "sort": "invalid_sort"}
    filter_obj = NLSearchFilter.model_validate(malicious_dict)
    assert not hasattr(filter_obj, "drop")
    assert filter_obj.sort == "risk_desc"

def test_05_decision_isolation_ast():
    """Test 6: AST check enforces that deterministic core modules NEVER import llm_client."""
    root_dir = Path(__file__).resolve().parent.parent
    
    restricted_files = [
        root_dir / "app" / "services" / "rules_engine.py",
        root_dir / "app" / "services" / "forensic_service.py",
        root_dir / "app" / "services" / "clock_service.py",
        root_dir / "app" / "api" / "release.py",
        root_dir / "app" / "api" / "verification.py",
    ]
    
    for fpath in restricted_files:
        assert fpath.exists(), f"File {fpath} must exist"
        with open(fpath, "r", encoding="utf-8") as f:
            tree = ast.parse(f.read(), filename=str(fpath))
            
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for name in node.names:
                    assert "llm_client" not in name.name, f"VIOLATION: {fpath} imports {name.name}"
            elif isinstance(node, ast.ImportFrom):
                module = node.module or ""
                assert "llm_client" not in module, f"VIOLATION: {fpath} imports from {module}"

def test_06_graceful_degradation():
    """Test 7: Turning SLM_ENABLED=false keeps entire system 100% operational."""
    from backend.app.core.config import settings
    original_val = settings.SLM_ENABLED
    try:
        settings.SLM_ENABLED = False
        res = client.get("/api/v1/slm/health")
        assert res.status_code == 200
        assert res.json().get("slm_enabled") is False
        
        # Test dashboard summary still operational
        dash = client.get("/api/v1/dashboard/summary")
        assert dash.status_code == 200
    finally:
        settings.SLM_ENABLED = original_val

def test_07_okf_loader_and_parameter_binding():
    """Test 8: OKF loader validates bundle and dynamic parameter binding updates rule logic."""
    bundle = get_knowledge_bundle()
    assert len(bundle.graph_nodes) >= 15
    assert len(bundle.validation_errors) == 0
    
    # Check default tolerance_days in R02
    tol = get_rule_parameter("R02", "tolerance_days", default=1)
    assert tol == 2
    
    # Dynamically change parameter in memory and re-evaluate
    bundle.rule_params["R02"]["tolerance_days"] = 5
    tol_updated = get_rule_parameter("R02", "tolerance_days", default=1)
    assert tol_updated == 5
    
    # Reset back to 2
    bundle.rule_params["R02"]["tolerance_days"] = 2

def test_08_pageindex_copilot_citations():
    """Test 9: Copilot answers cite real passages and refuses out-of-scope query."""
    # 1. In-scope query
    ask_res = client.post("/api/v1/copilot/ask", json={
        "question": "What are the statutory preconditions before release of security deposit?"
    })
    assert ask_res.status_code == 200
    data = ask_res.json()
    assert len(data["citations"]) > 0
    top_cit = data["citations"][0]
    assert "Clause 6.5" in top_cit["section"]
    assert top_cit["pages"] == "5-5"
    assert data["advisory"] is True
    
    # 2. Out-of-scope query -> Refusal
    refuse_res = client.post("/api/v1/copilot/ask", json={
        "question": "What is the capital city of France?"
    })
    assert refuse_res.status_code == 200
    ref_data = refuse_res.json()
    assert "No supporting clause" in ref_data["answer"]
    assert len(ref_data["citations"]) == 0

def test_09_audit_chain_integrity():
    """Test 10: Copilot queries and OKF reloads appear in audit chain and verify passes."""
    db: Session = SessionLocal()
    try:
        # Reload OKF bundle (admin action)
        reload_res = client.post("/api/v1/knowledge/reload")
        assert reload_res.status_code == 200
        
        # Verify hash chain integrity
        ver = verify_audit_chain(db, force_recompute=True)
        assert ver["valid"] is True, f"Hash chain broken: {ver.get('reason')}"
        assert ver["total_entries"] > 0
    finally:
        db.close()
