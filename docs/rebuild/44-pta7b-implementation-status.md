# PTA-7B implementation status

**PTA_7B_COMPLETE** on 2026-11-03.

PTA-7B adds reasoned withdrawal of Activity attachments. An Agent may withdraw
only an attachment they uploaded; a Validator may withdraw any attachment and is
the sole eligible role after Activity closure. Withdrawn files remain immutable
internal evidence but cannot be previewed or downloaded. A withdrawal may link a
distinct, later, active correction from the same Activity.

Migration `0019_pta7b` adds one append-only withdrawal-fact table. One POST
responsibility extends the existing document API, and the existing Activity panel
and Fiche show current and withdrawn attachment metadata. Metadata projections do
not load stored file bodies. Replacement selection follows the shared cursor
contract, and stale conflicts reconcile the TanStack Query state.

## Verification

- Final focused PostgreSQL/API suite: `30 passed` in `158.21s`, including roles,
  closed-Activity behavior, replacement validity, replay and deterministic races,
  audit rollback, direct-write constraints, migration use/refusal, schema guard,
  OpenAPI, metadata-only SQL and withdrawn preview/download denial.
- Migration and cross-slice selection: `23 passed`; adjacent database, Fiche,
  audit and closure checks: `45 passed`, with the corrected cursor oracle `4
  passed`. The final fixes did not alter the migration or these adjacent seams.
- Frontend unit suite: `67 passed`; focused Chromium document journey: `1 passed`.
- Backend Ruff, formatting and strict mypy passed. Frontend ESLint, Stylelint,
  Prettier and production build passed; the existing large-chunk warning remains.
- `git diff --check` passed. Tests used synthetic identities and disposable
  PostgreSQL resources.

The engineering/standards and specification/security reviewers independently
inspected the requirements, actual candidate and evidence without editing files.
Their findings on cross-page replacement selection, stable replacement naming,
CSRF/OpenAPI documentation, stale-conflict reconciliation and metadata-only
queries were corrected and returned to the same reviewers. Both final re-reviews
passed with no blocking finding or over-engineering concern.

Restoration, generic document versioning/categories, Partner visibility, wider
document contexts, production storage/scanning/retention, real accounts and later
slices remain deferred.
