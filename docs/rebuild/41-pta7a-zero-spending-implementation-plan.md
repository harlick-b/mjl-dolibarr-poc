# PTA-7A — Validated zero-spending closure

## Outcome and boundary

Allow an Agent to close an approved Activity whose every approved Operation is
complete with an explicitly recorded zero spend. The Agent submits one reasoned
declaration; one eligible Supervisor prevalidates it and one distinct eligible
Validator approves it. The Agent may then close the Activity without creating a
disbursement, virement, confirmation or reversement.

This slice does not change the positive-spending chain, implement insufficiency,
reopening, banking, document workflows or Partner access. It remains restricted
to synthetic identities and the verified isolated database.

## Smallest implementation

- Add one declaration table and one append-only decision table. The declaration
  stores the approved revision, exact zero execution snapshot, reason, excluded
  reviewers, submitter, state and timestamps. Database constraints and deferred
  consistency triggers protect immutable facts, legal transitions, reviewer
  separation and decision chronology.
- Add a cursor-list/submit responsibility and a decision responsibility under
  the Activity. A returned declaration is terminal; after correcting execution,
  the Agent submits a fresh declaration. No cancellation action or generic
  workflow abstraction is added.
- Reuse the existing audited execution-basis verifier, advisory mutation lock,
  role/resource authorization, reviewer exclusions, Activity version conflict,
  transaction audit and exact isolated-schema guard. Positive disbursement keeps
  its `amount > 0` rule.
- Freeze execution and planning mutations while a declaration is submitted,
  prevalidated or approved. A return releases corrections. Closure verifies an
  approved declaration against the current approved revision and current exact
  zero basis; uncertainty fails closed.
- Extend the existing realization detail screen with a compact French declaration
  and review section. Server-projected actions govern controls. Mutations do not
  retry offline and invalidate Activity, history, list and planning queries.

## Verification

Focused PostgreSQL tests cover the complete zero path, positive/incomplete/nonzero
rejection, role and reviewer exclusions, distinct reviewers, returns and fresh
submission, stale versions/revisions, replay, freeze/release, exact-basis closure,
audit rollback, constraints, concurrent correction/review/closure, migration
upgrade/refusal and schema fail-closed behavior. Existing positive financial and
closure tests protect adjacent behavior.

Focused React and Playwright checks cover Agent submission, Supervisor and
Validator review, final closure availability, server-action rendering, query
invalidation, stale failure refresh and offline no-replay. Run REST/OpenAPI,
formatting, lint, typing and build checks applicable to changed files.

## Independent review gate

After implementation and candidate verification, hand the requirements, actual
diff, surrounding code and evidence to a separate review-only agent that did not
implement the changes. The reviewer must distrust implementation claims, modify
no implementation files, and report defects and missing evidence with severity,
file/line evidence, impact and the smallest correction. The implementer fixes
accepted findings and returns the same candidate to that reviewer for focused
re-review. Completion is blocked until all blocking findings and mandatory gaps
are resolved. Stop after PTA-7A.
