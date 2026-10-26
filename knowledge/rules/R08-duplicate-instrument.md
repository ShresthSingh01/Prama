---
type: rule
id: R08
title: Cross-Institution Duplicate Instrument & Hash Reuse
severity: CRITICAL
parameters:
  detect_identical_hash: true
  detect_same_serial: true
related:
- policy/trust-tiers.md
- banks/sbi.md
source: regulations/handbook-section-map.md#penal-action
---

# R08: Cross-Institution Duplicate Collusion Detection
CRITICAL FRAUD RING RULE: Flags any instance where an identical FDR serial number or exact PDF binary SHA-256 hash is submitted by two different institutions.
Triggers immediate syndication graph alert and referral for vigilance inquiry.
