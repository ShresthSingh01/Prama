# FDR-Sentinel
### A Trust-Scored, Tamper-Evident Security Deposit / FDR Lifecycle Platform for AICTE

**Smart India Hackathon | PS 26265 – Streamline of Security Deposit / FDR Portal**
Organization: AICTE | Department: Regulation Bureau | Category: Software | Theme: Smart Automation

---

## 1. One-line pitch

> We don't just store FDRs. We give every FDR a **verifiable trust level**, **predict which ones will fail before they do**, and keep a **tamper-proof record** of every action.

## 2. The problem we are solving

AICTE manages security deposits and FDRs for thousands of institutions. Today this is handled through fragmented records, manual correspondence and multiple trackers. This causes:

| Pain point | Consequence |
|---|---|
| No single institution-wise, instrument-wise record | Inaccurate, outdated view of deposit status |
| Manual verification with banks | Slow turnaround, backlog of unverified FDRs |
| Forged, altered or re-used FDRs are hard to detect | Financial and regulatory risk |
| Maturity/renewal dates tracked manually | Missed deadlines, lapsed security cover |
| Release/refund requests tracked by email | Delays, no accountability |
| No distinction between "claimed" and "confirmed" data | Officials act on unverified information |

### The deeper problem (our insight)
This is not a data-entry problem. It is a **trust, time and accountability** problem:
1. **Trust:** Is this FDR genuine, and who confirmed it?
2. **Time:** Which instruments are about to expire, and which institutions are likely to miss renewal?
3. **Accountability:** Who did what, when, and can the record be altered afterwards?

## 3. Why generic solutions fall short

| Common approach | Limitation |
|---|---|
| CRUD portal with upload and storage | Stores documents but does not judge their authenticity |
| OCR to extract fields | Reads text, cannot detect tampering |
| Email/SMS reminders at fixed dates | Treats all FDRs equally; no prioritisation |
| Simple status dashboard | Reports the past, does not guide action |
| "Integrate with bank API" | Banks have no common verification API; not realistic |
| Plain database audit logs | Can be silently edited |

## 4. Our solution

FDR-Sentinel is a centralized portal with five core ideas that together convert a record-keeping system into a **decision-support and trust system**.

### Innovation 1 – Provenance-tagged trust tiers
Every field of every FDR carries its source:
`Self-declared → Document-extracted → Cross-validated → Bank-confirmed`
Each instrument shows a trust badge. This directly implements the PS requirement to distinguish information submitted by an institution from information confirmed by a bank.

### Innovation 2 – Bank-signed QR verification + verify-link fallback
Because banks lack a common API, we propose a practical, standards-based mechanism:
- **Signed-QR FDR:** banks embed a QR with the FDR details and a digital signature (Ed25519/PKI). The portal verifies it **offline in milliseconds**. Any edit to amount or dates breaks the signature.
- **Verify-Link fallback:** for legacy FDRs, the bank's nodal officer receives a one-time, expiring tokenized link, confirms or denies using OTP, and the response is recorded.
- **Manual fallback** with mandatory evidence.
This is a deployable path, not a fictional API.

### Innovation 3 – Multi-layer forgery and discrepancy detection
- Rules: bank-specific FDR number format, maturity = issue + tenure, plausible interest rate, minimum deposit amount, holder name match.
- Forensics: PDF metadata anomalies, image Error Level Analysis, region-level tamper boxes.
- Layout fingerprinting: a one-class anomaly model learns what a genuine FDR from each bank looks like.
- **Cross-institution duplicate detection:** the same FDR number or document hash used by two institutions is flagged as critical.
- **Explainable flags:** every alert shows *why* with highlighted regions, so officers can trust and act on it.
- **Active learning:** officer decisions retrain the model, and accuracy improves with use.

### Innovation 4 – Predictive risk and priority queue
Instead of a flat list sorted by date, officials get an **"Act Today" queue** ranked by risk:
`urgency × amount × institution delay history × open flags × missing documents`
Optionally, a **survival-analysis model (Cox PH)** estimates each institution's probability of missing renewal, enabling proactive outreach before reminders are even due. A **maturity-cliff heatmap** shows months where many instruments expire together.

### Innovation 5 – Hash-chained, tamper-evident audit trail
Every action (submission, verification, edit, approval, release) is appended with the hash of the previous entry. Any tampering breaks the chain, and a one-click **"Verify Integrity"** proves the record is untouched. Release certificates carry a QR linking to their audit hash.

### Innovation 6 – OKF (Open Knowledge Format) Dynamic Policy Bundle
Codifies AICTE regulations, automated rules (R01-R09), bank format standards, and release preconditions as human-editable, Git-versioned Markdown. Non-critical thresholds (tolerance days, minimum deposits, interest rate bounds) bind dynamically to the rules engine, allowing instant policy updates with hot-reload audit tracking.

### Innovation 7 – PageIndex Hierarchical Compliance Copilot
Unlike standard chunked vector RAG that loses legal context, PageIndex parses long AICTE Approval Process Handbooks into an indexed document tree (Document -> Chapter -> Section -> Clause). Answers officer questions with exact section and page citations verified against retrieved passages.

### Innovation 8 – Guarded Multi-Provider LLM/SLM Intelligence
Hybrid engine pairing Online Google Gemini API with local SLM (Ollama) fallback:
- **Task A (Extraction):** Mandatory substring hallucination guard eliminates invented values.
- **Task B (Flag Explanations):** Plain English and Hindi explanations with numeric/date fidelity guards.
- **Task C (Reminders):** Hindi drafts verifying FDR serials and amounts remain unaltered.
- **Task D (NL Search):** Converts natural language into strict Pydantic filter objects (never SQL).
- **Decision Isolation:** LLM/SLM outputs never decide trust tiers, verification status, or approvals.

### Innovation 9 – High-DPI Interactive Vector Visual Graphs (@xyflow/react)
Replaces blurry canvas simulations with modern React Flow vector graphics for both Syndicate Collusion Rings and OKF Knowledge Concept Graphs, featuring hardware-accelerated pan/zoom, custom styled nodes, glowing collusion highlights, and inspection drawers.

### Additional capabilities
- Fraud-ring graph analytics linking institutions, banks/branches and document hashes to expose coordinated misuse.
- Maker-checker-approver release workflow with precondition checks.
- Configurable reminder and escalation ladder (institution → officer → senior officer).
- Role-based dashboards, search, CSV/PDF reports, English + Hindi labels.

## 5. How it works (end-to-end flow)

1. **Submit:** institution uploads FDR and details; document hashed and stored encrypted.
2. **Extract:** OCR reads fields; institution confirms; provenance recorded.
3. **Auto-check:** rules engine, forensics and duplicate detection run; flags raised with explanations.
4. **Verify:** signed-QR check, or verify-link to the bank, or manual; trust tier upgraded.
5. **Scrutinise:** officer reviews side-by-side submitted vs extracted vs confirmed values and records observations.
6. **Monitor:** scheduler tracks maturity, sends reminders, escalates overdue cases, recomputes risk daily.
7. **Renew/Replace:** new linked instrument created; full history preserved.
8. **Release/Refund:** request → precheck → maker → checker → certificate, all audited.

**Lifecycle states:** Submitted → Auto-checked → Under Scrutiny → Verified → Active → Expiring → Renewed/Matured → Release Requested → Approved → Released (with Flagged, Rejected, Overdue branches).

## 6. System architecture

```
Institution Portal ─┐                       ┌─ Bank Adapters (Signed-QR / Verify-Link / Manual)
AICTE Officer UI ───┼─► API Gateway ─►      │
Bank Officer Link ──┘   (FastAPI + RBAC)    ├─ AICTE Approval System (integration interface)
                               │            └─ SMS / Email / Notification gateway
         ┌─────────────────────┼──────────────────────┐
   Document Service       Lifecycle Engine        Rules & Risk Engine
   (OCR + forensics)      (state machine +        (validation, duplicates,
   Encrypted storage       event sourcing)          risk + survival model)
         └─────────────────────┼──────────────────────┘
                   PostgreSQL (RBAC / row-level isolation)
                   + Hash-chained Audit Log
                               │
               Scheduler (Celery + Redis): reminders, escalations, risk recompute
                               │
                 Dashboards, reports, graph analytics
```

## 7. Technology stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js, TypeScript, Tailwind, Recharts, Cytoscape.js | Role-based UI, charts, fraud-ring graph |
| Backend | FastAPI (Python), SQLAlchemy, Pydantic | REST APIs, business logic |
| Database | PostgreSQL | Records, provenance, audit chain |
| Jobs | Celery + Redis | Scheduling, reminders, async OCR |
| Storage | MinIO (S3-compatible), AES-256 | Encrypted document storage |
| OCR | PaddleOCR / Tesseract | Field extraction |
| Forensics | OpenCV, Pillow, NumPy | Tamper detection, ELA |
| ML | scikit-learn, lifelines, networkx | Anomaly model, survival analysis, graph rings |
| Cryptography | Ed25519 (PyNaCl), SHA-256 | Signed QR, hash chain |
| Security/Auth | JWT, RBAC, OTP, Keycloak (optional) | Access control |
| DevOps | Docker Compose, pytest, Playwright | Reproducible deploy and testing |

## 8. Security and compliance

- Role-based access (Institution, Scrutiny Officer, Senior Officer, Bank Officer, Admin) enforced server-side
- Institution-level data isolation
- Encryption in transit and at rest; hashed credentials; OTP for sensitive actions
- Maker-checker separation for approvals and releases
- Append-only audit with integrity verification
- Bank officer sees only the single FDR in question through a one-time link

## 9. Integration plan

| System | Approach |
|---|---|
| Banks | Signed-QR standard + verify-link; adapter pattern allows future bank APIs |
| AICTE approval portal | Interface for institution and approval-cycle data (mocked in prototype) |
| Notifications | SMS/Email/WhatsApp gateway (mocked in prototype) |
| Identity | DigiLocker / e-sign extension path |

## 10. Prototype and how we prove it works

We demonstrate a **live, database-driven prototype**, not static screens:
- Genuine signed FDR → `Bank-confirmed` badge
- Edited-amount FDR → signature failure with highlighted region
- Duplicate FDR from another institution → critical flag and ring graph link
- **Simulated clock** advances 80 days → reminders and escalations fire; dashboard changes
- Renewal creates linked history; release completes with maker-checker and certificate
- Database row tampered → audit integrity check fails
- Evaluation page shows precision/recall from a generated set of genuine and forged FDRs

## 11. Measurable impact

| PS expectation | How FDR-Sentinel shows it |
|---|---|
| Record accuracy | Provenance + validation rules reduce unverified fields; trust-tier distribution |
| Verification turnaround | Time from submission to verified: automated vs manual path |
| Timely renewal monitoring | Expiries caught 30+ days early; reminders and escalations logged |
| Reduced manual effort | Automated checks, reminders and reports replace trackers |
| Visibility of pending cases | Live dashboard and risk-ranked queue |

## 12. Novelty summary: what we do differently

| Generic solution | FDR-Sentinel |
|---|---|
| Stores documents | Assigns a **trust tier** to every field |
| Assumes bank API exists | **Signed-QR + verify-link** deployable today |
| OCR only | OCR + forensics + layout anomaly + **cross-institution duplicate detection** |
| Date-based reminders | **Risk-ranked queue** with survival-based lapse prediction |
| Editable logs | **Hash-chained audit** with integrity check |
| Black-box alerts | **Explainable flags** with evidence overlays |
| Isolated records | **Fraud-ring graph** analytics |

## 13. Scalability and future scope

- Onboard more banks via the adapter layer; push for a national signed-FDR QR standard
- Real-time bank API integration where available
- Extend to other AICTE financial instruments (bank guarantees)
- Federated learning across regional offices
- Public verification of release certificates
- Research extension: *one-class forgery detection for financial instruments using synthetic training data*

## 14. Feasibility and honest scope

- Bank and AICTE integrations are demonstrated using mock services with defined interfaces.
- Forgery-detection metrics are measured on a synthetic dataset; real-world tuning needs real samples.
- The signed-QR approach requires bank participation, which is why a verify-link and manual fallback are included.

## 15. Team value proposition

A secure, explainable, deployable system that moves AICTE from **tracking FDRs** to **trusting, predicting and proving** them.
