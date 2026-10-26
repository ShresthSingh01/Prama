---
type: bank
id: BANK-SBIN
name: State Bank of India
ifsc_prefix: SBIN
fdr_regex: ^SBIN\/\d{4}\/[A-Z0-9]{5,10}$
related:
- rules/R01-fdr-number-format.md
---

# State Bank of India (SBI)
Public sector lead bank for AICTE security deposit accounts.
Standard format: `SBIN/YYYY/XXXXX`. Supports Ed25519 bank-signed verification envelope.
