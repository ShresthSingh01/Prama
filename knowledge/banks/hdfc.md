---
type: bank
id: BANK-HDFC
name: HDFC Bank
ifsc_prefix: HDFC
fdr_regex: ^HDFC-\d{4}-[A-Z0-9]{6,10}$
related:
- rules/R01-fdr-number-format.md
---

# HDFC Bank
Scheduled commercial bank. Format: `HDFC-YYYY-XXXXXX`. Supports tokenized nodal officer verify-link protocol.
