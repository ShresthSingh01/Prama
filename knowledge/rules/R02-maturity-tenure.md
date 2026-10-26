---
type: rule
id: R02
title: Maturity Date matches Issue Date plus Tenure
severity: HIGH
parameters:
  tolerance_days: 2
related:
- rules/R05-date-sanity.md
- policy/trust-tiers.md
source: regulations/handbook-section-map.md#deposits
---

# R02: Maturity Date vs Declared Tenure
Assesses whether `maturity_date == issue_date + tenure_days` within permissible calendar drift tolerance (`tolerance_days`).
Variance indicates falsified tenure claims or arithmetic date discrepancies.
