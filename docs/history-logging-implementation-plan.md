# Business History and security logging — implemented contract

Updated 2026-11-06. Application implementation authorized and completed against
base commit `25d1d8d`; final verification/review is recorded in
[project status](project-status.md). This document retains the validated scope;
current rules live in [business rules](business-rules.md),
[engineering](engineering.md) and [security](security.md).

Production hosting, retention duration, collection configuration and deployment
verification remain separate. The retention-only decision handoff is
[retention-policy handoff](retention-policy-handoff.md). Its proposed durations are not approved
defaults. No production configuration or retention duration was selected.

## Validated decisions and invariants

- Global History is for meaningful saved business changes: PTA/Activity
  lifecycle, revisions/withdrawals, validation decisions and corrections,
  financial amounts/expenses/external settlements/closure, assignments, and
  Partner/Project/account administration.
- One authoritative business event per successful action; no unchanged saves,
  intermediate edits, routine requests/navigation or notification interactions.
  Record meaningful changed fields before/after, actor/time/entity and existing
  reasons. Preserve all old records; never invent missing historical facts.
- Global History: Admin sees all business events; Validateur sees only PTA,
  Activity, validation and financial events. Other roles cannot access it.
  Backend scope must cover lists, details, filters/options/counts and CSV.
- Preserve current visual structure, chronological order, search/contextual
  filters, and the label « Élément concerné ». Details expose safe recorded facts.
- Activity History is for authorized INTERNAL Activity viewers only. The user
  explicitly confirmed Partners still cannot see History. Do not expand Admin
  Activity access merely because Admin can read global History.
- Preserve an Activity timeline, distinguish major milestones from secondary
  edits simply, and use the same authoritative business audit records as global
  History. Existing revision/decision data remains intact.
- User confirmed document downloads/previews and exports retain their required
  internal audit evidence but are excluded from visible business History.
- Security logging covers completed authentication success/failure, relevant
  OTP failures, suspicious authorization failures and significant security
  changes. No routine OTP steps/resends/refreshes, secrets, sensitive bodies,
  uncontrolled flooding or indefinite new routine-auth database storage.
- Preserve financial/validation rules, immutable approvals, exact XOF,
  no-self-validation, session/CSRF guards and server resource isolation.
- Avoid unnecessary tables, migrations, frameworks, infrastructure and snapshots.
  Do not remove existing immutable revision snapshots needed by workflows.
- Use focused tests, a representative end-to-end journey and independent review.

## Implemented seams and decisions

- Existing append-only Audit records remain authoritative. Planning events store
  changed business fields, rather than duplicated API projections; immutable
  revision and financial evidence remains intact. Activity/profile/assignment
  unchanged saves produce no event. Profile facts preserve multibyte values
  within the existing audit size bound without truncation.
- The existing audit route module owns shared safe projection, global role
  selection and filtered CSV. An internal Activity History read uses the same
  records with Activity resource authorization. Both use timestamp/id ordering
  and signed cursor pagination. Existing reasons, exact amounts and legacy
  withdrawal revision evidence are exposed without fabricating missing facts.
- Global History keeps its table/filter layout. The Activity timeline now
  includes saved secondary edits and major milestones, with shared optional
  details. Existing revision navigation remains. Denied History reads/options/
  exports clear scoped cached data and cancel pending delivery.
- Routine authentication writes move to bounded structured `mjl.security`
  server output after transaction commit. Significant account administration
  retains its business evidence. The per-worker volume limit is configurable;
  suppression is summarized on the next event after the interval. No secrets,
  email/IP, request bodies or attacker-controlled identifier maps are logged.
- Standard Uvicorn access output is disabled in documented development startup.
  Hosting must protect/collect security output across deployments and enforce
  the future retention policy. Worker count multiplies the rate bound; process
  restarts reset it. These are documented operational limits, not a retention
  guarantee.
- No schema migration, new table, logging service or event framework was added.
  Existing finance/validation rules and historical records remain unchanged.

## Focused verification and independent review

Use disposable PostgreSQL for transaction, permission, legacy and workflow
checks; frontend unit checks for cache/denial/details; desktop/mobile browser
checks for rendering. The representative real API journey covers submission,
distinct approvals, execution, financial return reasons, matching histories,
filtered CSV and denied Partner access. Browser responses are mocked and are
separate evidence from that API journey.

The implementation ends with separate review-only agents inspecting requirements,
the actual diff, surrounding consumers and test evidence. Accepted findings are
fixed by the implementer and returned to the same reviewers. Review is not user
acceptance or production readiness. See project status for actual commands,
results, final review outcome and outstanding deployment boundaries.
