---
type: lifecycle
id: LIFE-STATES
title: FDR Lifecycle State Machine
related:
- policy/release-preconditions.md
- policy/reminder-escalation-ladder.md
---

# FDR Lifecycle States & Transition Rules

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
