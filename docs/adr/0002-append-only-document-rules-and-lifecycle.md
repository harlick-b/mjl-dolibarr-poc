---
status: accepted
---

# Freeze document rules and lifecycle as append-only records

Phase 4 records category changes as immutable Category Rule Revisions and
document state changes as sequenced lifecycle events, rather than mutating the
metadata later used as review evidence. Submitted business revisions freeze a
complete rule payload and qualifying document identifiers. This costs extra
records and projection logic, but preserves historical truth, makes concurrent
changes detectable, and prevents later catalog or withdrawal edits from
rewriting what reviewers actually assessed.
