# Phase 3B Shared Cutover Execution Report — 2026-09-14

Authority: DEC-056 and DEC-057 under
`docs/mjl-authoritative-decisions.md`.

## Executed cutover

The guarded RST-012 cutover ran once from clean committed source
`8b5da1a75400479f3b5a69f5be2f629c2b5a8a80`:

```text
npm run cutover:rst012-fast -- --confirm=RST-012-FAST
```

The command stopped application traffic, verified the exact RST-006B
predecessor and empty business state, created the private database backup,
installed and verified RST-012, force-initialized the module, restarted the
application, and completed its health and evidence checks.

Private backup (not committed):
`data/backups/rst012/rst012-before-2026-09-14T12-13-37-002Z.sql`, mode `0600`,
897656 bytes, SHA-256
`9c91736fa819f2fb741d1cce90080541d842b6da75f2468cfeaad578f53597f0`.
This proves local backup custody and integrity; restoration was not run and is
not claimed.

## Independent post-cutover evidence

- `rst012_export_schema.php --mode=verify` and `--mode=verify-empty` passed.
- A fresh application process returned monitoring readiness state `1` and the
  local HTTP health probe passed.
- All 16 MJL custom tables are empty. The new empty
  `llx_mjlfinancement_export_record` has exactly its three immutable guard
  triggers: insert evidence validation plus update/delete denial.
- The tenant retains native technical Admin `rowid=1`; it has zero other users,
  business roles, Partenaires, Projets, Activities, Opérations, assignments,
  revisions, decisions, requests, invitations, resets, ECM files, audit events,
  or export records. No disposable controls are present.
- Admin evidence SHA-256 remained
  `929aa95ba1d67a44d5deaca6b8c16eff0e00b6fcebe2a8761d7468171d44319a`;
  ECM evidence remained
  `3120862f8f121c0a0122b453ab616b43671479aeb9199898f24658042fce0a2e`.
- The business-document digest remained
  `903b198228c78ef2801048d25ef914395662b2ac97ea04bdffbd5997ba4e2f5f`.
  The complete document-tree digest changed from
  `f2a24e9627733e4a4ef3d3b19da7e7da4058a6b329db637389b35f12c01c3916`
  to `8874542c1248c1211411a308efdeccfce0ab152dc5e87199a76711b930ae7f60`
  because forced module initialization appended to operational `initdb.log`.
  Its resulting SHA-256 is
  `c3913c80da28ddb06e958088a5c0dc2859080718bc74beaf1c25deb7541e9db5`;
  empty mode-0400 `install.lock` remains operational metadata. Neither file is
  included by the business-document digest.
- Existing cron row 4 remains the sole enabled entity-1 hourly registration
  for `/mjlfinancement/class/mjlexecutionreconciler.class.php`,
  `MjlExecutionReconciler::run`, frequency 1 and unit frequency 3600. This
  proves configuration preservation, not observation of a scheduler firing.

The database and module-metadata hashes changed as expected because RST-012
added its table/triggers and module initialization refreshed metadata. No
unrelated shared-state preservation claim is made from those unequal hashes.

## Technical verification

The committed Phase 3B technical gate remained the complete successful run of
2026-09-11 recorded in `docs/mjl-phase-3b-final-validation-2026-09-11.md`.
After cutover, two fresh `npm run test:phase3b` attempts each passed the full
111-case monitoring/report/recovery browser matrix. The first also passed the
installed-scale benchmark; the second was interrupted during scale setup.
External execution-channel interruptions stopped both runners before their
final RST-012 rehearsal/aggregate verdict. Each orphaned disposable tenant,
network, and three volumes was explicitly removed. These interrupted attempts
are supplemental evidence and are not represented as complete passing gates.

`npm run test:unit` subsequently passed 215/215 after the Phase 2 alias repair.
The final repaired `npm run test:phase2` passed the exact RST-012 and empty
checks plus all 43 retained browser cases in 343.7 seconds; its disposable
tenant, network, and three volumes were removed. An earlier repaired-alias
attempt was externally interrupted during its browser stage and was likewise
removed. `npm run test:verify` passed in 197.5 seconds and completed disposable
teardown.

## Verdict

RST-009C, RST-011, RST-012, RST-013D, and RST-014D are executed on the shared
empty local tenant. Phase 3B remains `PHASE_3B_READY_WITH_NOTES`; its sole
readiness note is unsigned human accessibility review. Under DEC-057 that note
does not block local development or Phase 3C planning, but it remains a
production/release blocker and no WCAG conformance is claimed. This verdict
does not authorize production launch.
