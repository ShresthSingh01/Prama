import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import text
from backend.app.main import app
from backend.app.models.database import SessionLocal
from backend.app.models.entities import Instrument, Bank, Institution, User, Flag, ReleaseRequest, AuditLog, Document, Verification
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
        
        # Issue genuine signed QR with matching issue_date
        qr_res = client.post(
            f"/api/v1/mock-bank/issue-sample-fdr?bank_id={bank.id}&fdr_number={inst.fdr_number}&amount={inst.amount}&issue_date={inst.issue_date}&maturity_date={inst.maturity_date}&holder_name=TestInstitute"
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

        # Ensure test instrument satisfies AICTE Clause 6.46 preconditions (matured, bank confirmed, FDR receipt attached)
        clean_inst.maturity_date = "2024-01-01"
        clean_inst.status = "MATURED"
        clean_inst.trust_tier = "BANK_CONFIRMED"
        has_receipt = any(d.kind == "FDR_RECEIPT" for d in clean_inst.documents)
        if not has_receipt:
            doc = Document(instrument_id=clean_inst.id, kind="FDR_RECEIPT", storage_key="test_receipt.pdf", sha256="test_sha256")
            db.add(doc)
        db.commit()
        
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

def _create_test_pdf_bytes(text_lines: list) -> bytes:
    stream_text = " ".join(text_lines)
    clean_text = "".join(c for c in stream_text if 32 <= ord(c) < 127)
    stream_data = f"BT /F1 12 Tf 50 700 Td ({clean_text}) Tj ET"
    stream_bytes = stream_data.encode("latin-1")
    length = len(stream_bytes)
    
    pdf_content = (
        f"%PDF-1.4\n"
        f"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        f"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        f"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
        f"4 0 obj\n<< /Length {length} >>\nstream\n{stream_data}\nendstream\nendobj\n"
        f"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
        f"xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000227 00000 n \n0000000300 00000 n \n"
        f"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n370\n%%EOF\n"
    )
    return pdf_content.encode("latin-1")

def test_10_document_upload_and_extraction():
    """Upload genuine PDF receipt -> automatic regex/text extraction and DOC_EXTRACTED trust tier."""
    inst_payload = {
        "institution_id": 1,
        "bank_id": 1,
        "fdr_number": "SBIN-2026-EXTRACT01",
        "amount": 1500000.0,
        "issue_date": "2026-01-15",
        "maturity_date": "2036-01-15",
        "tenure_days": 3650,
        "interest_rate": 7.5
    }
    create_res = client.post("/api/v1/instruments", json=inst_payload)
    assert create_res.status_code == 200
    inst_id = create_res.json()["id"]

    pdf_bytes = _create_test_pdf_bytes([
        "STATE BANK OF INDIA FIXED DEPOSIT RECEIPT",
        "FDR No: SBIN-2026-EXTRACT01",
        "Principal Amount: INR 1500000.00",
        "Issue Date: 15/01/2026 Maturity Date: 15/01/2036",
        "Subject to joint lien with AICTE and National Institute of Technology"
    ])

    files = {"file": ("fdr_receipt.pdf", pdf_bytes, "application/pdf")}
    upload_res = client.post(f"/api/v1/instruments/{inst_id}/documents", files=files, data={"kind": "FDR_RECEIPT"})
    assert upload_res.status_code == 200
    up_data = upload_res.json()
    assert up_data["success"] is True
    assert up_data["ocr_extracted"] is True
    assert up_data["extracted_fields"]["fdr_number"] == "SBIN-2026-EXTRACT01"
    assert float(up_data["extracted_fields"]["amount"]) == 1500000.0
    assert up_data["extracted_fields"]["lien_clause"] is True

    # Check detail endpoint reflects DOC_EXTRACTED trust tier
    detail = client.get(f"/api/v1/instruments/{inst_id}").json()
    assert detail["trust_tier"] == "DOC_EXTRACTED"
    assert len(detail["documents"]) >= 1

def test_11_form_doc_amount_discrepancy_flag():
    """Uploaded document amount does not match declared form amount -> FORM_DOC_AMOUNT_DISCREPANCY flag."""
    inst_payload = {
        "institution_id": 1,
        "bank_id": 1,
        "fdr_number": "SBIN-2026-DISCREP01",
        "amount": 2500000.0,
        "issue_date": "2026-01-15",
        "maturity_date": "2036-01-15",
        "tenure_days": 3650,
        "interest_rate": 7.5
    }
    create_res = client.post("/api/v1/instruments", json=inst_payload)
    assert create_res.status_code == 200
    inst_id = create_res.json()["id"]

    # PDF with different amount (Rs 5,00,000 instead of Rs 25,00,000)
    pdf_bytes = _create_test_pdf_bytes([
        "CANARA BANK FIXED DEPOSIT RECEIPT",
        "FDR No: SBIN-2026-DISCREP01",
        "Principal Amount: INR 500000.00",
        "Maturity Date: 15/01/2036"
    ])

    files = {"file": ("receipt.pdf", pdf_bytes, "application/pdf")}
    upload_res = client.post(f"/api/v1/instruments/{inst_id}/documents", files=files, data={"kind": "FDR_RECEIPT"})
    assert upload_res.status_code == 200

    detail = client.get(f"/api/v1/instruments/{inst_id}").json()
    assert detail["status"] == "FLAGGED"
    flag_codes = [f["code"] for f in detail["flags"]]
    assert "FORM_DOC_AMOUNT_DISCREPANCY" in flag_codes

def test_12_bank_verification_single_use_token():
    """Bank verification link token can be consumed once; subsequent replay attempts are rejected (400)."""
    db: Session = SessionLocal()
    try:
        inst = db.query(Instrument).first()
        link_res = client.post(f"/api/v1/instruments/{inst.id}/verify/link")
        assert link_res.status_code == 200
        token = link_res.json().get("token")
        assert token

        # First consumption -> 200 OK
        confirm_payload = {
            "decision": "confirmed",
            "officer_email": "nodal@sbi.co.in",
            "remarks": "Bank officer confirms deposit is active with joint lien."
        }
        res1 = client.post(f"/api/v1/bank-verify/{token}", json=confirm_payload)
        assert res1.status_code == 200
        assert res1.json()["success"] is True

        # Second attempt (replay attack) -> MUST FAIL (400)
        res2 = client.post(f"/api/v1/bank-verify/{token}", json=confirm_payload)
        assert res2.status_code == 400
        assert "already been consumed" in res2.json()["detail"].lower()
    finally:
        db.close()

def test_13_instrument_renewal_lineage():
    """Renewing an instrument creates a child instrument with parent_instrument_id and marks parent RENEWED."""
    inst_payload = {
        "institution_id": 1,
        "bank_id": 1,
        "fdr_number": "SBIN-2026-PARENT01",
        "amount": 1000000.0,
        "issue_date": "2021-01-01",
        "maturity_date": "2026-01-01",
        "tenure_days": 1825,
        "interest_rate": 6.8
    }
    create_res = client.post("/api/v1/instruments", json=inst_payload)
    parent_id = create_res.json()["id"]

    renew_payload = {
        "institution_id": 1,
        "bank_id": 1,
        "fdr_number": "SBIN-2026-CHILD01",
        "amount": 1000000.0,
        "issue_date": "2026-01-01",
        "maturity_date": "2031-01-01",
        "tenure_days": 1825,
        "interest_rate": 7.2,
        "purpose": "5-Year Statutory Extension"
    }
    renew_res = client.post(f"/api/v1/instruments/{parent_id}/renew", json=renew_payload)
    assert renew_res.status_code == 200
    r_data = renew_res.json()
    assert r_data["success"] is True
    child_id = r_data["renewed_instrument_id"]

    parent_detail = client.get(f"/api/v1/instruments/{parent_id}").json()
    assert parent_detail["status"] == "RENEWED"

    child_detail = client.get(f"/api/v1/instruments/{child_id}").json()
    assert child_detail["parent_instrument_id"] == parent_id

def test_14_aicte_clause_6_46_release_readiness_and_pdf_certificate():
    """Policy readiness checks prerequisites; finalized release generates genuine PDF certificate."""
    db: Session = SessionLocal()
    try:
        # Immature instrument without documents -> Readiness MUST BE FALSE
        immature_inst = Instrument(
            institution_id=1,
            bank_id=1,
            fdr_number="TEST-IMMATURE-2035",
            amount=500000.0,
            issue_date="2025-01-01",
            maturity_date="2035-01-01",
            tenure_days=3650,
            interest_rate=7.0,
            status="ACTIVE",
            trust_tier="SELF_DECLARED"
        )
        db.add(immature_inst)
        db.commit()
        db.refresh(immature_inst)

        readiness_res = client.get(f"/api/v1/instruments/{immature_inst.id}/release-readiness")
        assert readiness_res.status_code == 200
        r_data = readiness_res.json()
        assert r_data["is_ready"] is False
        assert len(r_data["blockers"]) >= 2  # Maturity, Bank Confirmed, FDR Receipt missing

        # Matured and bank confirmed instrument with receipt -> is_ready is True
        ready_inst = Instrument(
            institution_id=1,
            bank_id=1,
            fdr_number="TEST-READY-2024",
            amount=500000.0,
            issue_date="2014-01-01",
            maturity_date="2024-01-01",
            tenure_days=3650,
            interest_rate=7.0,
            status="MATURED",
            trust_tier="BANK_CONFIRMED"
        )
        db.add(ready_inst)
        db.commit()
        db.refresh(ready_inst)
        doc = Document(instrument_id=ready_inst.id, kind="FDR_RECEIPT", storage_key="test_ready.pdf", sha256="ready_sha")
        db.add(doc)
        db.commit()

        r2 = client.get(f"/api/v1/instruments/{ready_inst.id}/release-readiness").json()
        assert r2["is_ready"] is True
        assert len(r2["blockers"]) == 0

        # Submit release request -> Maker scrutiny -> Checker authorization -> Certificate PDF
        sub_res = client.post(f"/api/v1/instruments/{ready_inst.id}/release-requests", json={"reason": "10-Year Term Completed"})
        assert sub_res.status_code == 200
        req_id = sub_res.json()["release_request_id"]

        maker_token = client.post("/api/v1/auth/login", json={"email": "maker@aicte.gov.in", "password": "Password@123"}).json()["access_token"]
        client.patch(
            f"/api/v1/release-requests/{req_id}/maker-scrutiny",
            headers={"Authorization": f"Bearer {maker_token}"},
            json={"decision": "approved", "remarks": "Scrutiny clear"}
        )

        checker_token = client.post("/api/v1/auth/login", json={"email": "checker@aicte.gov.in", "password": "Password@123"}).json()["access_token"]
        auth_res = client.patch(
            f"/api/v1/release-requests/{req_id}/checker-approval",
            headers={"Authorization": f"Bearer {checker_token}"},
            json={"decision": "approved", "remarks": "Approved discharge"}
        )
        assert auth_res.status_code == 200
        assert auth_res.json()["status"] == "released"

        # Download PDF Certificate
        cert_res = client.get(f"/api/v1/release-requests/{req_id}/certificate")
        assert cert_res.status_code == 200
        assert cert_res.headers["content-type"] == "application/pdf"
        assert cert_res.content.startswith(b"%PDF")
        assert len(cert_res.content) > 500
    finally:
        db.close()

def test_15_tenant_isolation_rbac():
    """Institution Admin can only access their own institution's instruments; other tenant access returns 403."""
    db: Session = SessionLocal()
    try:
        inst1 = db.query(Instrument).filter(Instrument.institution_id == 1).first()
        inst2 = db.query(Instrument).filter(Instrument.institution_id == 2).first()
        assert inst1 and inst2

        # Login as Institution 1 admin (institution_id = 1)
        login_res = client.post("/api/v1/auth/login", json={"email": "institute1@iit.ac.in", "password": "Password@123"})
        assert login_res.status_code == 200
        token_inst1 = login_res.json()["access_token"]

        # Accessing own instrument -> 200 OK
        own_res = client.get(f"/api/v1/instruments/{inst1.id}", headers={"Authorization": f"Bearer {token_inst1}"})
        assert own_res.status_code == 200

        # Attempting to access other institution's instrument -> 403 Forbidden
        other_res = client.get(f"/api/v1/instruments/{inst2.id}", headers={"Authorization": f"Bearer {token_inst1}"})
        assert other_res.status_code == 403
        assert "Tenant Isolation Violation" in other_res.json()["detail"] or "Access denied" in other_res.json()["detail"]

        # AICTE Admin can access both
        admin_token = client.post("/api/v1/auth/login", json={"email": "admin@aicte.gov.in", "password": "Password@123"}).json()["access_token"]
        admin_res1 = client.get(f"/api/v1/instruments/{inst1.id}", headers={"Authorization": f"Bearer {admin_token}"})
        admin_res2 = client.get(f"/api/v1/instruments/{inst2.id}", headers={"Authorization": f"Bearer {admin_token}"})
        assert admin_res1.status_code == 200
        assert admin_res2.status_code == 200
    finally:
        db.close()

def test_16_statutory_reports_csv_export():
    """Statutory reports endpoints return clean CSV data with 200 status."""
    r1 = client.get("/api/v1/reports/pending-verifications?format=csv")
    assert r1.status_code == 200
    assert "text/csv" in r1.headers["content-type"]
    assert "fdr_number" in r1.text

    r2 = client.get("/api/v1/reports/upcoming-maturities?format=csv")
    assert r2.status_code == 200
    assert "text/csv" in r2.headers["content-type"]
    assert "days_to_maturity" in r2.text

    r3 = client.get("/api/v1/reports/missing-documents?format=csv")
    assert r3.status_code == 200
    assert "text/csv" in r3.headers["content-type"]
    assert "missing_records" in r3.text

    r4 = client.get("/api/v1/reports/intervention-cases?format=csv")
    assert r4.status_code == 200
    assert "text/csv" in r4.headers["content-type"]
    assert "primary_intervention_reason" in r4.text
