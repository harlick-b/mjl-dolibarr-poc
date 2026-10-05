# Dead-code analysis

The final 157-file pass plus repository-wide caller search found seven helper functions with no discovered live internal entry: one candidate calls another inside an otherwise unreachable pair, while the other five have definitions only. Dolibarr conventions and possible external/dynamic invocation prevent an absolute dead-code claim without runtime reachability evidence.

| Candidate | Classification | Evidence and remaining proof |
| --- | --- | --- |
| `mjl_activity_access_can_mutate`, `mjl_activity_access_require_mutation` | NO_INTERNAL_CALLER_CANDIDATE | only the latter calls the former; neither is invoked elsewhere in the repository; dynamic/external reachability unproven |
| `mjl_auth_token`, `mjl_auth_absolute_url`, `mjl_auth_mail_from` | NO_INTERNAL_CALLER_CANDIDATE | definitions only; live internal auth paths use token pairs and email helpers directly; external calls unproven |
| `mjl_scope_object_pointer`, `mjl_scope_document_pointer` | NO_INTERNAL_CALLER_CANDIDATE | definitions only; current document endpoints are deny-only; external calls unproven |
| `project_note` table surface | SCHEMA_ONLY_DEAD_FUNCTIONALITY | installed and preserved by migration code, but no runtime reader/writer exists; deletion needs a lifecycle compatibility decision |
| `mjl_project_recovery.lib.php`, `mjl_recovery_registry.lib.php` | UNRESOLVED | no production require/caller discovered; search tests/dynamic includes and establish replacement owner |
| `mjl_csv_export_output`, `mjl_xlsx_export_output` | HISTORICAL / UNRESOLVED | newer export object/renderer owns current reports; direct caller not found |
| unused `mjl_table_*` normalization/filter/pagination helpers | UNRESOLVED | action-menu helper remains live; check all dynamic/function-name use |
| older `mjl_activity_access_*` wrappers | UNRESOLVED | current routes/commands use narrower helpers; dynamic/test use not fully reconciled |
| Admin demotion/deactivation sub-branches in scope assignment | HISTORICAL defensive residue | upstream target validation rejects native Admin; confirm no alternate caller bypass |
| `redirectAfterConnection()` | LIKELY_ACTIVE interface placeholder | Dolibarr invokes by hook name even though implementation is no-op |
| `dashboard_resilience_test.php` nested contract | TEST_ONLY / HISTORICAL | requires absent library and top-level-only runner cannot discover it |
| `vui-foundations.browser.js` | TEST_ONLY / UNSAFE_DORMANT | unreferenced Node test defaults to shared port 8080 without disposable preflight |
| `.mjl-document-*`, `.mjl-roadmap-list` CSS | UNRESOLVED | definition-only source search; native/generated use not disproved |
| legacy `workflowactions.php` inline query | MIGRATION_ONLY | used only before export schema readiness |

Every candidate requires focused characterization and `REMOVE_WITH_PROOF`; schema, historical and dynamic candidates additionally require explicit compatibility decisions.
