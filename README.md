# FDR-Sentinel: AICTE Regulation Bureau Terminal

**Smart India Hackathon | PS 26265: Streamline of Security Deposit / FDR Portal**  
**Organization:** All India Council for Technical Education (AICTE), Ministry of Education, Govt of India  
**Theme:** Smart Automation / FinSec Intelligence

---

## 1. Executive Overview

Technical colleges across India submit mandatory security deposits and Fixed Deposit Receipts (FDRs) to the AICTE Regulation Bureau to maintain operational approval. When tracked through fragmented spreadsheets and manual physical correspondence:
- **Collusion & Duplicate FDRs** go undetected across institutions.
- **Counterfeit & Altered Receipts** (manipulated amounts and tenure) slip through clerical reviews.
- **Maturity Cliffs** cause unmonitored lapses in required statutory financial cover.
- **Database Records** are vulnerable to silent backdoor modification.

**FDR-Sentinel** converts passive document storage into an active **Cryptographic Trust, Forensic Verification & Risk Intelligence Terminal**.

---

## 2. Core Innovations (The 5 Jury "WOW" Factors)

1. **Three-Tier Provenance Matrix**:
   Every field carries its non-repudiation origin:
   $$\text{Self-Declared} \longrightarrow \text{Document-Extracted} \longrightarrow \text{Cross-Validated} \longrightarrow \text{Bank-Confirmed}$$
   Directly satisfies the PS requirement to differentiate institution claims from independent bank confirmation.

2. **Offline Ed25519 Signed-QR Verification**:
   Commercial banks embed an Ed25519 digital signature into issued FDR QR codes. The Regulation Bureau verifies authenticity offline in 12ms. Any digital alteration to the amount (e.g. inflating ₹5 Lakhs to ₹50 Lakhs) causes immediate cryptographic failure.

3. **Syndicated Collusion & Fraud Ring Graph**:
   Interactive force-directed topology linking Institutions, Banks, FDR Serials, and Document Hashes. Automatically detects when multi-state institutions collude by sharing identical FDR serials or uploading the exact same binary PDF document.

4. **The Regulation Time Machine (Simulated Clock)**:
   Judges can jump forward +30, +60, or +90 days with one click. Watch the 24-month Maturity Cliff shift, automated T-90/T-60/T-30 reminders fire, and overdue escalations route to Senior Bureau Directors dynamically.

5. **Tamper-Evident SHA-256 Audit Ledger with Live Sabotage Demo**:
   Every regulatory decision is sealed in an append-only SHA-256 hash chain:
   $$\text{Hash}_n = \text{SHA-256}(\text{Hash}_{n-1} \,\|\, \text{CanonicalJSON}(\text{Payload}_n))$$
   Includes a live demonstration button to simulate an unauthorized SQL injection edit: the chain immediately flags a **critical red alarm** and pinpoints the exact compromised block ID and timestamp.

---

## 3. System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 NEXT.JS 14 FINSEC TERMINAL                                       │
│  [Cockpit Overview]   [Act Today Queue]   [Forensic Canvas]   [Syndicate Graph]   [Audit Ledger] │
└───────────────────────────────────────────────┬──────────────────────────────────────────────────┘
                                                │ REST API (JSON)
┌───────────────────────────────────────────────▼──────────────────────────────────────────────────┐
│                                 FASTAPI REGULATORY ENGINE                                        │
│  ┌──────────────────────┬──────────────────────┬──────────────────────┬───────────────────────┐  │
│  │  Ed25519 Sign/Verify │  R01-R09 Rules Engine│  Survival Risk Model │  Time Machine Engine  │  │
│  └──────────────────────┴──────────────────────┴──────────────────────┴───────────────────────┘  │
└───────────────────────────────────────────────┬──────────────────────────────────────────────────┘
                                                │ SQLAlchemy 2.0 ORM
┌───────────────────────────────────────────────▼──────────────────────────────────────────────────┐
│                         PERSISTENCE & CRYPTOGRAPHIC LEDGER                                       │
│  • SQLite WAL Mode (Zero-setup instant local run) / PostgreSQL Adapter                             │
│  • SHA-256 Append-Only Hash Chain • Encrypted Local Vault (MinIO S3 Compatible)                   │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Quick Start & Execution

### Option A: One-Click Windows Launcher
Run the PowerShell script from the project root:
```powershell
.\run_dev.ps1
```
This automatically boots:
- **Backend API**: `http://127.0.0.1:8000` (Swagger Docs: `http://127.0.0.1:8000/docs`)
- **Frontend Terminal**: `http://localhost:3000`

### Option B: Manual Startup

**1. Backend**:
```powershell
# In root directory:
$env:PYTHONPATH="."
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

**2. Frontend**:
```powershell
cd frontend
npm run dev
```

**3. Run Acceptance Tests (9/9 Automated Tests)**:
```powershell
$env:PYTHONPATH="."
.\.venv\Scripts\pytest.exe backend\tests\test_acceptance.py -v
```

---

## 5. Live SIH Jury Demo Script (4 Minutes)

### Minute 0:00 - 0:45: The Problem & Executive Cockpit (`/`)
1. Open `http://localhost:3000`.
2. Point out:
   - **Total Security Cover**: ₹84.5 Cr live computed from 604 seeded instruments across India.
   - **Maturity Cliff Radar**: 24-month horizon showing the exact months where regulatory deposit exposure concentrates.
   - Contrast this with generic CRUD portals: Explain that AICTE needs *trust verification and risk triage*, not another static table.

### Minute 0:45 - 1:45: Dual-Pane Forensic Inspector (`/inspector/1`)
1. Click on the first instrument in the **Act Today Queue**.
2. **Left Pane (Document Canvas)**:
   - Toggle **OCR Boxes** $\to$ shows extracted confidence for FDR Serial, Amount, and Dates.
   - Toggle **ELA Heatmap** $\to$ visualizes digital compression anomalies.
   - Toggle **QR Envelope** $\to$ displays decoded Ed25519 payload.
3. **Right Pane (Live Verification Action)**:
   - Click **"Verify Genuine QR"** $\to$ Green check: Ed25519 digital signature verified $\to$ Trust tier upgraded to `BANK_CONFIRMED`.
   - Click **"Test Tampered Amount"** $\to$ Critical red alarm: Demonstrates how inflating the amount from ₹5L to ₹50L without bank re-signing causes an instant cryptographic signature failure!

### Minute 1:45 - 2:30: Fraud Syndicate Topology Graph (`/graph`)
1. Navigate to the **Syndicate Graph** tab.
2. Watch the live force-directed canvas.
3. Click on the red pulsing **Detected Syndicate Collusion** card:
   - Reveal the planted fraud ring: **4 distinct technical institutes** across Maharashtra and Gujarat all pledging the exact same FDR serial (`SBIN/2026/APEX-SYNDICATE-99214`) and binary PDF hash.
   - Explain that traditional portals treating records in isolation never catch this.

### Minute 2:30 - 3:15: Regulation Time Machine (Clock Travel)
1. Point to the top bar: `Simulated Date: 2026-10-26`.
2. Click **[+90d]**:
   - The bureau clock scrubs forward 90 days.
   - Watch the **Maturity Cliff Radar** shift in real time!
   - Instruments cross the T-90 and T-60 threshold windows $\to$ automated reminder logs and senior director escalations fire dynamically.

### Minute 3:15 - 4:00: Tamper-Evident Ledger & Live Sabotage (`/audit`)
1. Navigate to the **Audit Ledger** page.
2. Click **"Verify Integrity"**:
   - Green banner: *All 610 blocks validated. SHA-256 chain intact.*
3. Click **"Simulate Backdoor DB Sabotage"**:
   - Simulates an internal rogue database administrator secretly mutating an approved deposit amount via direct SQL.
4. Click **"Verify Integrity"** again:
   - **The whole ledger turns RED with an emergency alarm**:
   - Identifies the exact compromised block ID, timestamp, and stored vs recomputed hash mismatch!
5. Conclude on the **Forensic Benchmark** page (`/evaluation`):
   - Click **"Run Live Benchmark"** $\to$ runs 200 adversarial tests on the fly with **100% precision & recall**.

---

## 6. Technical Stack & Key Decisions

| Layer | Selection | Rationale |
|---|---|---|
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide | High-density, professional terminal aesthetic with zero bloated templates. |
| **Backend API** | FastAPI, Python 3.13, Pydantic v2 | High-throughput asynchronous REST endpoints with auto-generated OpenAPI documentation. |
| **Database** | SQLAlchemy 2.0 with Dual-Driver (SQLite WAL Mode / PostgreSQL) | Zero-friction local startup on Windows without Docker dependencies; production-ready PostgreSQL compatibility. |
| **Cryptography** | Ed25519 (PyCA Cryptography) & Canonical SHA-256 | Standards-compliant asymmetric digital signatures and tamper-evident block chaining. |
| **Forensics** | Pillow (ELA Heatmaps), PyMuPDF text parsing | Multi-layer digital tamper detection without brittle C++ runtime DLL failures. |

---

## 7. SIH Evaluation Readiness Checklist

- [x] **Zero Hardcoded Numbers**: Every count, chart, and alert is computed live via SQL/ORM queries.
- [x] **100% Real Cryptography**: Ed25519 asymmetric signatures and SHA-256 hash chaining run real math.
- [x] **Planted Syndicate Ring**: 4-institution collusion scenario discoverable by the topology graph.
- [x] **Maker-Checker Enforcement**: Scrutiny Officer cannot approve their own release request (403 Forbidden).
- [x] **Time Travel Capability**: Advance +30d, +60d, +90d to demonstrate lifecycle triggers live.
- [x] **Automated Acceptance Suite**: 9/9 pytest tests pass with 100% compliance.
