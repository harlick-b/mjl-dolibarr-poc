# Reusable Lessons

Update this file only after repeated mistakes, user corrections, or durable
debugging discoveries. Do not add one-off observations or generic advice.

- Dolibarr core files must not be edited for MJL work; use the custom module,
  documented setup scripts, documentation, sample-data locations, or a
  documented safe theme boundary.
- UI hiding is not access control. Direct URL and direct POST routes must stay
  guarded server-side.
- Active Dolibarr entity filtering is mandatory for custom objects, dashboards,
  exports, audit lists, document lookups, and workflow lookups.
- No-self-validation is a domain rule and must be enforced outside button
  visibility.
- Guarded ECM downloads must check entity, source type, source id, object
  access, and safe filesystem paths.
- Sample POC roles and groups are not the final production permission matrix.
- Future-only or internal roadmap features must not appear as available user
  actions.
- `MjlConvention` is the current funding-envelope model unless confirmed
  business rules prove it insufficient.
- MJL exports should remain French-labeled, Excel-readable, filtered
  server-side, and stable in filename/format.
- Production readiness requires current evidence in the readiness matrix,
  deployment checks, and test results; historical pass counts are not current
  verification.
- Validation verdicts must name their evidence boundary. Automated responsive
  checks cannot stand in for a required signed human keyboard/reflow/real
  browser-zoom matrix; keep the verdict pending until that evidence exists.
- Dolibarr `fetchCommon()` object paths may expose `id` while SQL row arrays
  expose `rowid`; MJL access helpers that accept both objects and arrays should
  normalize the identifier before object-scope checks.
- Budget-line checks must distinguish committed budget consumption from actual
  disbursement: `committed_amount` follows final-validated/budget-consuming
  expenses, while `spent_amount` follows disbursed expenses.
- For Apache `ErrorDocument` pages that should use the authenticated Dolibarr
  session, prefer `NOREDIRECTBYMAINTOLOGIN` over `NOLOGIN`; `NOLOGIN` avoids a
  login redirect but does not hydrate the session user for MJL shell rendering.
- Native-boundary checks must probe adjacent Dolibarr route families, not only
  named blocker routes; `/admin/*`, native `/user/*`, and dormant module routes
  can render native chrome even when the first blocked routes pass.
- E2E assertions for dated activities must not assume a fixed fixture remains
  before its deadline. Assert persisted execution controls and workflow state
  separately from the date-sensitive overdue label.
- HTTP filter normalizers must treat absent and empty default controls
  consistently. Test the unfiltered route as well as malformed values; a
  fail-closed parser can otherwise turn every default list request into an
  empty result without exposing a syntax or runtime error.
- Polymorphic audit-target resolution needs one entity-matched registry shared
  by every diagnostic caller. When a new audited object type is introduced,
  update that registry and prove both a valid anchor and a missing target;
  duplicated join lists silently misclassify otherwise valid audit rows.
- Fresh Docker bind initialization can leave document subdirectories owned by
  root with mode `0755`, which blocks upload E2E despite correct application
  behavior. Correct ownership or mode only inside the verified disposable
  document bind; never normalize permissions on shared workspace storage.
- A fresh Dolibarr Compose container can report `Up` while its installer is
  still importing tables and has not created the Admin user. Before running
  `bootstrap_poc.php`, verify installer completion through a read-only Admin
  user readiness check inside the named disposable database; container state
  alone is not a sufficient readiness signal.
- E2E journeys must resolve seeded business objects by stable entity/ref keys,
  not hard-coded row IDs. Auto-increment order on a clean database can map the
  same ID to a no-self or different-workflow fixture and make a UI assertion
  fail before the behavior under test is reached.
- Recovery fields that represent validated option selections must be alias-only:
  derive them server-side after authorization, never fall back to same-named
  request fields, and revalidate them against current scoped options before
  rendering. Cover both valid retention and request-injected aliases.
