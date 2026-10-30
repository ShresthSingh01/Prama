from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_all_four_demo_showcase_scenarios():
    """
    Validates that each of the 4 demo scenarios yields a 100% distinct,
    deterministic, and mathematically correct outcome for jury evaluations.
    """
    # 1. Genuine 10-Yr Deposit
    res_gen = client.get("/api/v1/mock-bank/sample-case/genuine_10yr").json()
    inst_gen = client.post("/api/v1/instruments", json={
        "institution_id": 1, "bank_id": 1, "fdr_number": res_gen["fdr_number"],
        "amount": res_gen["amount"], "issue_date": res_gen["issue_date"],
        "maturity_date": res_gen["maturity_date"], "tenure_days": res_gen["tenure_days"],
        "interest_rate": res_gen["interest_rate"], "purpose": res_gen["purpose"]
    }).json()
    pdf_gen = client.get(f"/api/v1/mock-bank/generate-sample-pdf?fdr_number={res_gen['fdr_number']}&amount={res_gen['amount']}&case=genuine_10yr")
    client.post(f"/api/v1/instruments/{inst_gen['id']}/documents", files={"file": ("gen.pdf", pdf_gen.content, "application/pdf")}, data={"kind": "FDR_RECEIPT"})
    detail_gen = client.get(f"/api/v1/instruments/{inst_gen['id']}").json()
    assert len(detail_gen["flags"]) == 0
    assert detail_gen["risk_band"] == "LOW"

    # 2. Tampered Amount Case (Rs 50L Form vs Rs 5L Receipt)
    res_tam = client.get("/api/v1/mock-bank/sample-case/tampered_amount").json()
    inst_tam = client.post("/api/v1/instruments", json={
        "institution_id": 2, "bank_id": 1, "fdr_number": res_tam["fdr_number"],
        "amount": res_tam["amount"], "issue_date": res_tam["issue_date"],
        "maturity_date": res_tam["maturity_date"], "tenure_days": res_tam["tenure_days"],
        "interest_rate": res_tam["interest_rate"], "purpose": res_tam["purpose"]
    }).json()
    pdf_tam = client.get(f"/api/v1/mock-bank/generate-sample-pdf?fdr_number={res_tam['fdr_number']}&amount={res_tam['amount']}&case=tampered_amount")
    client.post(f"/api/v1/instruments/{inst_tam['id']}/documents", files={"file": ("tam.pdf", pdf_tam.content, "application/pdf")}, data={"kind": "FDR_RECEIPT"})
    detail_tam = client.get(f"/api/v1/instruments/{inst_tam['id']}").json()
    flag_codes_tam = [f["code"] for f in detail_tam["flags"]]
    assert "FORM_DOC_AMOUNT_DISCREPANCY" in flag_codes_tam
    assert detail_tam["status"] == "FLAGGED"

    # 3. Tenure Anomaly Case (Declared 3652d vs Maturity 2029-01-15)
    res_ten = client.get("/api/v1/mock-bank/sample-case/tenure_anomaly").json()
    inst_ten = client.post("/api/v1/instruments", json={
        "institution_id": 3, "bank_id": 2, "fdr_number": res_ten["fdr_number"],
        "amount": res_ten["amount"], "issue_date": res_ten["issue_date"],
        "maturity_date": res_ten["maturity_date"], "tenure_days": res_ten["tenure_days"],
        "interest_rate": res_ten["interest_rate"], "purpose": res_ten["purpose"]
    }).json()
    pdf_ten = client.get(f"/api/v1/mock-bank/generate-sample-pdf?fdr_number={res_ten['fdr_number']}&amount={res_ten['amount']}&case=tenure_anomaly")
    client.post(f"/api/v1/instruments/{inst_ten['id']}/documents", files={"file": ("ten.pdf", pdf_ten.content, "application/pdf")}, data={"kind": "FDR_RECEIPT"})
    detail_ten = client.get(f"/api/v1/instruments/{inst_ten['id']}").json()
    flag_codes_ten = [f["code"] for f in detail_ten["flags"]]
    assert "R02_TENURE_MATURITY_MISMATCH" in flag_codes_ten
    assert detail_ten["status"] == "FLAGGED"

    # 4. Below Minimum Security (Rs 2.5L < Rs 5.0L Baseline)
    res_sub = client.get("/api/v1/mock-bank/sample-case/sub_minimum").json()
    inst_sub = client.post("/api/v1/instruments", json={
        "institution_id": 4, "bank_id": 3, "fdr_number": res_sub["fdr_number"],
        "amount": res_sub["amount"], "issue_date": res_sub["issue_date"],
        "maturity_date": res_sub["maturity_date"], "tenure_days": res_sub["tenure_days"],
        "interest_rate": res_sub["interest_rate"], "purpose": res_sub["purpose"]
    }).json()
    pdf_sub = client.get(f"/api/v1/mock-bank/generate-sample-pdf?fdr_number={res_sub['fdr_number']}&amount={res_sub['amount']}&case=sub_minimum")
    client.post(f"/api/v1/instruments/{inst_sub['id']}/documents", files={"file": ("sub.pdf", pdf_sub.content, "application/pdf")}, data={"kind": "FDR_RECEIPT"})
    detail_sub = client.get(f"/api/v1/instruments/{inst_sub['id']}").json()
    flag_codes_sub = [f["code"] for f in detail_sub["flags"]]
    assert "R03_INSUFFICIENT_SECURITY_AMOUNT" in flag_codes_sub
    assert detail_sub["status"] == "FLAGGED"
