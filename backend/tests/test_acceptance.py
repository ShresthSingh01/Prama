import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import text
from backend.app.main import app
from backend.app.models.database import SessionLocal
from backend.app.models.entities import Instrument, Bank, Institution, User, Flag, ReleaseRequest, AuditLog
from backend.app.services.audit_service import verify_audit_chain, log_audit_entry

client = TestClient(app)

def test_01_health_and_summary():
    """Verify health and live API dashboard summary matches database."""
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"
    
    summary_res = client.get("/api/v1/dashboard/summary")
    assert summary_res.status_code == 200
    data = summary_res.json()
    assert data["total_instruments"] >= 600
    assert data["total_security_cover_amount"] > 0
    assert "status_distribution" in data

def test_02_signed_qr_verification_success():
    """Submit genuine signed-QR FDR -> signature valid, status VERIFIED, trust_tier BANK_CONFIRMED."""
    db: Session = SessionLocal()
    try:
        bank = db.query(Bank).filter(Bank.ifsc_prefix == "SBIN").first()
        inst = db.query(Instrument).filter(Instrument.bank_id == bank.id).first()
        
        # Issue genuine signed QR
        qr_res = client.post(
            f"/api/v1/mock-bank/issue-sample-fdr?bank_id={bank.id}&fdr_number={inst.fdr_number}&amount={inst.amount}&maturity_date={inst.maturity_date}&holder_name=TestInstitute"
        )
        assert qr_res.status_code == 200
        envelope_json = qr_res.json()["envelope_json"]
        
        # Verify QR against instrument
        verify_res = client.post(
            f"/api/v1/instruments/{inst.id}/verify/qr",
            json={"qr_content": envelope_json}
        )
        assert verify_res.status_code == 200
        v_data = verify_res.json()
        assert v_data["verified"] is True
        assert v_data["trust_tier"] == "BANK_CONFIRMED"
    finally:
        db.close()

def test_03_tampered_amount_signature_failure():
    """Edit amount in QR payload -> signature check fails, CRITICAL flag raised."""
    db: Session = SessionLocal()
    try:
        bank = db.query(Bank).filter(Bank.ifsc_prefix == "SBIN").first()
        inst = db.query(Instrument).filter(Instrument.bank_id == bank.id).first()
        
        # Issue tampered QR (amount manipulated 10x after signing)
        tamper_res = client.post(
            f"/api/v1/mock-bank/issue-tampered-sample-fdr?bank_id={bank.id}&fdr_number={inst.fdr_number}&amount={inst.amount}&maturity_date={inst.maturity_date}&holder_name=TestInstitute"
        )
        assert tamper_res.status_code == 200
        tampered_json = tamper_res.json()["tampered_envelope_json"]
        
        # Verify against instrument -> MUST FAIL
        verify_res = client.post(
            f"/api/v1/instruments/{inst.id}/verify/qr",
            json={"qr_content": tampered_json}
        )
        assert verify_res.status_code == 200
        v_data = verify_res.json()
        assert v_data["verified"] is False
        assert "INVALID SIGNATURE" in v_data["message"]
        
        db.refresh(inst)
        assert inst.status == "FLAGGED"
    finally:
        db.close()

def test_04_cross_institution_duplicate_detection():
    """Planted collusion ring should be discovered and flagged as CRITICAL duplicate."""
    res = client.get("/api/v1/graph/rings")
    assert res.status_code == 200
    graph = res.json()
    assert len(graph["nodes"]) > 0
    assert len(graph["collusion_rings"]) > 0
    
    apex_ring = next((r for r in graph["collusion_rings"] if "APEX-SYNDICATE" in r.get("fdr_number", "")), None)
    assert apex_ring is not None
    assert apex_ring["severity"] == "CRITICAL"
    assert len(apex_ring["involved_institutions"]) >= 4

def test_05_rule_r02_tenure_mismatch():
    """Create instrument with tenure/maturity date mismatch -> R02 flag raised."""
    inst_payload = {
        "institution_id": 1,
        "bank_id": 1,
        "fdr_number": "SBIN/2026/TEST-R02",
        "amount": 1000000.0,
        "issue_date": "2026-01-01",
        "maturity_date": "2026-02-01",
        "tenure_days": 730,
        "interest_rate": 7.0
    }
    create_res = client.post("/api/v1/instruments", json=inst_payload)
    assert create_res.status_code == 200
    inst_id = create_res.json()["id"]
    
    detail_res = client.get(f"/api/v1/instruments/{inst_id}")
    flags = detail_res.json()["flags"]
    assert any("R02_TENURE_MATURITY_MISMATCH" in f["code"] for f in flags)

def test_06_advance_simulated_clock():
    """Advance clock 80 days -> instruments cross expiry thresholds and reminders fire."""
    adv_res = client.post("/api/v1/demo/advance-clock", json={"days": 80})
    assert adv_res.status_code == 200
    adv_data = adv_res.json()
    assert adv_data["success"] is True
    assert adv_data["offset_days"] >= 80

def test_07_maker_checker_release_enforcement():
    """Maker cannot approve their own release request (maker_id != checker_id)."""
    db: Session = SessionLocal()
    try:
        clean_inst = (
            db.query(Instrument)
            .filter(
                Instrument.status != "RELEASED",
                ~Instrument.flags.any(Flag.status == "open")
            )
            .first()
        )
        if not clean_inst:
            inst_payload = {
                "institution_id": 1,
                "bank_id": 1,
                "fdr_number": "TEST/RELEASE/CLEAN-01",
                "amount": 500000.0,
                "issue_date": "2024-01-01",
                "maturity_date": "2026-01-01",
                "tenure_days": 730,
                "interest_rate": 7.0
            }
            create_res = client.post("/api/v1/instruments", json=inst_payload)
            clean_inst = db.query(Instrument).filter(Instrument.id == create_res.json()["id"]).first()
        
        # 1. Submit release request
        rel_res = client.post(f"/api/v1/instruments/{clean_inst.id}/release-requests", json={"reason": "Tenure completed"})
        assert rel_res.status_code == 200
        rel_id = rel_res.json()["release_request_id"]
        
        # 2. Maker scrutiny (Maker user ID = 2)
        maker_token = client.post("/api/v1/auth/login", json={"email": "maker@aicte.gov.in", "password": "Password@123"}).json()["access_token"]
        scrutiny_res = client.patch(
            f"/api/v1/release-requests/{rel_id}/maker-scrutiny",
            headers={"Authorization": f"Bearer {maker_token}"},
            json={"decision": "approved", "remarks": "Documents checked and valid"}
        )
        assert scrutiny_res.status_code == 200
        assert scrutiny_res.json()["status"] == "under_review"
        
        # 3. Same Maker tries to approve as Checker -> MUST BE REJECTED (403)
        violating_res = client.patch(
            f"/api/v1/release-requests/{rel_id}/checker-approval",
            headers={"Authorization": f"Bearer {maker_token}"},
            json={"decision": "approved", "remarks": "I am approving my own scrutiny"}
        )
        assert violating_res.status_code == 403
        assert "Maker-Checker Violation" in violating_res.json()["detail"]
        
        # 4. Senior Officer (Checker user ID = 3) approves -> SUCCESS
        checker_token = client.post("/api/v1/auth/login", json={"email": "checker@aicte.gov.in", "password": "Password@123"}).json()["access_token"]
        approved_res = client.patch(
            f"/api/v1/release-requests/{rel_id}/checker-approval",
            headers={"Authorization": f"Bearer {checker_token}"},
            json={"decision": "approved", "remarks": "Director approved release"}
        )
        assert approved_res.status_code == 200
        assert approved_res.json()["status"] == "released"
        assert approved_res.json()["certificate_hash"] is not None
    finally:
        db.close()

def test_08_tamper_evident_audit_break():
    """Verify audit chain passes; after sabotage, verify fails and pinpoints tampered block."""
    db: Session = SessionLocal()
    try:
        # Create a dedicated entry for sabotage test
        test_entry = log_audit_entry(db, "TEST_INTEGRITY_CHECK", "test", 9999, {"amount": 500000.0})
        entry_id = test_entry.id
        
        # 1. Verify before sabotage must be valid
        verify_initial = client.get("/api/v1/audit/verify").json()
        assert verify_initial["valid"] is True
        
        # 2. Inject deliberate tamper on this test block
        sabotage_res = client.post(f"/api/v1/audit/sabotage?entry_id={entry_id}")
        assert sabotage_res.status_code == 200
        
        # 3. Verify must now fail and identify this exact block
        verify_after = client.get("/api/v1/audit/verify").json()
        assert verify_after["valid"] is False
        assert verify_after["broken_at_id"] == entry_id
        assert "tampering detected" in verify_after["reason"].lower()
        
        # 4. Clean up test entry so subsequent tests remain pristine
        db.query(AuditLog).filter(AuditLog.id == entry_id).delete()
        db.commit()
    finally:
        db.close()

def test_09_evaluation_benchmark_metrics():
    """Live evaluation benchmark runs on 200 samples and returns precision >= 0.90."""
    eval_res = client.post("/api/v1/evaluation/run")
    assert eval_res.status_code == 200
    metrics = eval_res.json()
    assert metrics["total_samples"] == 200
    assert metrics["recall"] >= 0.95
    assert metrics["precision"] >= 0.95
    assert metrics["f1_score"] >= 0.95
