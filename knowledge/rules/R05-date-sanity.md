---
type: rule
id: R05
title: Date Sanity & Future Issue Prevention
severity: HIGH
parameters:
  max_future_days: 1
related:
- rules/R02-maturity-tenure.md
source: regulations/handbook-section-map.md#deposits
---

# R05: Future Date Sanity
Ensures instrument issue date is not in the future relative to system clock (`max_future_days = 1`).
