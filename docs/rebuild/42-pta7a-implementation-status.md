# PTA-7A implementation status

**PTA_7A_COMPLETE** on 2026-11-03.

## Implemented boundary

An Agent can submit a reasoned zero-spending declaration only when every
Operation in the current approved Activity revision is complete with an explicit
zero spend. One eligible Supervisor may prevalidate it and one distinct eligible
Validator may approve it. After approval, the Agent can close the Activity
without creating a décaissement, virement, external confirmation or reversement.

The implementation adds a cursor-list/submit responsibility and one decision
responsibility under the Activity. Migration `0018_pta7a` adds one declaration
table and one append-only decision table. Exact Operation snapshots, current
approved revision, reviewer exclusions, legal chronology and closure eligibility
are checked by the application and PostgreSQL. Existing advisory locking,
authorization, transactional audit, schema provenance and execution/Fiche/audit
projections are reused. The existing execution workspace provides the French
Agent, Supervisor and Validator interactions with Router-owned pagination and
online-only mutations.

## Verification evidence

- All 19 focused PTA-7A PostgreSQL/API checks passed on the final candidate.
  They cover the complete closure path, stale and replayed requests, return and
  fresh submission, eligible-but-excluded reviewers, malformed direct writes,
  migration round trip/refusal, schema drift, transactional audit rollback and
  deterministic correction/submission and approval/closure races.
- Four affected positive-spending, closure and migration regression checks passed
  after updating their expected current migration head. The earlier broader
  adjacent run passed 77 checks; its three failures were those stale head
  assertions, and one transient invitation setup error passed on direct rerun.
- All 67 frontend unit checks passed. Focused tests exercise Agent submission,
  Supervisor prevalidation/return projection, Validator approval, post-approval
  closure availability, cursor history and query invalidation. The focused
  Chromium Agent journey passed 1/1.
- Ruff formatting/lint and strict mypy passed for the backend. Frontend ESLint,
  Stylelint, Prettier and the production/PWA build passed; the build retains the
  existing chunk-size warning. `git diff --check` passed.
- Only synthetic identities and the disposable `mjl-pta7a` PostgreSQL resources
  were used. External PC1/PC2 acceptance remains pending and real accounts remain
  prohibited.

## Independent review

Separate read-only specification/security and engineering/standards reviewers
inspected the requirements, diff, surrounding code and evidence without changing
implementation files. They initially found an invalid Validator-return
reference, incomplete exact-snapshot/null checks, a missing creation header,
cursor UI gaps and unverified reviewer/concurrency branches. The implementation
corrected each accepted finding and added focused evidence. The same reviewers
rechecked the corrected candidate and both returned **PASS** with no remaining
blocking finding.

Insufficiency, reopening, Partner access, document withdrawal/replacement, the
current-PTA CSV, production services and later slices remain deferred.
