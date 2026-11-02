# PTA-4A — Current annual physical and financial metrics

Authority: DEC-121, the approved PTA brief, DEC-102, and completed PTA planning,
execution, settlement and closure through PTA-3F.

## Outcome and boundary

Show two read-only metrics for the selected current Project/year PTA:

- physical execution: closed Activities divided by definitively approved planned
  Activities;
- financial execution: final spending of closed Activities divided by the
  definitively approved PTA allocation.

The calculation covers the whole PTA and never inherits Activity pagination or
browser filters. Pending amendments retain their approved baseline. Approved
withdrawals are excluded; a transfer counts only in its approved destination
year. A zero denominator is non-calculable and a result above 100 percent is not
capped.

This slice adds no persistence, migration, mutation, audit action or background
job. Historical as-of KPI reconstruction, the Activity Fiche, exports, reminders,
documents, Partner access, production and real accounts remain separate work.

## Smallest implementation

- Add one authenticated read responsibility for the current PTA metrics. Reuse
  the existing shared read lock, role guard and approved-plan projection.
- Return the server timestamp and exact physical and financial numerator and
  denominator facts. Keep exact XOF strings. The French UI may round only the
  displayed percentage; the API facts remain exact.
- Add the two approved dashboard-style metric cards to the existing PTA screen,
  using a separate TanStack Query key. Preserve online-only access and existing
  auth invalidation.

## Verification

Focused PostgreSQL/API checks prove closed-only numerators, approved-plan
denominators, zero-denominator behavior, current annual attribution and business
role authorization. React checks prove the two cards, French labels, exact XOF,
non-calculable handling, uncapped display and independence from the paginated
Activity list. Run affected backend/frontend quality checks, OpenAPI generation,
the focused browser journey and `git diff --check` on the final candidate.

## Mandatory independent review

After implementation and verification, a separate agent that did not implement
the change leads a read-only review. It independently reads the governing rules,
diff, surrounding code and actual evidence and reports bugs, gaps, regressions,
security weaknesses and missing checks with severity and file/line evidence. The
implementer fixes accepted findings and returns the candidate to the same reviewer
for focused re-review. PTA-4A is not complete until blocking findings and required
evidence gaps are resolved. Stop after PTA-4A.
