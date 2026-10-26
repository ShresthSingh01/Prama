---
type: policy
id: POL-TRUST
title: Cryptographic Trust Tier Progression
related:
- glossary.md
---

# Cryptographic Trust Tier Progression
Distinguishes institution-declared data from bank-verified ground truth:
- **SELF_DECLARED**: Entered by institution, pending verification.
- **DOC_EXTRACTED**: Corroborated by OCR and forensic layout analysis.
- **CROSS_VALIDATED**: Validated against state database or nodal email confirmation.
- **BANK_CONFIRMED**: Cryptographically authenticated via Ed25519 bank-signed QR or verified bank token.
