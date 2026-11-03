# PTA-8A — Current-PTA CSV export

## Outcome and boundary

Add one online-only CSV download to the existing selected PTA screen for Agents,
Supervisors and Validators. The export contains the current definitively approved
Activity baselines, the whole-PTA physical and financial metrics, and definitive
closed-Activity settlement facts. Pending changes retain their approved baseline,
effective withdrawals are excluded, and approved transfers count only in their
destination PTA.

The CSV is UTF-8 BOM, semicolon-separated, French-headed and formula-safe.
Unfinished settlement fields are blank; validated closed zero spending is `0`.
It excludes Operations, assignments, reasons, comments, draft values, documents,
workflow chronology and Partner access. Historical reconstruction, filters,
arbitrary columns, PDF/XLSX, storage, jobs and a generic report layer remain out
of scope. No migration is required.

## Smallest implementation

- Add one CSRF-protected `POST /api/v1/ptas/{pta_id}/exports` accepting only
  `{ "format": "csv" }`. Reuse the shared lifecycle lock, business principal,
  approved-plan/current-metrics projection and guarded synchronous delivery.
- Materialize one bounded complete selection independent of UI pagination. Each
  stable Activity row contains approved identity, revision, dates and allocation,
  current state, closed spending, current external confirmation, required and
  declared reversement, and closure date.
- Record export ID, PTA ID, snapshot time, row/byte counts and SHA-256 in the
  existing append-only audit transaction before returning bytes. Add no export
  persistence.
- Add one cancellable, non-retrying download action beside the existing annual
  PTA heading. Reuse the REST client, authorization-loss handling and safe object
  URL cleanup.

## Verification

Focused PostgreSQL/API checks cover role and resource authorization, CSRF/Origin,
approved membership across pending changes/withdrawal/transfer, positive and
validated-zero closure facts, exact aggregate metrics, deterministic lifecycle
races, bounded complete selection, CSV safety and headers, audit hash/rollback
and OpenAPI. React and Chromium checks cover deliberate download, offline and
authorization loss, safe cleanup and independence from list pagination. Run
focused metrics/closure/Fiche regressions and affected quality/build checks.

## Independent review gate

After final-candidate verification, return the requirements, diff and evidence to
the same read-only product/security and engineering reviewers that performed the
initial audit. They must distrust implementation claims and modify no files. The
implementer fixes accepted findings and returns the candidate to both reviewers.
Completion is blocked until both final re-reviews pass. Stop after PTA-8A.
