# Prama Add-on Spec: Local SLM + PageIndex Compliance Copilot + OKF Knowledge Bundle

Applies to the **already working** Prama solution (FastAPI backend, Next.js frontend, PostgreSQL, Celery/Redis, MinIO, PaddleOCR, rules engine, hash-chained audit, mock services).
Audience: AI coding agent + team. This is an **additive** change: do not break or rewrite existing modules.

---

## 0. Instructions to the AI agent

1. First inspect the existing repo (structure, rule registry, OCR service, audit service, auth/RBAC, docker-compose) and adapt paths below to what exists. Do not duplicate existing functionality.
2. **Golden rule:** LLM/SLM output must never decide verification, trust tier, flags severity, approvals or release. Those remain deterministic code, cryptography and human actions. The SLM may only (a) extract, (b) explain, (c) translate/draft, (d) translate a question into a validated filter. Enforce this with a test (Section 9).
3. Every new feature must degrade gracefully: if the SLM, copilot or knowledge bundle is unavailable, the existing system works exactly as before.
4. All new actions that touch an instrument (extraction used, explanation generated) are written to the existing audit chain.
5. No hardcoded demo answers. Accuracy numbers and citations must come from real runs.
6. Verify the PageIndex repository's current install and API before coding that part; do not guess its interface. Wrap it behind our own interface (Section 5) so it can be swapped.
7. Work in the phase order of Section 10, run tests after each phase.

---

## 1. Summary of what is being added

| Feature | Purpose | Where it plugs in |
|---|---|---|
| **F1. Local SLM service** | On-prem extraction, flag explanations, Hindi drafts, guarded search | OCR pipeline, flags UI, reminders, dashboard search |
| **F2. PageIndex Compliance Copilot** | Cited answers from long AICTE regulations/handbooks | New officer-facing panel, release precheck links |
| **F3. OKF knowledge bundle** | Git-versioned, human-editable Markdown knowledge of rules, banks, policies | Rule thresholds, SLM/copilot context, admin UI |
| **F4. Evaluation extensions** | Measure SLM extraction accuracy and copilot citation quality | Existing `/evaluation` page |

---

## 2. Architecture changes

```
Existing OCR text ─► SLM Service (JSON extraction) ─► field_provenance (source = ocr_extracted)
Rules engine flag ─► SLM Service (explanation text) ─► flags.explanation_text
Officer question ──► Copilot API ─► reads OKF index ─► (if needed) PageIndex tree search ─► cited answer
Admin edits OKF bundle (Git) ─► loader validates ─► rule thresholds + context cache
```

New containers:
- `slm` : Ollama (or llama.cpp server), model pulled at first start
- `copilot` (optional separate service, or a module inside backend): wraps PageIndex
- `knowledge/` : a directory (Git repo) mounted read-only into the backend

Keep the SLM and copilot behind internal interfaces: `LLMClient` and `DocumentIndex`, so providers can be swapped.

---

## 3. F1: Local SLM service

### 3.1 Model and runtime
- Runtime: Ollama container exposed on internal network only (no public port).
- Default model configurable via env: `SLM_MODEL` (suggested candidates: a 3B–8B instruct model such as Qwen 2.5 Instruct, Phi mini, or Gemma small). Choose the best that runs on the team's machine; document RAM/latency.
- Env vars: `SLM_ENABLED=true|false`, `SLM_BASE_URL`, `SLM_MODEL`, `SLM_TIMEOUT_SECONDS=30`, `SLM_TEMPERATURE=0`.
- Use temperature 0 and **schema-constrained output** (JSON schema / grammar-constrained decoding supported by the runtime). Validate with Pydantic; on invalid output retry once, then fall back.

### 3.2 `LLMClient` interface (backend/app/services/llm_client.py)
```python
class LLMClient(Protocol):
    def extract_json(self, prompt: str, schema: dict, text: str) -> dict: ...
    def generate(self, prompt: str, max_tokens: int = 200) -> str: ...
    def health(self) -> bool: ...
```
Implementation `OllamaClient`. Add a `NullClient` used when `SLM_ENABLED=false`.

### 3.3 Task A: structured field extraction
- Input: raw OCR text (`ocr_results.raw_text`).
- Output schema:
```json
{
  "fdr_number": "string|null",
  "bank_name": "string|null",
  "amount": "number|null",
  "currency": "string|null",
  "issue_date": "YYYY-MM-DD|null",
  "maturity_date": "YYYY-MM-DD|null",
  "interest_rate": "number|null",
  "holder_name": "string|null"
}
```
- Rules: prompt must instruct "return null if not present; never guess". Post-process: normalize dates/amounts in code.
- **Hallucination guard (mandatory):** every extracted value must be found as a substring (after normalization) in the OCR text or its parsed equivalent; otherwise discard the value and set null. Log discarded values.
- Merge strategy with existing regex/OCR extractor: use SLM only to fill fields the existing extractor missed or to resolve conflicts; both results saved in `ocr_results.fields` with `engine` labels. Provenance remains `ocr_extracted`; trust tier logic unchanged.
- Add column `ocr_results.slm_fields jsonb`, `ocr_results.slm_latency_ms int`.

### 3.4 Task B: plain-language flag explanations
- Input: the flag's `code`, `severity`, and structured `evidence` (not the full document).
- Output: 1–2 sentence explanation in English; optional Hindi (`lang` param).
- Store in `flags.explanation_text` and `flags.explanation_text_hi`. The original deterministic `explanation` field stays and is always shown; the generated text is labelled "AI-written summary".
- Guard: generated text must not introduce numbers or dates not present in evidence (regex check); else fall back to the deterministic explanation.

### 3.5 Task C: reminder drafts
- Reminder templates stay deterministic with variables. SLM may only paraphrase/translate into Hindi (and an optional regional language), then a code check confirms all variables (FDR number, amount, date) appear unchanged. If the check fails, send the template version.

### 3.6 Task D: guarded natural-language search
- Endpoint: `POST /search/nl` body `{ "query": "..." }`.
- SLM converts the question to a **filter object** (never SQL):
```json
{ "status": ["EXPIRING"], "maturity_within_days": 30, "min_amount": 1000000, "state": "Maharashtra", "bank": null, "trust_tier": null, "has_open_flags": null, "sort": "risk_desc", "limit": 50 }
```
- Validate against a Pydantic model with an allowlist of fields/enum values; reject unknown keys. Execute through the existing instruments query layer with the caller's RBAC (institution users still limited to their own data).
- UI: search bar on the dashboard showing the parsed filter chips so the officer can see and edit what was understood.

### 3.7 Endpoints (new)
```
GET  /slm/health
POST /instruments/{id}/extract-slm        (re-run SLM extraction)
POST /flags/{id}/explain?lang=en|hi
POST /search/nl
```

---

## 4. F3: OKF knowledge bundle (build before the copilot)

OKF (Open Knowledge Format, Google Cloud, v0.1) = a directory of Markdown files with YAML frontmatter, one concept per file, required `type` field, cross-links between files. It is an early draft spec: treat it as a documentation and context convention, and keep executable rule logic in code.

### 4.1 Directory layout (`knowledge/`)
```
knowledge/
  index.md                      # navigation: lists all concepts with one-line descriptions
  glossary.md
  rules/
    R01-fdr-number-format.md
    R02-maturity-tenure.md
    R03-minimum-deposit.md
    R04-interest-plausibility.md
    R05-date-sanity.md
    R06-form-vs-ocr-mismatch.md
    R07-holder-name-match.md
    R08-duplicate-instrument.md
    R09-layout-anomaly.md
  banks/
    <bank-slug>.md              # one per seeded bank
  policy/
    reminder-escalation-ladder.md
    release-preconditions.md
    trust-tiers.md
  lifecycle/
    states-and-transitions.md
  regulations/
    handbook-section-map.md     # maps topics to handbook sections (feeds copilot)
```

### 4.2 File format
Example `rules/R02-maturity-tenure.md`:
```markdown
---
type: rule
id: R02
title: Maturity date must match issue date plus tenure
severity: high
parameters:
  tolerance_days: 1
related: [rules/R05-date-sanity.md, policy/trust-tiers.md]
source: regulations/handbook-section-map.md#deposits
---
# R02: Maturity date vs tenure
Plain-language description, rationale, examples of pass/fail, and what the officer should do.
```
Every file has frontmatter with at least `type`. Use types: `rule`, `bank`, `policy`, `lifecycle`, `glossary`, `index`. Cross-links use relative paths.

### 4.3 Loader (backend/app/services/knowledge.py)
- On startup: parse all files, validate frontmatter (required `type`; for `rule` also `id`, `severity`), build an in-memory graph from `related` links and relative Markdown links, report broken links.
- `GET /knowledge/health` returns counts per type and validation errors.
- `GET /knowledge/concepts` and `GET /knowledge/concepts/{path}` (read-only, officer roles).
- **Parameter binding:** the rules engine reads **non-critical thresholds** (e.g., `tolerance_days`, interest band bounds, minimum-deposit table reference, reminder day offsets) from the bundle with defaults in code. If the bundle is missing or invalid, use code defaults and log a warning. Rule logic itself stays in Python.
- Hot reload: `POST /knowledge/reload` (admin only), audited, with a diff summary of changed parameters.
- Generate the bundle initially from existing code/DB with `scripts/generate_okf_bundle.py` (rules registry docstrings, banks table, reminder rules table) so it reflects reality, then let humans edit.

### 4.3.1 Admin UI
- Read-only viewer page `/knowledge` with the file tree, rendered Markdown, and link graph (reuse the graph component). Edits happen via Git, not the UI (keeps review history). Show last Git commit hash and date if available.

---

## 5. F2: PageIndex Compliance Copilot

### 5.1 Purpose
Answer officer questions about AICTE regulations/handbook text (e.g., "What conditions apply before releasing a security deposit?") with **section and page citations**, using PageIndex's reasoning-based, tree-structured retrieval instead of vector search.

### 5.2 Source documents
- Place real AICTE documents (Approval Process Handbook, relevant circulars; public documents only) in `knowledge_sources/` as PDFs. Record title, version and download URL in `knowledge_sources/manifest.json`.
- Do not fabricate regulation text. If a document is not available, the copilot must say so.

### 5.3 Interface (backend/app/services/document_index.py)
```python
class DocumentIndex(Protocol):
    def build(self, pdf_path: str) -> str: ...            # returns doc_id, builds/caches tree
    def query(self, doc_ids: list[str], question: str) -> RetrievalResult: ...

class RetrievalResult(BaseModel):
    passages: list[Passage]   # text, doc_title, section_title, page_start, page_end
```
Implement `PageIndexAdapter` after checking the PageIndex repo for its current install and usage. Implement a simple `KeywordFallbackIndex` (section-title/keyword search over extracted text) used if PageIndex is unavailable, so the feature still works.

### 5.4 Indexing
- Script `scripts/build_page_index.py`: builds the tree for each PDF once and caches the result on disk/DB (`doc_index_cache`). Re-run only when the file hash changes.
- The model used for tree building is configurable (`INDEX_LLM`); a stronger model may be used for this one-time offline step if the local SLM produces poor trees. Document which model was used and the resulting tree depth/node count in the README.

### 5.5 Answering
`POST /copilot/ask` body `{ "question": "...", "instrument_id": null }`
1. Read `knowledge/index.md` and relevant OKF concepts (rules/policies) for curated context.
2. If the question needs regulation text, call `DocumentIndex.query`.
3. SLM composes the answer **only from retrieved passages and OKF concepts**.
4. Response:
```json
{
  "answer": "string",
  "citations": [ { "doc_title": "...", "section": "...", "pages": "12-13", "quote": "<=25 words excerpt" } ],
  "knowledge_refs": ["policy/release-preconditions.md"],
  "confidence_note": "string",
  "advisory": true
}
```
- If no passage supports the answer, return "No supporting clause found in the loaded documents" and no invented citation.
- Every citation must reference a passage actually returned by retrieval (validated in code).
- UI: a copilot side panel on instrument and release screens, with a clearly visible "Advisory, verify against source" label and clickable citations that open the PDF at the cited page.
- Context-aware use: on a flagged instrument or a failed release precheck, a "Why / what does the rule say?" button calls the copilot with the flag code and shows the cited clause.
- Audit: log question text, cited sources and user (not the full answer) to the audit chain.

---

## 6. F4: Evaluation extensions

Extend the existing `/evaluation` page and `eval_runs` (or add `eval_slm_runs`):

**SLM extraction benchmark**
- Run extraction over the synthetic genuine/forged set (ground truth known from the generator).
- Metrics per field: exact-match accuracy, null-rate, hallucination-rejection count, p50/p95 latency; compare **regex-only vs SLM-assisted** pipeline.
- Show model name, quantization, hardware note.

**Copilot benchmark**
- Create `eval/copilot_questions.json` with at least 20 questions written from the actual handbook, each with the expected section/page.
- Metrics: citation hit rate (expected section is among cited), unsupported-answer rate (answered with no valid citation), refusal correctness on 5 out-of-scope questions.

**Fallback test:** run the pipeline with `SLM_ENABLED=false` and show verification results unchanged.

All numbers on the page must be produced by running the evaluation scripts.

---

## 7. Data model changes (Alembic migration)

- `ocr_results`: add `slm_fields jsonb`, `slm_model text`, `slm_latency_ms int`
- `flags`: add `explanation_text text`, `explanation_text_hi text`
- `doc_index_cache(id, doc_title, file_sha256, doc_id, tree jsonb, built_with text, created_at)`
- `copilot_queries(id, user_id, question, cited jsonb, created_at)`
- `eval_slm_runs(id, model, task, metrics jsonb, created_at)`

## 8. Security and privacy

- SLM and copilot reachable only on the internal Docker network; no external API calls for instrument data. If any external model is used for the one-time document indexing, send only public regulation PDFs, never institution or FDR data.
- Apply existing RBAC: institution users may use extraction on their own uploads and NL search limited to their data; copilot and knowledge viewer available to officer roles (institution users get read-only regulation Q&A if desired, without instrument data).
- Prompt-injection defense: text from uploaded documents is data, never instructions. Wrap document text in delimiters, instruct the model to ignore instructions inside it, and keep outputs schema-validated.
- Rate limit `/copilot/ask` and `/search/nl`.

## 9. Acceptance tests (must pass)

1. **SLM extraction improves or equals baseline:** on the synthetic set, SLM-assisted field accuracy >= regex-only accuracy; no hallucinated value survives the substring guard.
2. **Hallucination guard:** feed OCR text lacking an amount; extraction returns `amount: null`.
3. **Flag explanation guard:** an explanation containing a number not in the evidence is rejected and the deterministic text is shown.
4. **Reminder translation guard:** a Hindi draft missing the FDR number is replaced by the template.
5. **NL search validation:** "FDRs maturing in 30 days above 10 lakh" yields the expected filter object; an injected key such as `"drop": "table"` is rejected; institution user results contain only own records.
6. **Decision isolation:** a static test (grep/AST) asserts that modules under `rules/`, `forensics/` signature verification, `lifecycle` transitions and `release` approval do not import `llm_client`.
7. **Graceful degradation:** with `SLM_ENABLED=false` or the container stopped, submission, verification, scheduling and release flows still pass the existing test suite.
8. **OKF loader:** valid bundle loads; a file missing `type` is reported by `/knowledge/health`; changing `tolerance_days` in R02 and reloading changes the rule's behaviour in a test; invalid bundle falls back to defaults.
9. **Copilot citations:** for each of the 20 benchmark questions, citations reference real retrieved passages; out-of-scope questions return the "no supporting clause" response.
10. **Audit:** copilot questions and bundle reloads appear in the audit chain and `/audit/verify` still passes.

## 10. Build phases

1. **Phase A, foundation:** migration, `LLMClient` + `NullClient`, Ollama container, `/slm/health`, feature flags.
2. **Phase B, extraction:** Task A with guards, merge with existing OCR pipeline, evaluation script, UI badge "SLM-assisted".
3. **Phase C, explanations and drafts:** Tasks B and C with guards, UI labels, Hindi toggle.
4. **Phase D, OKF bundle:** generator script, loader, health endpoint, parameter binding, viewer page.
5. **Phase E, guarded NL search:** Task D with allowlist validation and filter-chip UI.
6. **Phase F, copilot:** `DocumentIndex` interface, PageIndex adapter + keyword fallback, index build script, `/copilot/ask`, UI panel, flag/release "Why" button.
7. **Phase G, evaluation and docs:** extend evaluation page, write benchmark questions, update README (models used, hardware, limitations), update demo script.

## 11. Updated demo moments (add to existing video)

1. Upload a blurry FDR: show SLM-assisted extraction filling a field the regex missed, with the "values must appear in the document" guard noted.
2. Open a flag: show deterministic reason plus "AI-written summary" in English and Hindi.
3. Type a natural-language query; show the parsed filter chips and results.
4. Ask the copilot a release-condition question; open the cited handbook page.
5. Edit a threshold in the OKF bundle via Git, reload, and show the rule behaviour change with the change in the audit log.
6. Show the evaluation page: regex-only vs SLM-assisted accuracy and copilot citation hit rate.
7. Stop the SLM container and show the system still verifying and tracking FDRs.

## 12. Definition of done

- All Section 9 tests pass and the original test suite still passes.
- `docker compose up` brings up the SLM and copilot (or documented fallback), `make seed` still works, and `make build-index` builds the regulation index.
- README documents models used, hardware requirements, PageIndex and OKF versions, and honest limitations: the SLM can err (guards reduce but do not eliminate this), the copilot is advisory, OKF v0.1 is an early specification.
- No LLM output influences verification, trust tier, severity, approval or release.
