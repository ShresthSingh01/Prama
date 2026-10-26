# Prama: Product Requirements Document (PRD)
**SIH PS 26265 – Streamline of Security Deposit / FDR Portal (AICTE Regulation Bureau)**
Audience: AI coding agent + student team. Goal: a working, demo-able prototype where every number on screen is computed from real data in the database. No hardcoded dashboards.

---

## 0. Instructions to the AI agent (read first)

1. Build exactly what is specified. Prefer simple, working code over clever code.
2. **Anti-fake rule:** No dashboard value, chart, alert or status may be hardcoded in frontend or backend code. All must come from DB queries or computed services. Seed data is allowed only through `scripts/seed.py` writing to the DB.
3. Every feature must have at least one automated test and be reachable from the UI.
4. Build in the phase order in Section 14. After each phase, run tests and commit.
5. Anything external (bank, AICTE system, SMS) is a **clearly labelled mock service** that runs as a real separate container with real HTTP calls. Label it "MOCK" in the UI and README.
6. Provide `docker compose up` as the single command to run everything, plus `make seed` and `make demo-reset`.

---

## 1. Problem summary

AICTE institutions submit security deposits / FDRs. Officials track them manually: verification is slow, forged or duplicated FDRs are hard to catch, maturity and renewal dates get missed, release/refund is untraceable.

**Solution:** a centralized portal with (a) trust-tiered verification of each instrument, (b) automated forgery and discrepancy detection, (c) lifecycle tracking with reminders and escalation, (d) risk-ranked work queue, (e) release workflow, (f) tamper-evident audit trail.

## 2. Goals and measurable success criteria

| # | Goal | Metric the demo must show (computed live) |
|---|------|------|
| G1 | Faster verification | Median time from submit to verified tier, manual vs. automated path |
| G2 | Catch bad FDRs | Precision / recall on synthetic forgery test set (>= 100 samples) |
| G3 | No missed deadlines | Count of reminders fired, escalations, and expiries caught >= 30 days early |
| G4 | Visibility | Dashboard counts match DB counts (test asserts this) |
| G5 | Accountability | Audit chain integrity check passes; fails after deliberate DB tampering |

## 3. Users and roles (RBAC)

| Role | Can do |
|------|--------|
| Institution Admin | Submit FDR, upload docs, respond to flags, request renewal/release, see own records only |
| Scrutiny Officer (Maker) | Review submissions, run verification, record observations, raise flags |
| Senior Officer (Checker/Approver) | Approve verification, approve/reject release |
| Bank Officer (external, tokenized link, no login) | Confirm or deny an FDR via one-time link + OTP |
| Admin | Configure rules, reminder schedules, users, view audit |

Auth: JWT login with email + password (+ optional OTP via mock SMS). Enforce RBAC in backend, not only UI. Institution users must be isolated by `institution_id` (Postgres row-level security or enforced query filter, with a test).

## 4. Scope

**In scope (MUST):** submission, OCR extraction, rules engine, forgery checks, duplicate detection, trust tiers, signed-QR verification, mock bank verify-link, lifecycle state machine, scheduler with simulated clock, reminders/escalations, risk-ranked queue, release workflow (maker-checker), hash-chained audit, dashboard + reports + CSV export, synthetic data + forgery generator, evaluation page.

**SHOULD:** fraud-ring graph view, explainable flags with bounding boxes, survival-model lapse prediction, Hindi UI toggle.

**COULD:** WhatsApp-style chat intake (mock), what-if exposure simulator.

**Out of scope:** real bank integration, real payments, production deployment.

## 5. Tech stack

- Frontend: Next.js (React, TypeScript), Tailwind, Recharts, a graph lib (cytoscape.js or react-force-graph)
- Backend: FastAPI (Python 3.11), SQLAlchemy 2 + Alembic, Pydantic
- DB: PostgreSQL 15
- Queue/scheduler: Celery + Redis (Celery beat)
- Files: MinIO (S3 API), AES-256 server-side or app-level encryption
- OCR: PaddleOCR (fallback Tesseract)
- Image forensics: OpenCV, Pillow, numpy (error level analysis, font/edge anomalies)
- ML: scikit-learn, lifelines (survival), networkx (graph + community detection)
- Crypto: PyNaCl or `cryptography` (Ed25519 signatures)
- Mock services: separate FastAPI apps `mock-bank`, `mock-sms-email`, `mock-aicte-approval`
- Tests: pytest, Playwright (e2e)
- Orchestration: Docker Compose

## 6. Repository structure

```
prama/
  docker-compose.yml  Makefile  README.md
  backend/app/{api,core,models,services,rules,forensics,jobs,schemas}/
  backend/tests/
  frontend/ (Next.js)
  mock-bank/  mock-notify/  mock-aicte/
  ml/ (training + evaluation notebooks/scripts)
  scripts/{seed.py,forge_generator.py,demo_reset.py}
  docs/{architecture.md,demo_script.md}
```

## 7. Data model (PostgreSQL)

- `users(id, name, email, password_hash, role, institution_id nullable, created_at)`
- `institutions(id, aicte_id, name, state, district, email, phone, compliance_score)`
- `banks(id, name, ifsc_prefix, fdr_number_regex, layout_fingerprint jsonb, public_key)`
- `instruments(id, institution_id, bank_id, fdr_number, amount, issue_date, maturity_date, tenure_days, interest_rate, purpose, status, trust_tier, risk_score, risk_band, parent_instrument_id nullable, created_at)`
- `field_provenance(id, instrument_id, field_name, value, source ENUM[self_declared, ocr_extracted, cross_validated, bank_confirmed], confidence, updated_at)`
- `documents(id, instrument_id, kind, storage_key, sha256, phash, mime, uploaded_by, created_at)`
- `ocr_results(id, document_id, raw_text, fields jsonb, boxes jsonb, engine, created_at)`
- `flags(id, instrument_id, code, severity, explanation, evidence jsonb, status[open, resolved, dismissed], raised_by[system, user], created_at, resolved_by, resolved_at)`
- `verifications(id, instrument_id, method[signed_qr, verify_link, manual], result[confirmed, denied, pending, failed], token_hash, expires_at, responded_at, responder_email, evidence jsonb)`
- `reminders(id, instrument_id, rule_id, due_at, sent_at, channel, level, status)`
- `reminder_rules(id, name, days_before int, level int, channel, recipient_role, active)`
- `release_requests(id, instrument_id, requested_by, reason, status[submitted, precheck_failed, under_review, approved, rejected, released], maker_id, checker_id, created_at, decided_at)`
- `observations(id, instrument_id, author_id, text, created_at)`
- `audit_log(id bigserial, ts, actor_id, actor_role, action, entity_type, entity_id, payload jsonb, prev_hash, hash)`
- `system_clock(id=1, offset_days int)` for demo time travel
- `eval_runs(id, dataset, tp, fp, tn, fn, precision, recall, f1, created_at)`

Indexes on `instruments(institution_id, status, maturity_date)`, `instruments(fdr_number, bank_id)` UNIQUE-check handled by duplicate logic (not DB unique, so duplicates can be detected and flagged), `documents(sha256)`, `documents(phash)`.

## 8. Lifecycle state machine

States: `SUBMITTED -> AUTO_CHECKED -> UNDER_SCRUTINY -> VERIFIED -> ACTIVE -> EXPIRING -> (RENEWED | MATURED) -> RELEASE_REQUESTED -> RELEASE_APPROVED -> RELEASED`; side states `FLAGGED`, `REJECTED`, `OVERDUE`.

Rules:
- Transitions only via `LifecycleService.transition()`, which validates allowed transitions, writes audit log, and emits events.
- `EXPIRING` is set by scheduler when `days_to_maturity <= 90` (configurable).
- `RENEWED` creates a **new** instrument with `parent_instrument_id` set; history is a linked chain.
- Release precheck: instrument must be `MATURED` or approval cycle closed (flag in mock-aicte), no open flags, trust tier >= `cross_validated`.
- Maker-checker: `maker_id != checker_id` enforced in backend.

## 9. Core modules (functional requirements)

### 9.1 Submission and document intake
- Institution fills a form and uploads PDF/JPG (FDR) + optional deposit confirmation.
- Store file in MinIO, compute `sha256` and perceptual hash.
- Run OCR asynchronously; extract: FDR number, bank name, amount, issue date, maturity date, rate, holder name. Show extracted values next to the form; institution confirms/edits. Record provenance: typed values = `self_declared`, OCR values = `ocr_extracted`; agreement of both upgrades to `cross_validated`.

### 9.2 Rules engine (`backend/app/rules`)
Each rule is a pure function returning `Flag | None`, registered in a registry, with unit tests.
- R01 FDR number matches bank regex
- R02 maturity_date == issue_date + tenure (tolerance 1 day)
- R03 amount >= required deposit for institution category (config table)
- R04 interest rate within plausible band for issue date
- R05 issue date not in future; maturity in future for ACTIVE
- R06 form value vs OCR value mismatch
- R07 holder name fuzzy-matches institution/trust name
- R08 duplicate: same `(bank, fdr_number)` or same document sha256/phash near-match across **different** institutions = CRITICAL
- R09 bank layout deviation score from learned fingerprint
Each flag stores `code, severity, explanation, evidence` (bounding boxes where available).

### 9.3 Forgery / tamper forensics
- PDF metadata check (producer/editor tool, modification date after creation).
- Error Level Analysis on images; report suspicious regions as boxes.
- Font/stroke inconsistency in amount and date regions (simple heuristic: local sharpness/noise variance outliers).
- Layout anomaly: one-class model (IsolationForest or OneClassSVM) on layout features per bank, trained from seeded genuine samples; score exposed as R09.
- Active learning: officer decisions (genuine/forged) are stored and `scripts/retrain.py` retrains; evaluation page shows metrics before and after.

### 9.4 Signed-QR verification (flagship feature)
- `mock-bank` issues FDR PDFs containing a QR with payload `{bank_id, fdr_number, amount, issue_date, maturity_date, holder}` plus an **Ed25519 signature**; bank public keys stored in `banks.public_key`.
- Backend decodes the QR (pyzbar/opencv), verifies the signature offline, compares payload with form/OCR values. Success => field provenance `bank_confirmed`, instrument `trust_tier = BANK_CONFIRMED`.
- Tampered PDF/QR (changed amount) must fail signature verification. Include a test.

### 9.5 Verify-link (fallback for FDRs without QR)
- System creates one-time token (store hash only), emails the bank nodal address via `mock-notify`, link expires in 7 days.
- Bank officer opens `/bank-verify/{token}`, sees FDR details (no other data), enters OTP, clicks Confirm/Deny with remark. Result recorded in `verifications`, provenance upgraded or flag raised.
- Reuse of a token or expiry must be rejected (tested).

### 9.6 Trust tiers
`SELF_DECLARED < DOC_EXTRACTED < CROSS_VALIDATED < BANK_CONFIRMED`. Computed from `field_provenance` of critical fields (number, amount, maturity). Shown as a badge everywhere.

### 9.7 Scheduler and simulated clock
- All time-dependent logic uses `now()` from `ClockService` = real time + `system_clock.offset_days`.
- Admin/demo endpoint `POST /demo/advance-clock {days}` advances it and triggers the scheduler run immediately (so a video can show 80 days passing).
- Daily job: update statuses (EXPIRING, MATURED, OVERDUE), create reminders from `reminder_rules` (e.g., T-90, T-60, T-30, T-7, overdue +1, +7, +15 escalation to senior), send via `mock-notify`, recompute risk scores.
- Escalation ladder: L1 institution, L2 scrutiny officer, L3 senior officer. Rules editable in admin UI.

### 9.8 Risk scoring and priority queue
- Baseline: `risk = w1*urgency(days_to_maturity) + w2*log(amount) + w3*institution_delay_history + w4*open_flags_severity + w5*missing_docs`; weights in config; output 0–100 and band (Low/Med/High/Critical).
- SHOULD: survival model (lifelines Cox PH) trained on seeded historical renewals to output `P(lapse)`; show it beside the baseline score with top contributing features.
- UI: "Act Today" queue sorted by risk with reason chips.

### 9.9 Fraud-ring graph (SHOULD)
- networkx graph: nodes = institutions, banks/branches (from IFSC), document hashes, FDR numbers; edges by shared attributes (same hash, same branch, sequential FDR numbers, same uploader IP/device).
- Community detection; show clusters with >= 3 institutions sharing anomalies. Render interactively; clicking a node opens the related instruments.
- Seed at least one planted ring so it is discoverable by the algorithm (not hardcoded).

### 9.10 Release / refund workflow
- Institution submits request with reason; system runs prechecks (Section 8); Maker reviews, Checker approves/rejects; on approval status `RELEASED` and a release certificate PDF is generated with QR to verify its audit hash.
- Every step audited; rejection requires remark.

### 9.11 Audit trail (hash chain)
- Append-only `audit_log`; `hash = SHA256(prev_hash || canonical_json(entry))`.
- DB user for app has INSERT/SELECT only on this table (no UPDATE/DELETE).
- `GET /audit/verify` recomputes the chain and returns first broken id. UI button "Verify integrity". Demo: manually UPDATE a row via psql, verify fails.

### 9.12 Dashboard and reports
All widgets are API-driven:
- KPI cards: Active, Expiring (30/60/90), Matured, Renewed, Released, Pending verification, Flagged.
- Charts: maturity timeline by month (heatmap of cliffs), status distribution, trust-tier distribution, state-wise exposure, average verification time.
- Tables: search/filter/sort instruments, per-instrument timeline (documents, flags, verifications, observations, audit events).
- Reports (CSV/PDF export): pending verifications, upcoming maturities, missing documents, discrepancies, overdue actions.
- Exposure simulator (COULD): select instruments, show amount at risk.

### 9.13 Explainability and officer UX
- Instrument page: document viewer with OCR boxes and forensic boxes overlay; flag list with plain-language reasons; side-by-side submitted vs extracted vs bank-confirmed values with provenance badges.

### 9.14 Evaluation page (`/evaluation`)
- `scripts/forge_generator.py` creates >= 150 genuine and >= 150 forged FDR images/PDFs (amount edited, date swapped, cloned stamp/logo, font change, recompressed, duplicate re-use, forged QR).
- Run the pipeline over the set, store `eval_runs`, show confusion matrix, precision, recall, F1, per-attack-type recall, and before/after active-learning improvement. These numbers must be produced by running code, not typed.

## 10. API surface (REST, OpenAPI auto-docs)

```
POST /auth/login            GET /me
POST /institutions          GET /institutions/{id}
POST /instruments           GET /instruments?filters   GET /instruments/{id}
POST /instruments/{id}/documents
POST /instruments/{id}/confirm-fields
POST /instruments/{id}/verify/qr
POST /instruments/{id}/verify/link
GET  /bank-verify/{token}   POST /bank-verify/{token}
POST /instruments/{id}/flags     PATCH /flags/{id}
POST /instruments/{id}/observations
POST /instruments/{id}/renew
POST /instruments/{id}/release-requests   PATCH /release-requests/{id}
GET  /dashboard/summary     GET /dashboard/timeline   GET /dashboard/queue
GET  /graph/rings           GET /reports/{type}?format=csv|pdf
GET  /audit?entity=...      GET /audit/verify
POST /demo/advance-clock    POST /demo/reset   (admin only, disabled when DEMO_MODE=false)
GET  /evaluation/latest     POST /evaluation/run
```

## 11. Seed data requirements (`scripts/seed.py`)

- 12 banks (with regexes, keys), 150 institutions across >= 10 states, 600 instruments across all statuses, spread of maturities over 24 months, 15% flagged, 5% duplicates, one planted fraud ring of >= 4 institutions, historical renewal outcomes for training the survival model, reminder rules, 6 users (one per role).
- Seeder writes through the same services as the API so audit chain and provenance are consistent.

## 12. Non-functional requirements

- Security: RBAC enforced server-side, passwords hashed (argon2/bcrypt), files encrypted at rest, TLS-ready config, input validation, upload type/size limits, no secrets in repo (`.env.example`).
- Performance: dashboard APIs < 500 ms on 600 instruments; OCR async with status polling.
- Reliability: idempotent scheduler jobs; retries on notify failures.
- Observability: structured logs, `/health` endpoints, job status page.
- Accessibility/UX: responsive, English + Hindi labels for main screens (SHOULD).

## 13. Acceptance tests (must pass)

1. **Submit genuine signed-QR FDR** -> becomes `BANK_CONFIRMED`, no flags.
2. **Edit amount in that PDF** -> signature check fails, CRITICAL flag, status `FLAGGED`.
3. **Submit same FDR number from another institution** -> duplicate flag on both, ring graph shows link.
4. **Maturity inconsistent with tenure** -> R02 flag with explanation.
5. **Advance clock 80 days** -> instruments cross T-90/T-60 thresholds, reminders created and delivered to mock-notify, dashboard "Expiring" count changes accordingly.
6. **No response after overdue +7** -> escalation to senior officer recorded.
7. **Renewal** -> new linked instrument, parent `RENEWED`, history chain visible.
8. **Release** -> precheck fails when open flag exists; passes after resolution; maker != checker enforced; certificate generated.
9. **Tamper DB row** -> `/audit/verify` reports break.
10. **RBAC** -> institution A cannot read institution B data (403/404).
11. **Dashboard consistency** -> API counts equal raw SQL counts.
12. **Evaluation** -> pipeline run yields metrics stored in `eval_runs`; recall on tampered-amount class >= 0.9 on synthetic set.

## 14. Build phases (agent should follow in order)

1. **Foundation:** compose stack, DB migrations, auth/RBAC, audit hash chain, clock service.
2. **Core CRUD + lifecycle:** institutions, instruments, documents (MinIO), state machine, provenance.
3. **Intake intelligence:** OCR pipeline, rules R01–R08, flags UI.
4. **Verification:** mock-bank (QR issuer + verify-link), signature verification, trust tiers.
5. **Time engine:** scheduler, reminder rules, mock-notify, escalation, advance-clock endpoint.
6. **Risk + dashboard:** risk scoring, queue, KPI/timeline APIs, charts, reports/export.
7. **Release workflow + certificates.**
8. **Forensics + ML:** ELA, metadata checks, one-class layout model, forge generator, evaluation page, retrain loop.
9. **Graph + survival model (SHOULD).**
10. **Polish:** seed realism, e2e tests with Playwright, `demo_script.md`, README with architecture diagram.

## 15. Demo video script (3–4 minutes, all live)

1. Problem in 15s (fragmented tracking, forged/duplicate risk).
2. Login as Institution -> upload genuine signed FDR -> watch OCR, provenance, BANK_CONFIRMED badge.
3. Upload forged copy (edited amount) -> instant flag with highlighted region + signature failure.
4. Submit duplicate from another institution -> ring graph lights up.
5. Officer dashboard -> risk-ranked queue -> open an instrument timeline.
6. Click "Advance clock 80 days" -> reminders fire, counts change, escalation appears.
7. Renew an FDR -> linked history. Process a release with maker-checker -> certificate.
8. Audit page: verify OK -> tamper a row in psql -> verify fails.
9. Evaluation page: precision/recall from the run, before/after active learning.
10. Close with impact metrics computed from DB (verification time, expiries caught early).

## 16. Definition of done

- `docker compose up && make seed` brings up a working system with data.
- All 12 acceptance tests pass in CI/local.
- No hardcoded dashboard numbers (code review checklist: grep for literals in dashboard services/components).
- README explains architecture, mocks vs real, how to run the demo, and limitations honestly.
- Demo can be repeated from scratch using `make demo-reset`.

## 18. Add-on Architecture: Gemini/SLM + PageIndex Compliance Copilot + OKF Bundle

Incorporated as an additive, non-breaking upgrade to the core platform:
1. **Hybrid LLM/SLM Engine (`LLMClient`)**:
   - Google Gemini REST API (`gemini-2.0-flash`) as primary online provider.
   - Ollama Local SLM (`http://localhost:11434`) as on-prem fallback.
   - Deterministic `NullClient` guaranteeing zero crash fallback when offline.
2. **Guarded Regulatory Operations**:
   - Task A: OCR structured field extraction with mandatory substring hallucination guard.
   - Task B: Plain English & Hindi flag explanations with numeric/date fidelity guards.
   - Task C: Hindi reminder drafts with variable invariance verification.
   - Task D: Natural language search translating questions to validated Pydantic filter objects.
   - **Decision Isolation**: LLM/SLM outputs never determine verification, trust tiers, or approvals.
3. **OKF (Open Knowledge Format v0.1) Bundle (`knowledge/`)**:
   - Human-editable, Git-versioned Markdown codifying rules (R01-R09), banks, policies, and lifecycle.
   - Dynamic parameter binding (`tolerance_days`, `min_amount`, `interest_bounds`) into `rules_engine.py`.
   - In-memory link graph generation and hot-reload (`POST /knowledge/reload`) audited to hash chain.
4. **PageIndex Compliance Copilot (`/copilot/ask`)**:
   - Hierarchical tree retrieval over genuine AICTE Approval Process Handbook regulations.
   - Generates section- and page-cited answers verified against retrieved passages.
   - Refusal mechanism for out-of-scope inquiries without fabricated citations.
5. **Interactive Vector Graphs (`@xyflow/react`)**:
   - High-DPI React Flow vector graphs for Syndicate Collusion Rings (`/graph`) and OKF Concepts (`/knowledge`).
   - Glowing collusion edge animations, minimap, custom styled cards, and flyout inspection drawers.
6. **Empirical Benchmarking (`/evaluation`)**:
   - Forensic Tamper Detection (N=200 Bank-Signed vs Tampered).
   - SLM Field Extraction Benchmark (Regex vs SLM Accuracy, Null-rate, Latency).
   - Copilot Citation Benchmark (20 Handbook Questions + 5 Refusal Queries).
