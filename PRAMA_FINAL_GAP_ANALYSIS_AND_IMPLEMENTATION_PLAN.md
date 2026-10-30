# PRAMA — Final Gap Analysis & Implementation Plan

**Project:** Prama — Security Deposit / FDR Management Portal  
**SIH Problem Statement:** PS 26265 — *Streamline of security deposit / FDR portal*  
**Department:** AICTE, Regulation Bureau  
**Document purpose:** The definitive build checklist for closing the gaps between the current repository and a credible, end-to-end solution to the problem statement.  
**Review date:** 29 October 2026  
**Repository reviewed:** [ShresthSingh01/Prama](https://github.com/ShresthSingh01/Prama)

> **Core conclusion:** Prama must first become a secure, policy-aware FDR lifecycle system in which every instrument has reliable records, traceable verification, timely follow-up, linked renewal history, and a release workflow that cannot bypass required conditions. AI, graphs, prediction and elaborate dashboards are secondary to making this lifecycle correct.

---

## 1. Executive decision: what must change first

Prama already contains several useful building blocks: instrument records, document uploads, basic rules, hash-based duplicate checks, a verification concept, maturity-related services, release requests, an audit-chain service, a graph service and a Next.js interface. The central issue is not a lack of modules. It is that some important modules are **not connected into one trustworthy, enforced workflow**, and several visible capabilities are more simulated or heuristic than their names may imply.

The highest-priority work is:

1. **Enforce authentication, role permissions and institution-level data isolation on every protected API.** Unauthenticated fallbacks must not be able to create records or perform scrutiny, checker approval, or release actions.
2. **Build a real document-to-data pipeline.** The uploaded original document must trigger text extraction/OCR, field extraction, field-level provenance, discrepancy checks and evidence storage. The current upload route does not appear to run the extraction service as part of upload.
3. **Make verification mean what the status says.** Submitted values, extracted values, rule-validated values and bank-confirmed values must remain distinct. A mock bank confirmation must never be displayed as a real bank confirmation.
4. **Create a policy-driven release-readiness gate.** A release request must be blocked when required documents, required clearances, policy conditions or authorization steps are incomplete. “No open flags” alone is insufficient.
5. **Make lifecycle events and notifications real within the declared prototype scope.** A reminder record being inserted is not proof that a reminder was sent. A release certificate URL is not a certificate unless the file is generated and retrievable.
6. **Remove synthetic forensic evidence from any screen that presents it as analysis of an uploaded document.** Every finding must refer to the actual file and explain its limits.
7. **Close security gaps and make critical workflows testable end to end.** Then prove behavior with tests, rather than relying on seeded screens or a signature-only evaluation.

**Do not start by adding more AI models or more dashboard panels.** First fix the records, permissions, lifecycle, evidence and release controls. Those are the core of PS 26265.

---

## 2. What PS 26265 is explicitly asking Prama to solve

The problem statement is the primary source of requirements. The following requirements are taken from the repository's [`PS.md`](https://github.com/ShresthSingh01/Prama/blob/master/PS.md). The “required system behavior” column translates the wording into something that can be implemented and tested.

| # | Explicit demand in the problem statement | Required system behavior / proof |
|---|---|---|
| 1 | Centralized institution-wise and instrument-wise records | A single searchable record for each institution and each deposit/FDR, with a stable ID, instrument details, status, documents and event history. |
| 2 | Store reference number, issuing bank, amount, issue date, maturity date, validity, supporting documents and administrative status | Persist the required fields in the database, validate them, show missing values, and retain who supplied or changed each value. |
| 3 | Digital submission, storage, retrieval and review of FDRs and supporting documents | A user can upload a file, see processing status, open the original stored file, review extracted values and retrieve prior versions. Files must be protected from unauthorized access. |
| 4 | Authorized officials review submitted information | Enforce server-side role permissions and institution-level isolation. The UI alone is not an access-control mechanism. |
| 5 | Verify through legitimate bank-issued mechanisms wherever supported | Support approved verification methods, store the result and its evidence, and identify whether it is a real integration, a valid signed instrument or a clearly marked mock/demo confirmation. |
| 6 | Identify incomplete records and discrepancies requiring scrutiny | Compare form data, document-extracted data, configured policy rules and independent bank response. Create a traceable finding with a reason, evidence, severity and status. |
| 7 | Distinguish institution-submitted data from independently bank-confirmed data | Track provenance per critical field. Do not upgrade every field simply because one check passed. Show source, time, method and verification state. |
| 8 | Track validity, maturity, renewal/replacement and prescribed timelines | Calculate deadlines from persisted dates, run a scheduler, detect expired/near-maturity records, create renewal/replacement records and preserve the parent-child history. |
| 9 | Generate configurable reminders before deadlines; flag overdue or unresolved cases | Store rule configuration, recipient, due time, delivery status, retries and escalation history. Clearly separate “queued”, “sent”, “failed” and “simulated”. |
| 10 | Record and track release/discharge/refund requests subject to regulations and competent-authority authorization | Provide request submission, completeness/policy precheck, scrutiny, clearance tracking, maker-checker decision, rejection reasons, final release record and actual retrievable output where applicable. Never allow an unqualified request to move to release. |
| 11 | Dashboard for active, expiring, matured, renewed, released and pending instruments | Compute dashboard values from the database and state definitions. The displayed counts must reconcile with the underlying records. |
| 12 | Search records, review document histories, update permitted fields, record observations and monitor case status | Provide filters and history; restrict editable fields by role; record before/after changes and observations in an audit trail. |
| 13 | Automated reports for pending verification, upcoming maturity, missing documents and cases needing intervention | Generate reports from actual data with filters and export; counts and rows must agree with the same source query. |
| 14 | Role-based access, secure storage, encryption, audit trails and controlled access | Enforce authorization server-side, protect credentials and uploaded files, restrict storage routes, use secure configuration, log consequential activity and verify audit integrity. |
| 15 | Integrate with AICTE and bank services where technically feasible and formally authorized | Define an integration adapter and visible integration status. Use labeled mock services for unavailable partners; never claim a live connection without actual credentials, endpoint and successful verification. |
| 16 | Demonstrate measurable improvement in record accuracy, verification turnaround, timely renewal, reduced manual tracking and visibility of pending cases | Instrument measurable metrics, show their calculation and baseline, and test the flows that produce them. Synthetic test results must be labelled as synthetic. |
| 17 | Test new FDR submission, validity tracking, approaching maturity, renewal, discrepancy identification and authorized release | Provide automated end-to-end tests for each scenario, including failure cases, authorization checks and persisted results. |

### The actual outcome required

The problem statement does **not** require an “AI dashboard” by itself. It requires a streamlined administrative mechanism that can answer, for each deposit/FDR:

- **What is the instrument, and which institution owns it?**
- **What do we know, what is missing, and where did each value come from?**
- **Has the information been independently verified, by which method, and with what evidence?**
- **What deadline or renewal action is approaching, and who must act?**
- **Can the case proceed to release under the applicable rules? If not, exactly what is blocking it?**
- **Who submitted, checked, changed, approved or rejected it, and can the record of those actions be audited?**

If Prama reliably answers these questions and demonstrates the full journey with real persisted data, it will address the core PS. Extra AI should improve that workflow, not substitute for it.

---

## 3. Important policy requirement for release/refund

The release workflow must be driven by the **current applicable AICTE rules and administrative procedures**, not just by a generic software condition.

The [AICTE Approval Process Handbook 2024–2027](https://aicte-qa.aicte-india.org/sites/default/files/APH%20Final.pdf) includes a “Release of Security Deposit” procedure in Clause 6.46. As a concrete example, it lists an institution request letter, Affidavit 6 containing the institution/trust and FDR/RTGS details, the relevant FDR copy and applicable payment proof, and the latest LoA/EoA. It also describes clearances from relevant AICTE cells/bureaus and additional NOC conditions in specified cases. See the official handbook before encoding or changing these requirements.

**Implementation rule:** treat each release checklist as a versioned policy configuration tied to the relevant approval process and effective date. The handbook is a policy source to consult, not permission to hardcode one permanent checklist for every case. An authorized policy owner must be able to update requirements with a recorded version and effective date.

At minimum, release precheck should separately evaluate:

- required supporting records present and valid;
- instrument and institution match the request;
- maturity/approval-cycle conditions required by the applicable policy;
- all required clearances received and still valid;
- required no-objection certificates or other special conditions satisfied;
- no unresolved blocking flags or discrepancies;
- verification state meeting the policy requirement;
- the requester and approvers have the required permissions;
- maker and checker are different authorized users;
- every decision and evidence item is stored and auditable.

The engine should return specific blockers, such as: **“Cannot proceed: Affidavit 6 missing,” “Vigilance clearance pending,” “Bank confirmation not received,”** or **“Requester does not have permission.”** It should not simply return a red/green score with no reason.

---

## 4. Current implementation review: confirmed gaps to close

This review is based on source-code inspection of the repository files below. It is **not** a claim that the repository was executed or that all tests were run during this review. Any behavior not directly evidenced in the inspected path is marked as a gap to verify rather than assumed to exist elsewhere.

### Gap register

Priority meanings:

- **P0 — correctness/security blocker:** fix before presenting the workflow as trustworthy.
- **P1 — core PS completeness:** required for a credible full-lifecycle prototype.
- **P2 — differentiator/polish:** only after P0/P1 flows work.

| ID | Priority | Current gap / evidence from code review | Required change | Acceptance proof |
|---|---|---|---|---|
| G01 | P0 | Some instrument/release endpoints use optional-user behavior or do not visibly enforce authorization; anonymous fallback actors are used in maker/checker paths. | Require authenticated principals on protected routes. Add explicit role and institution-scope checks in backend service/API layers. Remove fallback user IDs for consequential actions. | Unauthenticated calls fail; a user from Institution A cannot read/write Institution B data; only authorized checker can approve; the same person cannot be both maker and checker. |
| G02 | P0 | Instrument upload appears to save the file, calculate hashes and run some checks, but does not call the field-extraction pipeline in that upload path. Current extraction service relies on PDF text extraction/regex and no OCR engine is listed in basic backend dependencies. | Make upload invoke a processing pipeline that extracts text from text-based PDFs and uses OCR for scanned PDFs/images. Persist extracted fields, page/box evidence, engine, confidence and processing status. | Upload a text PDF and scanned FDR; both produce visible extracted fields or an explicit processing failure; extraction is linked to the actual document ID. |
| G03 | P0 | SLM rerun can fall back to values already stored in the instrument record when no OCR result exists. That is circular evidence, not independent extraction. | SLM must receive text/regions derived from the original upload. If extraction is unavailable, return “no source text available”; never manufacture input from the database fields being checked. | A test with an empty OCR result does not falsely claim the original document confirmed the database data. |
| G04 | P0 | Release request creation checks open flags, but does not appear to enforce all maturity/approval-cycle, required-document, clearance and authorization conditions from the PRD/policy. | Build a centralized, versioned Release-Readiness Engine. Use one precheck service in all request, scrutiny, checker and final-release transitions. | Missing one required document or clearance blocks progression with the exact reason; completed requirements permit the case to proceed to authorized review. |
| G05 | P0 | Release maker/checker routes use optional authentication/fallback IDs; list endpoints also need consistent scope. The “different IDs” check alone is not adequate if the identity is not authenticated. | Enforce role checks and maker-checker separation on the server for each state transition. Record actor ID, role, time, action and mandatory remark on rejection. | Anonymous approval is impossible; wrong-role approval is rejected; same actor cannot approve their own case; rejection without a reason is rejected. |
| G06 | P0 | Bank QR verification appears to compare only a subset of critical values (including serial and amount) before setting a bank-confirmed state. Trusted bank key identity and complete field-level provenance need stronger enforcement. | Verify the signature against a registered trusted key and bank identity. Compare all signed critical fields: instrument number, bank, amount, issue date, maturity date and holder/institution where available. Update provenance only for fields actually covered by successful verification. | Tampering with any signed critical field fails verification; untrusted key/bank identity fails; no unrelated field silently becomes bank-confirmed. |
| G07 | P0 | Verify-link token is stored as a hash and has expiry, but single-use enforcement and independent bank-officer authentication are not evidenced; it is not enough to have a hard-to-guess link. | Make tokens one-time and atomic: consume on successful decision, reject replay and expired tokens. Add an appropriate authenticated bank response mechanism (for prototype, clearly labeled mock bank with OTP/session). Restrict link data to the one instrument. | Second use and expired use both fail; bank user cannot access other records; confirmation event records responder identity/method. |
| G08 | P0 | Forensic service contains synthetic certificate generation, preset anomaly regions/metadata and a hardcoded instrument-specific tamper outcome; ELA/metadata heuristics are not proof of forgery. | Remove synthetic evidence from production analysis paths. Analyze the actual uploaded file. If synthetic certificates remain for demo purposes, label them “synthetic test artifact” in API and UI. Report heuristic alerts as “needs review,” never as definitive forgery proof. | Changing an uploaded file changes the analysis based on that file; displayed evidence coordinates are from that file; no result is selected solely from an instrument ID. |
| G09 | P0 | A file is saved using a name derived from the client-provided filename. Upload validation and safe storage access need to be guaranteed. | Generate server-controlled storage keys; validate extension, MIME, file signature, size and allowed file types; reject path traversal; enforce per-user limits; store outside public static paths; authorize every download. | A malicious filename cannot write outside storage; oversized/invalid files are rejected; an unauthorized user cannot retrieve an uploaded FDR. |
| G10 | P0 | Main application configuration has wildcard CORS with credentials and a fallback hardcoded secret; storage is mounted as static files; demo mode is enabled by default in configuration. | Use environment-managed secrets with startup failure if production secrets are absent; restrict CORS to known origins; remove public storage mount; guard demo/sabotage/clock endpoints behind explicit demo/admin authorization; separate dev and deployment configs. | Security tests show private files and demo endpoints are inaccessible to unauthorized users; production configuration will not start with default secrets. |
| G11 | P0 | The database configuration reportedly defaults to SQLite despite the PRD/idea describing PostgreSQL. This is a design/configuration mismatch, especially for concurrency, migrations and access-control assumptions. | Choose and document the target database. For the intended integrated prototype, align config, migrations, Docker Compose and tests around PostgreSQL; if temporarily retaining SQLite for local development, make that explicit and test PostgreSQL in the deployment path. | Fresh environment starts from migrations; tests run against the declared database; README and actual config agree. |
| G12 | P1 | Rules include generic hardcoded defaults such as a minimum amount and broad interest-rate band. They are not necessarily correct for every institution, instrument type or policy period. | Move policy-dependent thresholds to a versioned, editable rule configuration with effective dates, source, owner and audit history. Unknown/missing policy configuration should produce “manual review required,” not silently use an invented universal threshold. | A test switches policy version and the expected flag result changes; every rule finding shows the policy/rule version used. |
| G13 | P1 | Field mismatch, holder-name match, layout-anomaly and perceptual-duplicate rules appear advertised but are not evidently implemented in the inspected rules-engine execution path. | Audit the registry and implement each rule only when it has a real evidence source and test. If unsupported, mark it “not available” rather than presenting it as active. Compare OCR vs form values and implement perceptual duplicate checks if included in UI claims. | Each displayed rule has a unit test for pass/fail and a finding containing evidence; no inactive rule appears as having run. |
| G14 | P1 | Scheduler can create reminder rows already marked “SENT” without an evident delivery adapter. | Model notification states explicitly: queued, sent, failed, simulated. Add retry and escalation records. For SIH, use a real local mock-notification service that receives HTTP requests and records delivery; label it mock. | Advancing the demo clock creates a notification event in the mock service; delivery failure is visible and does not get labeled sent. |
| G15 | P1 | Risk score and `p_lapse` are hand-crafted rules/logistic formulas rather than a trained and validated model. | Call them “heuristic priority score” and “illustrative estimate” until there is a valid labelled dataset and evaluation. Show contributing factors. Do not use score as evidence of fraud or as sole reason to block release. | UI wording matches implementation; changing an input changes the score predictably; scoring never overrides policy gates. |
| G16 | P1 | PageIndex adapter appears to construct a local hierarchical index and keyword score; a real PageIndex dependency/API is not evidenced. Copilot citation guard can accept model-provided wording without proving the quote exists in source text. | Either integrate and test the actual PageIndex tool or rename the feature to accurately describe the internal clause index. Validate every citation against retrieved source text/page/section and store the cited excerpt. Refuse unsupported answers. | A fake citation/quote is rejected; each accepted answer points to an actual stored passage and page/section; feature name matches implementation. |
| G17 | P1 | Release certificate generation appears to set a URL path without clearly generating a real PDF file. | Generate a real downloadable certificate only after authorized final release. Include case ID, instrument ID, decision, approver identities, date, policy/version, evidence summary and verifiable audit reference. | Certificate endpoint returns a real PDF; URL is retrievable only by authorized users; a rejected/blocked request has no release certificate. |
| G18 | P1 | Audit chain verification uses an in-memory cache, which can miss out-of-band DB edits while the cached result remains valid. A hash chain is not inherently immutable if all records can be rewritten. | Recompute the chain during integrity verification or carefully invalidate cache; restrict audit table update/delete privileges; anchor periodic hashes externally or to separate protected storage for stronger tamper evidence. | A test modifies a middle audit row directly, then integrity verification identifies the first broken entry. A full-chain rewrite limitation is documented. |
| G19 | P1 | Duplicate/syndicate graph can identify shared serials or exact hashes; the evidence does not prove collusion. Perceptual near-duplicates are not evidently wired. | Label graph links as “potential reuse/shared evidence requiring review.” Show the shared attributes and source records; never infer intent from a shared bank/branch alone. | A duplicate produces an explainable link; unrelated shared attributes do not automatically mark institutions as colluding. |
| G20 | P1 | Evaluation endpoint generates signed and amount-tampered QR envelopes. That primarily tests cryptographic signature verification, not broad PDF/image forgery detection. | Separate evaluation tracks: signature-tamper detection, duplicate detection, OCR field mismatch, and document-forensics heuristics. Use a labelled test set, compute confusion matrix and per-category precision/recall, disclose synthetic sample limitations. | Metrics are computed from actual test runs and labelled outcomes; UI names the tested task accurately and cannot imply general forgery accuracy. |
| G21 | P1 | Renewal/replacement history is specified in the PRD but must be verified across the complete UI/API lifecycle, not just by presence of a parent field in the data model. | Create a new instrument on replacement with a parent link, preserve the prior instrument unchanged, record why it was replaced, and show both records/timeline. | Replacing an instrument does not overwrite its history; the new record links to the old one and affects active exposure counts correctly. |
| G22 | P1 | Dashboard and status updates may depend on seed data or independently implemented services rather than one authoritative state machine. | Centralize allowed lifecycle transitions and derive dashboard/report counts from DB queries over agreed state definitions. Prevent direct state changes that bypass validation and audit. | Dashboard counts match SQL/API totals; illegal transitions are rejected; every legal transition creates an audit event. |
| G23 | P2 | Advanced graph, survival analysis, model active learning, multilingual copilot and multiple AI components introduce effort before core correctness is proven. | Keep them optional. Build the operational workflow first; retain only differentiators that are demonstrably functional and explainable in the time available. | Core acceptance tests pass without depending on the graph, survival model or LLM. |

### Source files reviewed

- [Instrument API](https://github.com/ShresthSingh01/Prama/blob/master/backend/app/api/instruments.py)
- [Release API](https://github.com/ShresthSingh01/Prama/blob/master/backend/app/api/release.py)
- [Verification API](https://github.com/ShresthSingh01/Prama/blob/master/backend/app/api/verification.py)
- [Forensic service](https://github.com/ShresthSingh01/Prama/blob/master/backend/app/services/forensic_service.py)
- [Rules engine](https://github.com/ShresthSingh01/Prama/blob/master/backend/app/services/rules_engine.py)
- [Clock/reminder service](https://github.com/ShresthSingh01/Prama/blob/master/backend/app/services/clock_service.py)
- [Risk service](https://github.com/ShresthSingh01/Prama/blob/master/backend/app/services/risk_service.py)
- [Document index / PageIndex adapter](https://github.com/ShresthSingh01/Prama/blob/master/backend/app/services/document_index.py)
- [SLM extraction endpoint](https://github.com/ShresthSingh01/Prama/blob/master/backend/app/api/slm.py)
- [Graph service](https://github.com/ShresthSingh01/Prama/blob/master/backend/app/services/graph_service.py)
- [Audit service](https://github.com/ShresthSingh01/Prama/blob/master/backend/app/services/audit_service.py)
- [Evaluation API](https://github.com/ShresthSingh01/Prama/blob/master/backend/app/api/evaluation.py)
- [PRD](https://github.com/ShresthSingh01/Prama/blob/master/FDR.md)
- [Solution concept](https://github.com/ShresthSingh01/Prama/blob/master/FDRIDEA.md)

---

## 5. The target workflow Prama must actually enforce

Implement one connected flow; every step reads and writes the same persisted case, not a parallel demo state.

### A. Institution submits an FDR

1. Authenticated institution user selects only an institution they are authorized to represent.
2. User enters available FDR details and uploads the original file plus required supporting documents.
3. Server validates file type/content/size, generates a safe storage key, stores the file securely and records a SHA-256 digest.
4. Instrument starts in `SUBMITTED` (or equivalent) with the typed values marked **self-declared**.
5. A processing job is created and visible to the user; failures are explicit and retryable.

### B. System extracts and reconciles evidence

1. Extract text from digital PDFs; run OCR for scanned PDFs/images.
2. Extract FDR number, bank, amount, holder/institution, issue date, maturity date and interest rate where present.
3. Store raw extracted text plus page number and bounding boxes for each supported field. Store engine/version and confidence.
4. Compare typed form values with document-extracted values field by field.
5. Run policy-configured deterministic rules and duplicate checks.
6. For each finding, store rule code/version, severity, explanation, field/value comparison, source document and page/box evidence.
7. If extraction is uncertain, missing or contradictory, route to manual scrutiny. Do not treat uncertain OCR as a verified fact.

### C. System or officer verifies the instrument

1. QR signature route: confirm that the key belongs to the registered bank, signature is valid, and signed payload matches the supported critical fields.
2. Verify-link route: send the request to a separate mock-bank adapter for prototype; apply expiry, one-time use and bank-user authentication. Keep a real integration clearly out of scope until a bank-authorized interface exists.
3. Manual route: require a named authorized officer, method, date, source/evidence and written remark.
4. Store verification result separately from submitted/extracted values.
5. Update provenance per field only when the successful verification method covers that field.
6. Show outcomes as **self-declared**, **document-extracted**, **cross-validated**, **bank-confirmed**, or **unverified** with their evidence. Do not use one generic badge to imply everything is confirmed.

### D. Monitor the instrument lifecycle

1. A central lifecycle service validates every state transition and writes its audit entry.
2. The scheduler uses one clock abstraction and one set of configurable reminder rules.
3. It identifies upcoming maturity, expiry and overdue actions from actual dates.
4. The notification adapter records both attempt and delivery outcome; simulated clock events are visibly marked as simulated.
5. An institution submits renewal/replacement as a new linked instrument. The previous instrument stays in history.
6. Dashboards and action queues are computed from persisted instrument states, deadlines, open findings and delivery results.

### E. Process release/refund requests safely

1. Institution submits a request with a reason and requested instrument; required documents are attached or selected from the verified record.
2. The Release-Readiness Engine evaluates the versioned, applicable policy checklist and produces a list of blockers and satisfied requirements.
3. If blockers remain, keep the case in `PRECHECK_FAILED` / `INCOMPLETE` and allow permitted remediation; do not send it to final approval.
4. When ready, the case enters officer scrutiny. Maker records checks, evidence and remarks.
5. Authorized checker reviews independently; maker and checker must be distinct authenticated users.
6. Check required clearances and exceptional conditions before final release.
7. A final release state is written only after all required checks and approvals pass. Generate the real certificate/receipt only after that transition.
8. Every transition and evidence change is audited; the requester can see the status and clear next step without seeing other institutions’ confidential records.

---

## 6. Data and status model: keep the facts separate

Avoid placing one ambiguous status on an instrument and expecting it to express everything. The system should keep at least these concepts separate:

### Instrument lifecycle

Example states: `SUBMITTED → PROCESSING → UNDER_SCRUTINY → ACTIVE → EXPIRING → MATURED`, with `FLAGGED`, `REJECTED`, `OVERDUE`, `REPLACED` and `RELEASED` handled as appropriate. Final names must be consistent across backend, API, database and frontend.

### Verification outcome

Examples: `NOT_CHECKED`, `PENDING`, `CONFIRMED`, `DENIED`, `FAILED`, `MANUAL_REVIEW`. A successful QR signature check is not the same as a bank replying to a verification request; represent the actual method.

### Field provenance

For each critical field, store its current value and source: `SELF_DECLARED`, `DOCUMENT_EXTRACTED`, `CROSS_VALIDATED`, `BANK_CONFIRMED`, or `MANUALLY_VERIFIED` where policy permits. Track timestamp, actor/method, confidence and supporting evidence. Different fields may have different provenance.

### Release-request lifecycle

Examples: `SUBMITTED → PRECHECK_FAILED / READY_FOR_SCRUTINY → UNDER_REVIEW → APPROVED / REJECTED → RELEASED`. Keep “matured” separate from “approved for release”: maturity alone is not authorization to release.

### Notification state

Examples: `QUEUED`, `SENT`, `FAILED`, `SIMULATED`, `CANCELLED`. The presence of a reminder row must not be treated as proof of successful delivery.

### Policy/version history

Every regulatory or operational rule needs a version, source/reference, effective date, configuration owner and change audit. Every decision should preserve the policy version used at the time.

---

## 7. Recommended implementation phases

Follow this order. Do not work on all modules in parallel before the end-to-end workflow is sound.

### Phase 0 — Make the current state honest (first)

- Document which current features are real, heuristic, mock, or synthetic.
- Remove hardcoded “tampered” outcomes and fabricated OCR/forensic evidence from the real analysis route.
- Ensure all UI labels match the actual backend behavior.
- Keep seed data for demo, but make every dashboard, action queue and report query the database.
- Add a feature/integration status note to README: real local behavior vs mocked external services vs not implemented.

**Exit condition:** the demo no longer claims that a mock response, synthetic certificate or heuristic score is an independently verified fact.

### Phase 1 — Secure identities, records and documents (P0)

- Enforce authentication and role checks across all instrument, document, verification, release, audit and admin endpoints.
- Enforce institution-level data isolation in backend queries and test it.
- Add safe upload validation, private document storage and authorized downloads.
- Configure secrets/CORS correctly; lock demo endpoints.
- Make database configuration and migrations agree with the documented target database.

**Exit condition:** a cross-institution access test and anonymous-action tests all pass; documents cannot be fetched by guessing a URL.

### Phase 2 — Make document intake and verification real (P0)

- Connect upload to extraction and OCR with persistent processing status.
- Persist original text, extracted values, source page/box and confidence.
- Implement field-level comparison, missing-data checks and versioned rules.
- Complete signed-QR verification against trusted bank keys and all supported signed fields.
- Make verify-link one-time, expiring, identity-aware and clearly mock when no live bank exists.
- Add a manual verification path with evidence and mandatory remarks.

**Exit condition:** a judge can upload a valid test FDR, inspect extracted values and compare them with form data; an intentionally changed amount/date is flagged for the correct reason.

### Phase 3 — Make the FDR lifecycle enforceable (P0/P1)

- Centralize transitions in one lifecycle service.
- Implement maturity states, configurable reminders and escalation.
- Make renewal/replacement create a new linked record and preserve history.
- Make delivery states truthful, using a local mock notification service where live email/SMS credentials are unavailable.
- Build release-readiness rules from the applicable AICTE/administrative policy; track each clearance independently.
- Enforce maker-checker authorization and a real final release/certificate path.

**Exit condition:** the complete journey works from submission through monitoring and renewal, and a release attempt is blocked by missing conditions then succeeds only after the required conditions and approvals are completed.

### Phase 4 — Audit, reports and evaluation (P1)

- Recompute audit-chain integrity during verification; add protected audit storage or anchoring as feasible.
- Make dashboards/reports DB-derived and prove counts reconcile.
- Add search, CSV/PDF reports and case timeline of submissions, documents, checks, flags, clearances, reminders and approvals.
- Replace broad synthetic “forgery accuracy” claims with separate, reproducible evaluation sets and clearly defined metrics.
- Run automated backend, authorization, integration and browser end-to-end tests; document actual run results.

**Exit condition:** metrics can be reproduced from a fresh database and test dataset, and a broken audit record is detected.

### Phase 5 — Differentiators (P2, only after earlier phases pass)

Select a small number of differentiators that directly help officers act safely:

1. **Evidence-backed trust ledger:** show each important value alongside its source, verifier, timestamp and any mismatch.
2. **Release-readiness explanation:** list each required condition as satisfied, pending, missing or failed, with links to evidence.
3. **Action-priority queue:** rank cases by deadline, missing evidence, open severity and unresolved action; show the exact reason for priority.
4. **Cross-institution duplicate clues:** show shared serial/hash/evidence with a cautious “potential reuse requiring review” label.
5. **Policy copilot/PageIndex:** add only when each answer can be traced to a real handbook clause and the quote/page are validated.

Keep a survival model, advanced image-forensics model, active learning and elaborate graph algorithms optional unless they can be evaluated with genuine labelled data. A smaller system with enforced rules is stronger than a wide but misleading demo.

---

## 8. Minimum data fields and records needed

The exact schema can evolve, but the following information must be persisted, not held only in frontend state.

### Institution

- Stable institution ID and official identifier where available
- Name and authorized contact/user mapping
- Status and any relevant approval-cycle reference
- Access scope and audit metadata

### Instrument

- Stable instrument ID and institution ID
- FDR/reference number and bank identity
- Amount and currency
- Issue date, maturity date, tenure/validity where applicable
- Holder/institution name and interest rate if applicable
- Current instrument lifecycle state
- Parent/replaced instrument reference
- Created/updated timestamps and actor

### Document

- Stable document ID and instrument link
- Type/purpose, secure storage key and original filename as metadata only
- SHA-256 digest, size, MIME/content validation result
- Upload actor/time and version relationship
- Processing status and error state
- Access controls/download audit

### Extracted field/evidence

- Field name and extracted value
- Source document and page number
- Bounding box/region when available
- Extraction engine/version, confidence and timestamp
- Corresponding submitted value and comparison outcome
- Provenance state and reason for any upgrade

### Verification

- Instrument and field(s) covered
- Method: signed QR, authenticated bank response, or manual evidence
- Source/bank identity and registered key/credential reference where applicable
- Request/response times, result, evidence and responder identity
- Token expiry/consumption metadata when using verify links

### Flag / observation

- Rule ID/version, severity, reason, evidence and affected field
- Open/resolved/dismissed state, assigned owner and resolution remark
- Actor and timestamps

### Lifecycle event / reminder

- Previous state, new state, actor/system job and timestamp
- Trigger/reason and policy/rule version
- Recipient, due date, delivery attempts and truthful result state
- Escalation level and follow-up outcome

### Release request

- Instrument ID, requester, reason and submitted documents
- Policy version/checklist version
- Every required condition/clearance and its state/evidence
- Precheck outcome and blockers
- Maker/checker IDs, decisions, remarks and timestamps
- Final release reference and actual certificate file, if issued

---

## 9. Acceptance tests — the definition of “working”

These tests are not optional polish. They are the evidence that the prototype solves the operational problem rather than merely showing screens. Each should run against a clean database or controlled fixtures and assert persisted outcomes.

| Test | Scenario | Must pass when… |
|---|---|---|
| AT-01 | Valid FDR submission | Institution can submit allowed fields and a file; record, document hash, audit event and processing job persist. |
| AT-02 | Scanned or text-based FDR extraction | Pipeline extracts supported fields from the original document; source text/page/boxes and extraction state are saved; unsupported fields remain explicitly unknown. |
| AT-03 | Field discrepancy | Form says ₹10 lakh while the document says ₹15 lakh; the system creates a discrepancy with both values and source evidence, and does not silently mark the amount verified. |
| AT-04 | Document altered after signing | Signed QR verification fails when a signed amount/date/holder field is changed; the finding identifies the failed check. |
| AT-05 | Untrusted bank key | QR signed with an unknown key is not considered bank-confirmed. |
| AT-06 | Verify-link replay/expiry | Expired link and second submission of a used link are rejected; no second confirmation is recorded. |
| AT-07 | Cross-institution duplicate | Same bank/FDR number or exact file reused by another institution is flagged with links to both records; the message says review is required, not that collusion is proven. |
| AT-08 | Upcoming maturity | Advancing the simulated clock crosses configured thresholds; status/queue changes, reminder attempts are recorded and delivery is marked sent/failed/simulated accurately. |
| AT-09 | Renewal/replacement | A replacement creates a new linked instrument; the old record and audit history remain intact; dashboard counts update correctly. |
| AT-10 | Release blocked on missing requirement | Request is blocked with the exact missing document, clearance or unmet condition; it cannot be approved by directly calling a later endpoint. |
| AT-11 | Release maker-checker | Only authorized users can act; maker and checker differ; rejection requires a remark; every step is audited. |
| AT-12 | Successful release | When the instrument satisfies the current policy, all necessary clearances and permissions are present and checker approval passes, the record transitions to released and a real certificate/receipt can be retrieved. |
| AT-13 | Institution data isolation | User from Institution A cannot list, view, download, modify, or initiate workflow actions for Institution B's instruments. |
| AT-14 | Audit integrity | Changing a middle audit row is detected by recomputation and the broken entry is reported. |
| AT-15 | Dashboard/report reconciliation | Dashboard totals and export counts match database queries under filtering; no KPI is hardcoded. |
| AT-16 | Failure handling | OCR, mock-bank or notification failure remains visible as failed/pending; the system does not silently upgrade trust or claim delivery. |

### Test-run reporting rule

Only describe a test as “passed” after executing it and recording the result. A seeded test, mocked bank or synthetic FDR can prove that a defined prototype behavior works; it cannot prove integration with a real bank, actual AICTE systems or broad real-world forgery-detection accuracy.

---

## 10. Measurable impact: define the metric before displaying it

The PS explicitly asks for measurable improvements. Prama should show a small set of defensible metrics rather than many opaque scores.

| Impact area | Definition to use | Important caveat |
|---|---|---|
| Record accuracy | Percentage of required fields complete and internally consistent; count of detected discrepancies resolved | OCR agreement alone does not prove the record is true. |
| Verification turnaround | Median elapsed time from submission to verified status, segmented by method | Report real recorded timestamps; compare with a documented baseline or clearly labelled simulated path. |
| Timely renewal | Number/percentage of instruments with action initiated at least 30 days before maturity, when applicable | A reminder created is not proof an institution acted. |
| Reminder effectiveness | Due reminders versus successfully delivered reminders, plus failed/overdue follow-ups | Separate real delivery from mock/simulated delivery. |
| Manual effort | Measured task time for defined manual vs portal workflow using the same scripted task | Do not claim a percentage saved without a baseline measurement. |
| Pending-case visibility | Number of records awaiting verification, missing documents, clearances or action, backed by queries | KPI must reconcile with case rows. |
| Duplicate screening | Precision/recall on a labelled set of duplicate and non-duplicate cases | A match is a lead for scrutiny, not proof of fraud or collusion. |
| Forensic screening | Precision/recall by specific attack type on a labelled synthetic or real dataset | Do not generalize synthetic dataset performance to real bank FDRs. |
| Audit accountability | Ratio of consequential actions with actor, timestamp, reason and event; detected integrity failures in test | A hash chain is tamper-evident only within its threat model; it is not absolute immutability. |

**Recommended demo metric panel:** pending verification, missing release prerequisites, instruments expiring within 30/60/90 days, overdue actions, successful/failed notification attempts, and time from submission to decision. Each number must link to a filterable list of records.

---

## 11. Security and integrity checklist

Before calling the solution secure, verify each item below.

- [ ] Every protected endpoint requires a valid authenticated user.
- [ ] Authorization is enforced in backend code, not only in UI navigation.
- [ ] Every institution-scoped query includes an enforced institution permission check.
- [ ] Instrument, release, user and institution IDs from the client are validated against the authenticated user's scope.
- [ ] Maker/checker and high-impact actions use authenticated actor IDs only; there are no anonymous fallback identities.
- [ ] Upload filename never controls the storage path; size/type/content are validated.
- [ ] Files are stored outside public static directories and downloads are authorized per document.
- [ ] Secrets are loaded from environment/secret management; production startup rejects default secrets.
- [ ] CORS is limited to approved origins; wildcard CORS is not combined with credentials in a production configuration.
- [ ] Demo clock, seed/reset, simulated sabotage, and mock response endpoints are admin/demo-only and disabled in production.
- [ ] Passwords are securely hashed; JWTs have sensible expiry and secret handling.
- [ ] Bank verification keys are registered/trusted and key rotation/revocation is considered.
- [ ] Bank confirmation tokens are hashed at rest, expiring and one-time; only minimal instrument data is exposed.
- [ ] Audit entries are added on submit, field change, upload, verification, flag resolution, reminder attempt, clearance, approval, rejection and release.
- [ ] Audit verification recalculates the chain; privileges prevent routine modification/deletion of existing audit rows.
- [ ] Sensitive data and logs do not expose raw tokens, secrets or unnecessary financial details.
- [ ] Backups, retention and restore behavior are documented for a real deployment.

This list is a minimum engineering target, not a formal security certification.

---

## 12. Technology decisions: stabilize before expanding

The project already has a feasible base stack: Next.js/TypeScript, Tailwind, FastAPI, SQLAlchemy, cryptography and PDF/image processing. Do not add a new framework for every feature.

### Keep and complete

- **FastAPI + SQLAlchemy:** use service functions for lifecycle/policy transitions and testable APIs.
- **Next.js + TypeScript:** keep the current UI; focus on role-aware views, evidence inspection and meaningful action states.
- **PostgreSQL target:** align actual settings/migrations/deployment with the intended database, while keeping any SQLite development mode explicitly separate if needed.
- **Cryptography:** use verified signed payloads and registered trust keys; avoid treating a self-generated signature as proof of a real bank's endorsement.
- **PDF and image tools:** use them to extract the actual uploaded evidence. Add a maintained OCR engine for scanned documents and test it on representative samples; do not claim OCR support if it is absent from dependencies/runtime.
- **Mock bank / notification adapters:** keep them as separate, callable services with clear `MOCK` labels until authorized real integrations are available.

### Defer unless core workflow passes

- A survival-analysis model trained on synthetic data and presented as institutional failure prediction.
- Complex graph/community algorithms without sufficient, legitimate relational data.
- An LLM/SLM used as an authority for data or approvals.
- A PageIndex branding claim if the external library is not actually integrated.
- Advanced forensic claims such as pixel-level alteration localization unless the actual uploaded file is analyzed, evidence is localized correctly and evaluation supports the claim.

**Non-negotiable rule:** deterministic policy gates and authenticated human authorization decide whether the workflow may proceed. AI may help read documents, find inconsistencies, summarize evidence or prioritize work; it must not silently authorize a financial release.

---

## 13. Demo and submission claims: what is safe to say

Use wording that matches what is genuinely running.

| Capability | Safe wording before a real integration exists | Do not claim |
|---|---|---|
| Bank verification | “Demonstrates a mock bank workflow / verifies signed test payloads using a registered test key.” | “Integrated with real banks” or “bank-confirmed” for a mock response. |
| AICTE system connection | “Integration adapter/interface is prepared; AICTE portal connection is not live in this prototype.” | “Live AICTE integration.” |
| OCR | “Extracts supported fields from tested sample documents”; disclose scanned-document limits. | “Reads every FDR perfectly.” |
| Forensics | “Flags file/metadata/image anomalies for human review.” | “Proves fraud” or “detects all forged FDRs.” |
| Risk ranking | “Transparent heuristic priority score based on the displayed factors.” | “Predicts fraud/default with validated probability” unless properly trained and validated. |
| Reminder service | “Clock-driven mock notification delivery is demonstrated.” | “SMS/email was delivered” when only a database row was created. |
| PageIndex/copilot | “Clause search over the configured handbook index” unless the external PageIndex library is actually used. | “PageIndex powered” or “verified citations” without integration and citation validation. |
| Audit log | “Hash-chained, tamper-evident audit log with integrity checks.” | “Impossible to tamper with” or “absolutely immutable.” |
| Performance metrics | “Measured on the stated synthetic dataset/test suite.” | General real-world accuracy based only on QR-signature tampering. |

A transparent prototype is more defensible than an impressive claim the code cannot substantiate.

---

## 14. Practical release gate: Definition of Done

Prama is ready to be presented as a credible PS 26265 prototype only when all required items below are checked off.

### Core functionality

- [ ] Institution and instrument records are persisted and searchable.
- [ ] An original document can be uploaded, securely retrieved by authorized users and processed.
- [ ] Supported fields are extracted from the document, stored with provenance and compared against submitted values.
- [ ] Missing documents, mismatches and duplicate indicators create explainable findings with evidence.
- [ ] Verification methods distinguish mock, manual, signed-payload and genuinely bank-confirmed outcomes.
- [ ] Validity/maturity tracking, renewal/replacement history and notification states work from persisted dates.
- [ ] Release readiness is policy-driven and each prerequisite/clearance is independently tracked.
- [ ] Unready cases cannot bypass the gate through direct API calls.
- [ ] Maker-checker approval is enforced and final output is generated as a real retrievable file.
- [ ] Dashboard, queues and reports are calculated from database state.

### Security and accountability

- [ ] All protected endpoints enforce authentication, role and institution scope.
- [ ] Private documents and financial data are not publicly accessible.
- [ ] Demo-only controls are gated and secrets/configuration are production-safe.
- [ ] All consequential actions are audited and integrity verification detects modified entries.

### Evidence of working behavior

- [ ] AT-01 through AT-16 are implemented, automated where feasible, and the actual test results are recorded.
- [ ] A fresh environment can be started from documented instructions and migrations.
- [ ] Seed data creation is explicit and can be reset reproducibly.
- [ ] The demo uses one case that completes the whole path, plus at least one deliberate defect/blocked-release case.
- [ ] External integrations and synthetic evaluation are labelled honestly.

---

## 15. Suggested judge demonstration: two cases, one complete lifecycle

Keep the live demonstration focused on the actual operational challenge.

### Case A — A valid instrument

1. Sign in as an institution user and submit an FDR with its supporting document.
2. Show document processing and compare submitted values with extracted values.
3. Show the verification method and exactly what it confirms; use a registered test key or clearly marked mock bank.
4. Show the instrument in the lifecycle view, including its next deadline and evidence history.
5. Advance the simulated clock and show the resulting reminder state and action item.
6. Create a replacement/renewal record and show its link to the previous instrument.
7. Submit a release request, satisfy the configured policy checklist and required clearances, and show a distinct maker and checker completing the workflow.
8. Open the actual generated output and audit history.

### Case B — A deficient instrument/request

1. Submit a document with an intentionally mismatched amount/date or a duplicated test instrument.
2. Show a finding with the form value, extracted value, source document reference and reason.
3. Attempt release while a required document/clearance is missing.
4. Show the exact blocking reason and demonstrate that a direct approval API call cannot bypass it.
5. Resolve the deficiency, record the required evidence/clearance and retry using valid permissions.

The powerful moment is not a dramatic AI score. It is proving that Prama **knows what is missing, cites the evidence, prevents premature release, tracks the correct person/action and only allows progression when the configured conditions are met**.

---

## 16. Final recommendation

Build Prama as an **evidence-backed FDR lifecycle and release-control platform**. The core innovations should be the field-level trust/provenance record, an explainable release-readiness checklist, a real action queue and a traceable renewal/approval lifecycle. Those are practical, connected to the PS wording and demonstrable without requiring every bank to offer an API on day one.

Do not treat these as optional polish: secure access control, original-document extraction, truthful verification, policy-based release gates, reliable lifecycle tracking and auditable actions are the foundation. Defer predictive AI and complex forensics until the core acceptance tests pass. Keep mock services honest and test real-world claims separately from synthetic prototype results.

**The final success criterion:** a reviewer can select one institution and one FDR, follow its record from submission to verification and monitoring, see the evidence behind every important finding, observe the renewal/replacement history, and confirm that release is blocked or permitted for specific, policy-backed reasons—with every consequential action authorized and auditable.

---

## References

1. [Prama — exact SIH PS 26265 text in `PS.md`](https://github.com/ShresthSingh01/Prama/blob/master/PS.md)
2. [Prama — Product Requirements Document (`FDR.md`)](https://github.com/ShresthSingh01/Prama/blob/master/FDR.md)
3. [Prama — Solution concept (`FDRIDEA.md`)](https://github.com/ShresthSingh01/Prama/blob/master/FDRIDEA.md)
4. [AICTE Approval Process Handbook 2024–2027 — official PDF](https://aicte-qa.aicte-india.org/sites/default/files/APH%20Final.pdf)
5. [Instrument API](https://github.com/ShresthSingh01/Prama/blob/master/backend/app/api/instruments.py) · [Verification API](https://github.com/ShresthSingh01/Prama/blob/master/backend/app/api/verification.py) · [Release API](https://github.com/ShresthSingh01/Prama/blob/master/backend/app/api/release.py)
6. [Forensic service](https://github.com/ShresthSingh01/Prama/blob/master/backend/app/services/forensic_service.py) · [Rules engine](https://github.com/ShresthSingh01/Prama/blob/master/backend/app/services/rules_engine.py) · [Audit service](https://github.com/ShresthSingh01/Prama/blob/master/backend/app/services/audit_service.py)
7. [Clock service](https://github.com/ShresthSingh01/Prama/blob/master/backend/app/services/clock_service.py) · [Document index](https://github.com/ShresthSingh01/Prama/blob/master/backend/app/services/document_index.py) · [SLM API](https://github.com/ShresthSingh01/Prama/blob/master/backend/app/api/slm.py) · [Evaluation API](https://github.com/ShresthSingh01/Prama/blob/master/backend/app/api/evaluation.py)

**Review limitation:** this document records source-inspection findings and an implementation target. It does not certify the system, independently validate the real-world policy applicability of every release checklist item, or claim that the repository's test suite was executed as part of this review. Re-run tests against the current branch after implementing changes and validate policy configuration against the rules applicable to each case.
