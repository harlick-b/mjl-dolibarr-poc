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
- Dolibarr `fetchCommon()` object paths may expose `id` while SQL row arrays
  expose `rowid`; MJL access helpers that accept both objects and arrays should
  normalize the identifier before object-scope checks.
- Budget-line checks must distinguish committed budget consumption from actual
  disbursement: `committed_amount` follows final-validated/budget-consuming
  expenses, while `spent_amount` follows disbursed expenses.
