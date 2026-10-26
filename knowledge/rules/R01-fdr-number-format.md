---
type: rule
id: R01
title: FDR Serial Number Format Compliance
severity: HIGH
parameters:
  strict_mode: true
related:
- banks/sbi.md
- banks/hdfc.md
source: regulations/handbook-section-map.md#deposits
---

# R01: FDR Serial Format Validation
Validates that the FDR serial number adheres to the issuing bank's official regex pattern.
FDRs with anomalous formatting suggest counterfeit certificates or clerical transposition errors.
