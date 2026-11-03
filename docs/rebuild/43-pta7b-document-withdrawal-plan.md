# PTA-7B — Activity attachment withdrawal and linked correction

## Outcome and boundary

Allow an Agent to withdraw only an Activity attachment they uploaded, with a
reason. A Validator may withdraw any Activity attachment and is the only role
that may do so after Activity closure. Withdrawal preserves the stored bytes and
metadata as history but prevents ordinary preview and download.

A plain withdrawal needs no replacement. To record a correction, the user first
uploads the corrected attachment through the existing route, then optionally
links that active, later attachment while withdrawing the incorrect one. The
link must remain within the same Activity. This slice adds no deletion,
restoration, generic version engine, categories, Partner visibility, wider
document contexts or production storage/scanning/retention.

## Smallest implementation

- Migration `0019_pta7b` adds one append-only withdrawal-fact table keyed by the
  existing document. It stores the optional replacement, reason, actor and time;
  constraints and a focused trigger preserve one immutable withdrawal and a
  same-Activity, non-self, active forward replacement link.
- Add one reasoned POST withdrawal responsibility beneath the existing Activity
  document. Reuse the current lifecycle advisory lock, current-principal/CSRF
  authorization, isolated-schema guard and transactional audit. Concurrent or
  replayed withdrawal fails closed.
- Extend the existing cursor list with withdrawal metadata and projected
  `withdraw` actions. Withdrawn items remain visible as history. Existing
  download and image-preview routes deny withdrawn content without recording a
  successful delivery audit.
- Correct the existing Fiche attachment row so it names current attachments and
  identifies withdrawn/replacement history instead of always claiming that no
  attachment exists. This is a bounded projection correction, not a Fiche
  redesign.
- Extend the supplied Activity-file panel with a compact reasoned withdrawal
  modal and optional replacement selector. Keep Router-owned pagination, Query
  invalidation, French labels, accessible status text and online-only mutation
  behavior.

## Verification

Focused disposable PostgreSQL/API checks cover Agent ownership, Validator and
closed-Activity authority, Supervisor/Admin denial, required reason, optional
valid replacement, self/cross-Activity/older/withdrawn replacement rejection,
one-time/replay behavior, historical listing, preview/download denial without
success audit, transactional audit rollback, deterministic delivery/withdrawal
and double-withdrawal races, direct-write constraints, migration round trip and
refusal, exact schema provenance and OpenAPI.

Focused React and Chromium checks cover plain withdrawal, linked correction,
closed-Activity role projection, historical status/link rendering, Query
invalidation, offline no-replay and disappearance of preview/download actions.
Run applicable formatting, lint, typing and build checks plus the existing
attachment/preview regressions.

## Independent review gate

After implementation and final-candidate verification, hand the requirements,
actual diff, surrounding code and evidence to separate read-only specification/
security and engineering/standards agents that did not implement the changes.
They must distrust implementation claims, modify no implementation files and
report defects or missing evidence with severity, file/line impact and the
smallest correction. The implementer fixes accepted findings and returns the
same candidate to the same reviewers for focused re-review. Completion is
blocked until both gates pass. Stop after PTA-7B.
