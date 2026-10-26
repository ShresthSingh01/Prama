import os
import yaml
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
KNOWLEDGE_DIR = BASE_DIR / "knowledge"

def ensure_dirs():
    for sub in ["rules", "banks", "policy", "lifecycle", "regulations"]:
        (KNOWLEDGE_DIR / sub).mkdir(parents=True, exist_ok=True)

def write_okf_file(rel_path: str, frontmatter: dict, markdown_content: str):
    file_path = KNOWLEDGE_DIR / rel_path
    file_path.parent.mkdir(parents=True, exist_ok=True)
    content = "---\n" + yaml.dump(frontmatter, sort_keys=False) + "---\n\n" + markdown_content.strip() + "\n"
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Generated OKF file: {rel_path}")

def generate_all():
    ensure_dirs()

    # 1. index.md
    write_okf_file(
        "index.md",
        {
            "type": "index",
            "title": "FDR-Sentinel Open Knowledge Format (OKF) Navigation Index",
            "version": "0.1.0",
            "department": "AICTE Regulation Bureau"
        },
        """# AICTE Regulation Bureau: Open Knowledge Bundle

This knowledge bundle codifies AICTE regulatory standards, automated inspection rules (R01-R09), institutional policies, and partner banking parameters.

## Core Navigation
- **[Glossary](glossary.md)**: Standard terminology and acronym definitions.
- **[Rules](rules/R01-fdr-number-format.md)**: Automated rules R01 through R09.
- **[Policies](policy/release-preconditions.md)**: Release preconditions, escalation ladders, trust tiers.
- **[Banks](banks/sbi.md)**: Bank-specific regexes, Ed25519 public key registries, and branch norms.
- **[Lifecycle](lifecycle/states-and-transitions.md)**: 12-stage FDR lifecycle state machine.
- **[Regulations](regulations/handbook-section-map.md)**: Mapping to AICTE Approval Process Handbook clauses.
"""
    )

    # 2. glossary.md
    write_okf_file(
        "glossary.md",
        {
            "type": "glossary",
            "title": "Regulatory & Banking Glossary",
            "related": ["policy/trust-tiers.md", "lifecycle/states-and-transitions.md"]
        },
        """# Regulatory & Banking Glossary

- **FDR**: Fixed Deposit Receipt pledged as mandatory security deposit to AICTE.
- **Trust Tier**: 4-level progressive confidence score (`SELF_DECLARED` -> `DOC_EXTRACTED` -> `CROSS_VALIDATED` -> `BANK_CONFIRMED`).
- **Ed25519 Signed QR**: High-speed, tamper-evident digital signature embedded in FDRs verified offline.
- **Collusion Ring**: Coordinated fraud where two or more institutions pledge the exact same FDR serial number or document file.
- **Maker-Checker**: Mandatory two-officer segregation of duties before refunding security deposit funds.
"""
    )

    # 3. Rules (R01 to R09)
    rules_data = [
        ("rules/R01-fdr-number-format.md", {
            "type": "rule", "id": "R01", "title": "FDR Serial Number Format Compliance",
            "severity": "HIGH", "parameters": {"strict_mode": True},
            "related": ["banks/sbi.md", "banks/hdfc.md"], "source": "regulations/handbook-section-map.md#deposits"
        }, """# R01: FDR Serial Format Validation
Validates that the FDR serial number adheres to the issuing bank's official regex pattern.
FDRs with anomalous formatting suggest counterfeit certificates or clerical transposition errors.
"""),
        ("rules/R02-maturity-tenure.md", {
            "type": "rule", "id": "R02", "title": "Maturity Date matches Issue Date plus Tenure",
            "severity": "HIGH", "parameters": {"tolerance_days": 2},
            "related": ["rules/R05-date-sanity.md", "policy/trust-tiers.md"], "source": "regulations/handbook-section-map.md#deposits"
        }, """# R02: Maturity Date vs Declared Tenure
Assesses whether `maturity_date == issue_date + tenure_days` within permissible calendar drift tolerance (`tolerance_days`).
Variance indicates falsified tenure claims or arithmetic date discrepancies.
"""),
        ("rules/R03-minimum-deposit.md", {
            "type": "rule", "id": "R03", "title": "Minimum Security Deposit Regulatory Floor",
            "severity": "HIGH", "parameters": {"min_amount": 500000.0},
            "related": ["policy/release-preconditions.md"], "source": "regulations/handbook-section-map.md#statutory-deposit"
        }, """# R03: Statutory Minimum Security Floor
Enforces that security deposit amounts meet or exceed the mandatory baseline threshold established in the AICTE Approval Process Handbook (default floor: Rs 5,00,000).
"""),
        ("rules/R04-interest-plausibility.md", {
            "type": "rule", "id": "R04", "title": "Plausible Commercial Interest Rate Band",
            "severity": "MEDIUM", "parameters": {"min_rate": 3.0, "max_rate": 9.5},
            "related": ["policy/trust-tiers.md"], "source": "regulations/handbook-section-map.md#deposits"
        }, """# R04: Interest Rate Plausibility
Verifies that declared annual interest rate falls strictly within plausible commercial banking boundaries (3.0% to 9.5% p.a.).
Rates below 3% or above 9.5% indicate typographical error or predatory microfinance paper.
"""),
        ("rules/R05-date-sanity.md", {
            "type": "rule", "id": "R05", "title": "Date Sanity & Future Issue Prevention",
            "severity": "HIGH", "parameters": {"max_future_days": 1},
            "related": ["rules/R02-maturity-tenure.md"], "source": "regulations/handbook-section-map.md#deposits"
        }, """# R05: Future Date Sanity
Ensures instrument issue date is not in the future relative to system clock (`max_future_days = 1`).
"""),
        ("rules/R06-form-vs-ocr-mismatch.md", {
            "type": "rule", "id": "R06", "title": "Form Declaration vs OCR Extracted Discrepancy",
            "severity": "HIGH", "parameters": {"amount_tolerance_percent": 0.0},
            "related": ["policy/trust-tiers.md"], "source": "regulations/handbook-section-map.md#verification"
        }, """# R06: Form Declaration vs OCR Extracted Mismatch
Flags discrepancies between data entered in the portal form and text extracted by OCR from the physical deposit receipt.
"""),
        ("rules/R07-holder-name-match.md", {
            "type": "rule", "id": "R07", "title": "Beneficiary / Holder Name Concordance",
            "severity": "HIGH", "parameters": {"fuzzy_threshold": 0.85},
            "related": ["policy/trust-tiers.md"], "source": "regulations/handbook-section-map.md#statutory-deposit"
        }, """# R07: Holder Name Concordance
Verifies that the FDR holder name matches the AICTE-registered institution name and mentions 'Joint Account with Regional Officer AICTE'.
"""),
        ("rules/R08-duplicate-instrument.md", {
            "type": "rule", "id": "R08", "title": "Cross-Institution Duplicate Instrument & Hash Reuse",
            "severity": "CRITICAL", "parameters": {"detect_identical_hash": True, "detect_same_serial": True},
            "related": ["policy/trust-tiers.md", "banks/sbi.md"], "source": "regulations/handbook-section-map.md#penal-action"
        }, """# R08: Cross-Institution Duplicate Collusion Detection
CRITICAL FRAUD RING RULE: Flags any instance where an identical FDR serial number or exact PDF binary SHA-256 hash is submitted by two different institutions.
Triggers immediate syndication graph alert and referral for vigilance inquiry.
"""),
        ("rules/R09-layout-anomaly.md", {
            "type": "rule", "id": "R09", "title": "Forensic Layout & Metadata Anomaly",
            "severity": "HIGH", "parameters": {"ela_anomaly_threshold": 0.45},
            "related": ["banks/sbi.md"], "source": "regulations/handbook-section-map.md#verification"
        }, """# R09: Forensic Layout & ELA Tamper Detection
Detects graphical manipulation, unauthorized editing software tags (Photoshop/Canva), or high Error Level Analysis (ELA) splice variance.
""")
    ]

    for rel_path, fm, md in rules_data:
        write_okf_file(rel_path, fm, md)

    # 4. Banks
    banks_data = [
        ("banks/sbi.md", {
            "type": "bank", "id": "BANK-SBIN", "name": "State Bank of India",
            "ifsc_prefix": "SBIN", "fdr_regex": r"^SBIN\/\d{4}\/[A-Z0-9]{5,10}$",
            "related": ["rules/R01-fdr-number-format.md"]
        }, """# State Bank of India (SBI)
Public sector lead bank for AICTE security deposit accounts.
Standard format: `SBIN/YYYY/XXXXX`. Supports Ed25519 bank-signed verification envelope.
"""),
        ("banks/hdfc.md", {
            "type": "bank", "id": "BANK-HDFC", "name": "HDFC Bank",
            "ifsc_prefix": "HDFC", "fdr_regex": r"^HDFC-\d{4}-[A-Z0-9]{6,10}$",
            "related": ["rules/R01-fdr-number-format.md"]
        }, """# HDFC Bank
Scheduled commercial bank. Format: `HDFC-YYYY-XXXXXX`. Supports tokenized nodal officer verify-link protocol.
"""),
        ("banks/pnb.md", {
            "type": "bank", "id": "BANK-PUNB", "name": "Punjab National Bank",
            "ifsc_prefix": "PUNB", "fdr_regex": r"^PNB\/\d{4}\/[A-Z0-9]{5,10}$",
            "related": ["rules/R01-fdr-number-format.md"]
        }, """# Punjab National Bank (PNB)
Public sector bank. Format: `PNB/YYYY/XXXXX`.
"""),
        ("banks/icici.md", {
            "type": "bank", "id": "BANK-ICIC", "name": "ICICI Bank",
            "ifsc_prefix": "ICIC", "fdr_regex": r"^ICICI-\d{4}-[A-Z0-9]{6,10}$",
            "related": ["rules/R01-fdr-number-format.md"]
        }, """# ICICI Bank
Private scheduled commercial bank.
""")
    ]
    for rel_path, fm, md in banks_data:
        write_okf_file(rel_path, fm, md)

    # 5. Policy
    policies_data = [
        ("policy/reminder-escalation-ladder.md", {
            "type": "policy", "id": "POL-REMINDER", "title": "Reminder & Escalation Ladder",
            "parameters": {"offsets": [60, 30, 15, 7], "overdue_grace_days": 15},
            "related": ["lifecycle/states-and-transitions.md"]
        }, """# Automated Reminder & Escalation Ladder
Schedule of proactive automated reminders before maturity:
- **T-60 Days**: Notice to Institution Admin (Email + SMS).
- **T-30 Days**: Formal Reminder with Renewal Checklist.
- **T-15 Days**: Escalation to Scrutiny Officer; Institution flagged as 'Expiring'.
- **T-7 Days**: Critical Alert to Senior Officer / Regional Officer.
- **T+15 Days**: Mark Overdue; Freeze regulatory processing.
"""),
        ("policy/release-preconditions.md", {
            "type": "policy", "id": "POL-RELEASE", "title": "Deposit Release Precondition Policy",
            "parameters": {"min_tenure_years": 8, "maker_checker_required": True},
            "related": ["policy/trust-tiers.md", "rules/R08-duplicate-instrument.md"],
            "source": "regulations/handbook-section-map.md#release"
        }, """# Deposit Release Precondition Policy
Before approving refund or release of any security deposit FDR, all preconditions must be verified:
1. Complete tenure elapsed (e.g. 8 or 10 years per course type).
2. All open flags resolved and zero adverse vigilance inquiries.
3. No pending student grievances or regulatory recovery notices.
4. Mandatory two-person Maker-Checker approval: Scrutiny Officer (Maker) checks documents, Senior Officer (Checker) approves.
"""),
        ("policy/trust-tiers.md", {
            "type": "policy", "id": "POL-TRUST", "title": "Cryptographic Trust Tier Progression",
            "related": ["glossary.md"]
        }, """# Cryptographic Trust Tier Progression
Distinguishes institution-declared data from bank-verified ground truth:
- **SELF_DECLARED**: Entered by institution, pending verification.
- **DOC_EXTRACTED**: Corroborated by OCR and forensic layout analysis.
- **CROSS_VALIDATED**: Validated against state database or nodal email confirmation.
- **BANK_CONFIRMED**: Cryptographically authenticated via Ed25519 bank-signed QR or verified bank token.
""")
    ]
    for rel_path, fm, md in policies_data:
        write_okf_file(rel_path, fm, md)

    # 6. Lifecycle
    write_okf_file(
        "lifecycle/states-and-transitions.md",
        {
            "type": "lifecycle", "id": "LIFE-STATES", "title": "FDR Lifecycle State Machine",
            "related": ["policy/release-preconditions.md", "policy/reminder-escalation-ladder.md"]
        },
        """# FDR Lifecycle States & Transition Rules

```
SUBMITTED ─► AUTO_CHECKED ─► UNDER_SCRUTINY ─► VERIFIED ─► ACTIVE
                                                            │
    ┌───────────────────────────────────────────────────────┘
    ▼
 EXPIRING ─► MATURED ─► RELEASE_REQUESTED ─► RELEASE_APPROVED ─► RELEASED
    │
    └─► OVERDUE (if not renewed within grace window)
```
Any state can transition to `FLAGGED` upon automated rule violation or manual adverse report.
"""
    )

    # 7. Regulations Map
    write_okf_file(
        "regulations/handbook-section-map.md",
        {
            "type": "regulations", "id": "REG-HANDBOOK-MAP", "title": "AICTE Approval Process Handbook Mapping",
            "related": ["policy/release-preconditions.md"]
        },
        """# AICTE Approval Process Handbook Mapping

- **Chapter 1, Clause 1.4**: Mandatory Joint FDR Security Deposit Requirement.
- **Chapter 2, Clause 2.8**: Minimum Deposit Baselines by Program (Engineering: Rs 15-35 Lakhs; Pharmacy/Management: Rs 10-15 Lakhs).
- **Chapter 3, Clause 3.12**: Bank-signed confirmation and verification protocols.
- **Chapter 6, Clause 6.5**: Release / Refund of Security Deposit after 8 or 10 years upon successful academic standing.
"""
    )

    print("All OKF bundle files successfully created at:", KNOWLEDGE_DIR)

if __name__ == "__main__":
    generate_all()
