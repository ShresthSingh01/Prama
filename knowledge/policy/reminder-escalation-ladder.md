---
type: policy
id: POL-REMINDER
title: Reminder & Escalation Ladder
parameters:
  offsets:
  - 60
  - 30
  - 15
  - 7
  overdue_grace_days: 15
related:
- lifecycle/states-and-transitions.md
---

# Automated Reminder & Escalation Ladder
Schedule of proactive automated reminders before maturity:
- **T-60 Days**: Notice to Institution Admin (Email + SMS).
- **T-30 Days**: Formal Reminder with Renewal Checklist.
- **T-15 Days**: Escalation to Scrutiny Officer; Institution flagged as 'Expiring'.
- **T-7 Days**: Critical Alert to Senior Officer / Regional Officer.
- **T+15 Days**: Mark Overdue; Freeze regulatory processing.
