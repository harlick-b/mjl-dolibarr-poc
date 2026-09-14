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

The backup checksum and mode/size were recomputed after cutover with
`sha256sum` and `stat`; they remained exactly the values above.

## Independent post-cutover evidence

- `docker compose exec -T dolibarr php
  /var/www/html/custom/mjlfinancement/scripts/rst012_export_schema.php
  --mode=verify` passed.
- The same exact command with `--mode=verify-empty` passed.
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

| Evidence | Before | After |
| --- | ---: | ---: |
| Native technical Admin rows | 1 | 1 |
| Other user rows | 0 | 0 |
| Business-role rows | 0 | 0 |
| Partenaire rows | 0 | 0 |
| Projet rows | 0 | 0 |
| Activity/Opération/assignment/revision/decision/request rows | 0 | 0 |
| Invitation/reset rows | 0 | 0 |
| Audit/export rows | 0 | 0 |
| ECM file rows | 0 | 0 |
| Enabled matching hourly reconciler registrations | 1 | 1 |
| Schema triggers | 34 | 37 |

The complete database evidence changed from
`a8722b414565ec60e68e7e196e83d4e1aa514f05a7420fbbcbf78ceb33da5e7c`
to `fd02d802a81d5d0ec07e426e4e0e92c633bcc9ce29bcf360784572171db328c7`.
The restorable database evidence changed from
`a1d48100d83d92110e8b077e2f5ad4249a1895f6197c386468ffd0070861c2d0`
to `f2b87e27c3d20a416b28fc18355993055b985d0364520ed8196431dda225f86a`.
Module metadata changed from
`82a6213714463ba7faecb0b31aef3050f684ba89173f3f7d057f86703ddbc0aa`
to `900d3e7da82ea276e822f725eb774148f0f8fdbb32904b534e9adcf6b43beb7a`.
These changes are scoped to the installed schema and refreshed module metadata.

## Technical verification

The post-cutover `npm run test:phase3b` gate passed from committed source
`6f1360d` in 2120.6 seconds. Disposable project
`mjl-test-20260914t142653-508893-c87ebc07` passed the installed schema/renderer/
Admin probes, all 111 monitoring/report/recovery browser cases, and the 17.5
minute scale benchmark. Wrapper project `mjl-rst012-wrapper-ryq5ug` passed
clean installation, repeated activation, guarded refusal, interrupted-DDL
convergence, malformed-state refusal, restart containment, empty schema
rollback, and evidence-preserving containment. Both projects completed cleanup;
no disposable container, network, or volume remained and no test artifact was
retained.

Two earlier post-cutover attempts each passed the same 111-case browser matrix;
the first also passed its scale benchmark. External execution-channel
interruptions stopped them before their aggregate verdicts. Their disposable
projects were `mjl-test-20260914t121457-182509-55871e25` and
`mjl-test-20260914t125043-295326-df3ddd7f`; each orphaned tenant, network, and
three volumes was explicitly removed. They are supplemental evidence only.

`npm run test:unit` subsequently passed 215/215 after the Phase 2 alias repair.
The final repaired `npm run test:phase2` passed the exact RST-012 and empty
checks plus all 43 retained browser cases in 343.7 seconds; its disposable
tenant, network, and three volumes were removed. An earlier repaired-alias
attempt was externally interrupted during its browser stage and was likewise
removed. `npm run test:verify` passed in 197.5 seconds and completed disposable
teardown.

The successful disposable RST-012 wrapper proves schema rollback to the empty
predecessor and forward recovery. The private shared database backup was not
restored; live/shared restoration remains unclaimed and requires separate
authorization.

## Verdict

RST-009C, RST-011, RST-012, RST-013D, and RST-014D are executed on the shared
empty local tenant. Phase 3B remains `PHASE_3B_READY_WITH_NOTES`; its sole
readiness note is unsigned human accessibility review. Under DEC-057 that note
does not block local development or Phase 3C planning, but it remains a
production/release blocker and no WCAG conformance is claimed. This verdict
does not authorize production launch.
