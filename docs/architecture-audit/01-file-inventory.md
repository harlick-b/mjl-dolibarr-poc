# File inventory and source ledger

Evidence kind: `SOURCE`. `VERIFIED` here means the file content was included in the forensic source pass; it does not assert runtime reachability. Per-file SHA-256 values are in `annex-file-fingerprints.tsv`. Generated audit files are excluded from the denominator.

| Path | Lines | Bytes | Classification | Responsibility | Audit status |
| --- | ---: | ---: | --- | --- | --- |
| `custom/mjlfinancement/activities.php` | 7 | 199 | WEB_ENTRYPOINT | Activity route adapter | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/admin/access.php` | 158 | 6697 | WEB_ENTRYPOINT | web route | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/alerts.php` | 7 | 366 | WEB_ENTRYPOINT | alerts projection entrypoint | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/auth.php` | 100 | 5008 | WEB_ENTRYPOINT | OTP authentication controller | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/class/actions_mjlfinancement.class.php` | 171 | 5983 | APPLICATION_CLASS | actions mjlfinancement domain adapter | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/class/mjlactivity.class.php` | 81 | 4578 | APPLICATION_CLASS | activity domain adapter | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/class/mjlactivityassignment.class.php` | 256 | 12033 | APPLICATION_CLASS | activityassignment domain adapter | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/class/mjlactivitycommand.class.php` | 656 | 78378 | APPLICATION_CLASS | activitycommand domain adapter | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/class/mjlcancellationrequest.class.php` | 13 | 324 | APPLICATION_CLASS | cancellationrequest domain adapter | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/class/mjlexecutionreconciler.class.php` | 31 | 1410 | APPLICATION_CLASS | executionreconciler domain adapter | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/class/mjlexport.class.php` | 151 | 10919 | APPLICATION_CLASS | export domain adapter | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/class/mjlexportspool.class.php` | 94 | 4435 | APPLICATION_CLASS | exportspool domain adapter | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/class/mjlmonitoring.class.php` | 166 | 13095 | APPLICATION_CLASS | monitoring domain adapter | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/class/mjloperationtype.class.php` | 45 | 1417 | APPLICATION_CLASS | operationtype domain adapter | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/class/mjlreopeningrequest.class.php` | 11 | 242 | APPLICATION_CLASS | reopeningrequest domain adapter | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/core/modules/modMjlFinancement.class.php` | 293 | 17214 | MODULE_DESCRIPTOR | module registration, rights, hooks, cron, activation and schema guards | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/core/tpl/login.tpl.php` | 49 | 3345 | TEMPLATE | Dolibarr authentication template override | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/core/tpl/passwordforgotten.tpl.php` | 15 | 1378 | TEMPLATE | Dolibarr authentication template override | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/core/tpl/passwordreset.tpl.php` | 23 | 1376 | TEMPLATE | Dolibarr authentication template override | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/css/mjl_app.css.php` | 2417 | 71307 | ASSET_CSS | runtime presentation rules | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/css/mjl_auth.css.php` | 3 | 6227 | ASSET_CSS | runtime presentation rules | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/deployment/apache-native-guard.conf` | 28 | 1271 | CONFIGURATION | Apache pre-PHP access enforcement | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/documentdownload.php` | 8 | 244 | WEB_ENTRYPOINT | denied document endpoint | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/documents.php` | 8 | 244 | WEB_ENTRYPOINT | denied document endpoint | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/dpafdashboard.php` | 4 | 136 | WEB_ENTRYPOINT | historical denied route | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/index.php` | 31 | 1645 | WEB_ENTRYPOINT | dashboard entrypoint | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/invitation.php` | 41 | 1863 | WEB_ENTRYPOINT | invitation redemption controller | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/js/activities.js` | 115 | 5454 | ASSET_JS | browser behavior and DOM contracts | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/js/auth_fragment.js` | 9 | 390 | ASSET_JS | browser behavior and DOM contracts | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/js/mjl_auth.js` | 67 | 2802 | ASSET_JS | browser behavior and DOM contracts | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/js/mjl_components.js` | 913 | 36802 | ASSET_JS | browser behavior and DOM contracts | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/js/mjl_financial_preview.js` | 40 | 1499 | ASSET_JS | browser behavior and DOM contracts | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/js/mjl_form_controls.js` | 130 | 6232 | ASSET_JS | browser behavior and DOM contracts | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/js/native_guard.js.php` | 61 | 1538 | ASSET_JS | browser behavior and DOM contracts | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/langs/en_US/mjlfinancement.lang` | 7 | 251 | LANGUAGE | translation catalog | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/langs/fr_FR/mjlfinancement.lang` | 7 | 279 | LANGUAGE | translation catalog | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_access_ui.lib.php` | 108 | 11179 | APPLICATION_LIBRARY | access ui procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_activity_access.lib.php` | 67 | 2908 | APPLICATION_LIBRARY | activity access procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_activity_form.lib.php` | 32 | 2054 | APPLICATION_LIBRARY | activity form procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_activity_route.lib.php` | 549 | 59472 | APPLICATION_LIBRARY | activity route procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_alert_condition.lib.php` | 35 | 1602 | APPLICATION_LIBRARY | alert condition procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_audit.lib.php` | 163 | 6393 | APPLICATION_LIBRARY | audit procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_audit_projection.lib.php` | 174 | 19760 | APPLICATION_LIBRARY | audit projection procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_audit_report_route.lib.php` | 74 | 8445 | APPLICATION_LIBRARY | audit report route procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_auth.lib.php` | 723 | 43580 | APPLICATION_LIBRARY | auth procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_auth_ui.lib.php` | 46 | 3584 | APPLICATION_LIBRARY | auth ui procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_csv_export.lib.php` | 65 | 1734 | APPLICATION_LIBRARY | csv export procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_dashboard_ui.lib.php` | 89 | 6566 | APPLICATION_LIBRARY | dashboard ui procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_email.lib.php` | 294 | 11049 | APPLICATION_LIBRARY | email procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_email_presentation.lib.php` | 13 | 1914 | APPLICATION_LIBRARY | email presentation procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_exception_ui.lib.php` | 28 | 2205 | APPLICATION_LIBRARY | exception ui procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_execution.lib.php` | 165 | 7064 | APPLICATION_LIBRARY | execution procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_feedback.lib.php` | 113 | 6273 | APPLICATION_LIBRARY | feedback procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_form.lib.php` | 229 | 7862 | APPLICATION_LIBRARY | form procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_form_submission.lib.php` | 133 | 4334 | APPLICATION_LIBRARY | form submission procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_monitoring.lib.php` | 127 | 9377 | APPLICATION_LIBRARY | monitoring procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_monitoring_access.lib.php` | 24 | 1048 | APPLICATION_LIBRARY | monitoring access procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_monitoring_route.lib.php` | 287 | 29131 | APPLICATION_LIBRARY | monitoring route procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_monitoring_work.lib.php` | 64 | 3830 | APPLICATION_LIBRARY | monitoring work procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_native_modules.lib.php` | 36 | 713 | APPLICATION_LIBRARY | native modules procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_navigation.lib.php` | 111 | 6588 | APPLICATION_LIBRARY | navigation procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_navigation_registry.lib.php` | 108 | 5368 | APPLICATION_LIBRARY | navigation registry procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_operation_consultation.lib.php` | 41 | 3465 | APPLICATION_LIBRARY | operation consultation procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_operation_request_route.lib.php` | 79 | 14232 | APPLICATION_LIBRARY | operation request route procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_operation_route.lib.php` | 122 | 15007 | APPLICATION_LIBRARY | operation route procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_page_header.lib.php` | 99 | 4183 | APPLICATION_LIBRARY | page header procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_presentation.lib.php` | 145 | 6415 | APPLICATION_LIBRARY | presentation procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_project_recovery.lib.php` | 69 | 2490 | APPLICATION_LIBRARY | project recovery procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_recovery_registry.lib.php` | 104 | 2509 | APPLICATION_LIBRARY | recovery registry procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_reference.lib.php` | 340 | 13529 | APPLICATION_LIBRARY | reference procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_reference_route.lib.php` | 190 | 13483 | APPLICATION_LIBRARY | reference route procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_reference_ui.lib.php` | 73 | 5105 | APPLICATION_LIBRARY | reference ui procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_report_data.lib.php` | 244 | 15491 | APPLICATION_LIBRARY | report data procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_report_format.lib.php` | 58 | 3027 | APPLICATION_LIBRARY | report format procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_report_render.lib.php` | 170 | 9132 | APPLICATION_LIBRARY | report render procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_report_route.lib.php` | 247 | 21205 | APPLICATION_LIBRARY | report route procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_report_ui.lib.php` | 71 | 4684 | APPLICATION_LIBRARY | report ui procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_scope.lib.php` | 524 | 19221 | APPLICATION_LIBRARY | scope procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_table.lib.php` | 241 | 10075 | APPLICATION_LIBRARY | table procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_timeline.lib.php` | 61 | 4598 | APPLICATION_LIBRARY | timeline procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_timeline_presentation.lib.php` | 112 | 8244 | APPLICATION_LIBRARY | timeline presentation procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_timeline_result.lib.php` | 38 | 1455 | APPLICATION_LIBRARY | timeline result procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_ui.lib.php` | 149 | 6724 | APPLICATION_LIBRARY | ui procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_workflow_audit.lib.php` | 37 | 1279 | APPLICATION_LIBRARY | workflow audit procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/lib/mjl_xlsx_export.lib.php` | 106 | 2697 | APPLICATION_LIBRARY | xlsx export procedural module | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/nativeforbidden.php` | 9 | 299 | WEB_ENTRYPOINT | dependency-free HTTP denial | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/operationrequests.php` | 7 | 217 | WEB_ENTRYPOINT | exception-request route adapter | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/operations.php` | 7 | 201 | WEB_ENTRYPOINT | Operation route adapter | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/operationtypes.php` | 8 | 215 | WEB_ENTRYPOINT | Operation-type route adapter | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/partners.php` | 8 | 208 | WEB_ENTRYPOINT | Partner reference route adapter | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/projects.php` | 8 | 208 | WEB_ENTRYPOINT | Project reference route adapter | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/reportexport.php` | 7 | 241 | WEB_ENTRYPOINT | audited export route adapter | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/reports.php` | 4 | 109 | WEB_ENTRYPOINT | report route adapter | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/activity_schema_installer.lib.php` | 818 | 64794 | MIGRATION_SCRIPT | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/bootstrap_poc.php` | 58 | 1702 | MIGRATION_SCRIPT | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/cli_guard.php` | 8 | 142 | MIGRATION_SCRIPT | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/disable_native_workspace_modules.php` | 36 | 887 | MIGRATION_SCRIPT | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/oracles/rst005_phase1_activity.sql` | 33 | 1705 | INSTALLATION_SQL | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/preserved_admin.lib.php` | 27 | 719 | MIGRATION_SCRIPT | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/rst002b_activity_assignment.php` | 276 | 18878 | MIGRATION_SCRIPT | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/rst005_activity_foundation.php` | 711 | 49613 | MIGRATION_SCRIPT | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/rst005_oneoff_bootstrap.php` | 85 | 2861 | MIGRATION_SCRIPT | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/rst005_shared_launcher.js` | 187 | 11295 | MIGRATION_SCRIPT | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/rst005_shared_launcher.lib.js` | 609 | 40851 | MIGRATION_SCRIPT | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/rst005_shared_operation.lib.js` | 1583 | 112023 | MIGRATION_SCRIPT | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/rst005_shared_packet.js` | 191 | 12966 | MIGRATION_SCRIPT | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/rst006a-dependent-units.json` | 52 | 936 | CONFIGURATION | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/rst006a_activity_planning.php` | 123 | 9097 | MIGRATION_SCRIPT | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/rst006a_schema.lib.php` | 574 | 64917 | MIGRATION_SCRIPT | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/rst006b_documents_evidence.php` | 26 | 2773 | MIGRATION_SCRIPT | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/rst006b_execution.php` | 63 | 5434 | MIGRATION_SCRIPT | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/rst006b_schema.lib.php` | 305 | 40652 | MIGRATION_SCRIPT | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/rst012_export_schema.php` | 61 | 4836 | MIGRATION_SCRIPT | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/rst012_schema.lib.php` | 119 | 7062 | MIGRATION_SCRIPT | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/rst_phase1_reset.php` | 137 | 9595 | MIGRATION_SCRIPT | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/schema/rst006a_operation.sql` | 27 | 1449 | INSTALLATION_SQL | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/schema/rst012_report.sql` | 34 | 2059 | INSTALLATION_SQL | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/verification/schema/activity_assignment.php` | 23 | 1141 | VERIFICATION | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/verification/schema/activity_execution_schema.php` | 18 | 788 | VERIFICATION | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/verification/schema/activity_foundation.php` | 31 | 1759 | VERIFICATION | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/verification/schema/activity_planning.php` | 15 | 608 | VERIFICATION | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/verification/schema/reference_foundation.php` | 105 | 6354 | VERIFICATION | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/verify_phase1_behavior.php` | 52 | 3412 | VERIFICATION | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/verify_phase1_reset.php` | 32 | 4053 | VERIFICATION | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/scripts/verify_phase1_schema_exact.php` | 172 | 18134 | VERIFICATION | installation, migration, reset, or verification support | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_activity.key.sql` | 14 | 1835 | INSTALLATION_SQL | schema or key definition for activity | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_activity.sql` | 33 | 2151 | INSTALLATION_SQL | schema or key definition for activity | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_activity_assignment.key.sql` | 1 | 175 | INSTALLATION_SQL | schema or key definition for activity assignment | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_activity_assignment.sql` | 29 | 2081 | INSTALLATION_SQL | schema or key definition for activity assignment | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_activity_reference_sequence.sql` | 8 | 448 | INSTALLATION_SQL | schema or key definition for activity reference sequence | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_activity_revision.key.sql` | 2 | 383 | INSTALLATION_SQL | schema or key definition for activity revision | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_activity_revision.sql` | 23 | 1230 | INSTALLATION_SQL | schema or key definition for activity revision | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_audit_event.key.sql` | 10 | 1095 | INSTALLATION_SQL | schema or key definition for audit event | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_audit_event.sql` | 28 | 1239 | INSTALLATION_SQL | schema or key definition for audit event | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_cancellation_request.key.sql` | 4 | 860 | INSTALLATION_SQL | schema or key definition for cancellation request | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_cancellation_request.sql` | 36 | 2913 | INSTALLATION_SQL | schema or key definition for cancellation request | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_invitation.key.sql` | 6 | 655 | INSTALLATION_SQL | schema or key definition for invitation | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_invitation.sql` | 24 | 1514 | INSTALLATION_SQL | schema or key definition for invitation | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_login_otp.key.sql` | 4 | 454 | INSTALLATION_SQL | schema or key definition for login otp | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_login_otp.sql` | 22 | 1162 | INSTALLATION_SQL | schema or key definition for login otp | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_operation.key.sql` | 5 | 922 | INSTALLATION_SQL | schema or key definition for operation | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_operation.sql` | 30 | 1888 | INSTALLATION_SQL | schema or key definition for operation | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_operation_type.key.sql` | 6 | 804 | INSTALLATION_SQL | schema or key definition for operation type | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_operation_type.sql` | 10 | 392 | INSTALLATION_SQL | schema or key definition for operation type | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_password_reset.key.sql` | 6 | 649 | INSTALLATION_SQL | schema or key definition for password reset | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_password_reset.sql` | 17 | 1021 | INSTALLATION_SQL | schema or key definition for password reset | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_project_note.key.sql` | 5 | 640 | INSTALLATION_SQL | schema or key definition for project note | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_project_note.sql` | 13 | 464 | INSTALLATION_SQL | schema or key definition for project note | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_reopening_request.key.sql` | 5 | 1054 | INSTALLATION_SQL | schema or key definition for reopening request | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_reopening_request.sql` | 34 | 2501 | INSTALLATION_SQL | schema or key definition for reopening request | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_review_decision.key.sql` | 3 | 642 | INSTALLATION_SQL | schema or key definition for review decision | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_review_decision.sql` | 25 | 1705 | INSTALLATION_SQL | schema or key definition for review decision | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_revision_contributor.key.sql` | 2 | 432 | INSTALLATION_SQL | schema or key definition for revision contributor | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_revision_contributor.sql` | 13 | 592 | INSTALLATION_SQL | schema or key definition for revision contributor | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_user_role.key.sql` | 11 | 1325 | INSTALLATION_SQL | schema or key definition for user role | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/sql/llx_mjlfinancement_user_role.sql` | 17 | 652 | INSTALLATION_SQL | schema or key definition for user role | VERIFIED (full-file source inspection) |
| `custom/mjlfinancement/workflowactions.php` | 47 | 3365 | WEB_ENTRYPOINT | audit history entrypoint | VERIFIED (full-file source inspection) |
| `tests/contracts/container/dashboard_resilience_test.php` | 32 | 1765 | TEST_CONTRACT | dashboard_resilience_test verification/support | VERIFIED |
| `tests/contracts/navigation_registry_test.php` | 29 | 2217 | TEST_CONTRACT | navigation_registry_test verification/support | VERIFIED |
| `tests/contracts/page_header_test.php` | 48 | 2543 | TEST_CONTRACT | page_header_test verification/support | VERIFIED |
| `tests/contracts/project_form_security_test.php` | 79 | 5577 | TEST_CONTRACT | project_form_security_test verification/support | VERIFIED |
| `tests/contracts/table_presentation_test.php` | 61 | 3022 | TEST_CONTRACT | table_presentation_test verification/support | VERIFIED |
| `tests/e2e/activities-report.spec.js` | 157 | 17512 | TEST_E2E | activities report verification/support | VERIFIED (full-file source inspection) |
| `tests/e2e/activity-assignment.spec.js` | 292 | 21689 | TEST_E2E | activity assignment verification/support | VERIFIED (full-file source inspection) |
| `tests/e2e/activity-detail.spec.js` | 78 | 11778 | TEST_E2E | activity detail verification/support | VERIFIED (full-file source inspection) |
| `tests/e2e/activity-execution.spec.js` | 488 | 64532 | TEST_E2E | activity execution verification/support | VERIFIED (full-file source inspection) |
| `tests/e2e/activity-planning.spec.js` | 560 | 42955 | TEST_E2E | activity planning verification/support | VERIFIED (full-file source inspection) |
| `tests/e2e/audit-report.spec.js` | 68 | 12887 | TEST_E2E | audit report verification/support | VERIFIED (full-file source inspection) |
| `tests/e2e/auth-concurrency.spec.js` | 288 | 20123 | TEST_E2E | auth concurrency verification/support | VERIFIED (full-file source inspection) |
| `tests/e2e/authentication.spec.js` | 344 | 20688 | TEST_E2E | authentication verification/support | VERIFIED |
| `tests/e2e/document-containment.spec.js` | 110 | 5591 | TEST_E2E | document containment verification/support | VERIFIED |
| `tests/e2e/export-recovery.spec.js` | 109 | 13220 | TEST_E2E | export recovery verification/support | VERIFIED (full-file source inspection) |
| `tests/e2e/fixture-isolation.spec.js` | 279 | 16961 | TEST_E2E | fixture isolation verification/support | VERIFIED (full-file source inspection) |
| `tests/e2e/monitoring.spec.js` | 167 | 24405 | TEST_E2E | monitoring verification/support | VERIFIED (full-file source inspection) |
| `tests/e2e/operations-report.spec.js` | 117 | 16856 | TEST_E2E | operations report verification/support | VERIFIED (full-file source inspection) |
| `tests/e2e/partner-project.spec.js` | 316 | 21706 | TEST_E2E | partner project verification/support | VERIFIED (full-file source inspection) |
| `tests/e2e/planning-navigation.spec.js` | 129 | 12042 | TEST_E2E | planning navigation verification/support | VERIFIED (full-file source inspection) |
| `tests/e2e/portfolio-report.spec.js` | 68 | 11596 | TEST_E2E | portfolio report verification/support | VERIFIED (full-file source inspection) |
| `tests/e2e/reconciliation-restore.spec.js` | 120 | 9568 | TEST_E2E | reconciliation restore verification/support | VERIFIED (full-file source inspection) |
| `tests/e2e/reset-boundaries.spec.js` | 532 | 27678 | TEST_E2E | reset boundaries verification/support | VERIFIED (full-file source inspection) |
| `tests/e2e/timeline.spec.js` | 59 | 10017 | TEST_E2E | timeline verification/support | VERIFIED |
| `tests/e2e/vui-access-management.spec.js` | 155 | 8973 | TEST_E2E | vui access management verification/support | VERIFIED |
| `tests/e2e/vui-activities-list.spec.js` | 102 | 7116 | TEST_E2E | vui activities list verification/support | VERIFIED |
| `tests/e2e/vui-activity-planning.spec.js` | 112 | 7023 | TEST_E2E | vui activity planning verification/support | VERIFIED |
| `tests/e2e/vui-activity-workspace.spec.js` | 104 | 6044 | TEST_E2E | vui activity workspace verification/support | VERIFIED |
| `tests/e2e/vui-cross-screen-consistency.spec.js` | 131 | 6475 | TEST_E2E | vui cross screen consistency verification/support | VERIFIED |
| `tests/e2e/vui-exception-dialogs.spec.js` | 311 | 21169 | TEST_E2E | vui exception dialogs verification/support | VERIFIED |
| `tests/e2e/vui-foundations.browser.js` | 123 | 9373 | TEST_E2E | vui foundations.browser verification/support | VERIFIED |
| `tests/e2e/vui-history-exports.spec.js` | 109 | 6500 | TEST_E2E | vui history exports verification/support | VERIFIED |
| `tests/e2e/vui-operation-consultation.spec.js` | 151 | 9122 | TEST_E2E | vui operation consultation verification/support | VERIFIED |
| `tests/e2e/vui-reference-management.spec.js` | 153 | 8147 | TEST_E2E | vui reference management verification/support | VERIFIED |
| `tests/e2e/vui-review-workflow.spec.js` | 203 | 12900 | TEST_E2E | vui review workflow verification/support | VERIFIED |
| `tests/e2e/vui-role-dashboards.spec.js` | 156 | 9150 | TEST_E2E | vui role dashboards verification/support | VERIFIED |
| `tests/fixtures/activity-command-fixture.php` | 19 | 2566 | FIXTURE | activity command fixture verification/support | VERIFIED |
| `tests/fixtures/activity-command-worker.php` | 53 | 4996 | FIXTURE | activity command worker verification/support | VERIFIED |
| `tests/fixtures/activity-fixture.php` | 29 | 2784 | FIXTURE | activity fixture verification/support | VERIFIED |
| `tests/fixtures/auth-parallel-worker.php` | 60 | 3331 | FIXTURE | auth parallel worker verification/support | VERIFIED |
| `tests/fixtures/database-evidence.php` | 316 | 19931 | FIXTURE | database evidence verification/support | VERIFIED |
| `tests/fixtures/disposable-compose.override.yml` | 51 | 1459 | FIXTURE | disposable compose.override verification/support | VERIFIED |
| `tests/fixtures/disposable-fixture-preflight.php` | 37 | 1132 | FIXTURE | disposable fixture preflight verification/support | VERIFIED |
| `tests/fixtures/document-state-fixture.php` | 203 | 8412 | FIXTURE | document state fixture verification/support | VERIFIED |
| `tests/fixtures/execution-fixture.php` | 11 | 2130 | FIXTURE | execution fixture verification/support | VERIFIED |
| `tests/fixtures/export-integrity-probe.php` | 32 | 2409 | FIXTURE | export integrity probe verification/support | VERIFIED |
| `tests/fixtures/export-recovery-fixture.php` | 149 | 7492 | FIXTURE | export recovery fixture verification/support | VERIFIED |
| `tests/fixtures/reconciliation-fixture.php` | 37 | 1826 | FIXTURE | reconciliation fixture verification/support | VERIFIED |
| `tests/fixtures/report-fixture.php` | 67 | 5140 | FIXTURE | report fixture verification/support | VERIFIED |
| `tests/fixtures/user-reference-fixture.php` | 182 | 9644 | FIXTURE | user reference fixture verification/support | VERIFIED |
| `tests/helpers/activity-fixture.js` | 35 | 2526 | TEST_HELPER | activity fixture verification/support | VERIFIED |
| `tests/helpers/execution-fixture.js` | 32 | 2151 | TEST_HELPER | execution fixture verification/support | VERIFIED |
| `tests/helpers/mjl-test-runtime.js` | 65 | 2743 | TEST_HELPER | mjl test runtime verification/support | VERIFIED |
| `tests/helpers/playwright-global-setup.js` | 5 | 173 | TEST_HELPER | playwright global setup verification/support | VERIFIED |
| `tests/helpers/responsive-shell.js` | 29 | 973 | TEST_HELPER | responsive shell verification/support | VERIFIED |
| `tests/helpers/user-reference-fixture.js` | 164 | 7807 | TEST_HELPER | user reference fixture verification/support | VERIFIED |
| `tests/helpers/verify-disposable-environment.js` | 40 | 1772 | TEST_HELPER | verify disposable environment verification/support | VERIFIED |
| `tests/manual/accessibility-gate.spec.js` | 281 | 17996 | TEST | accessibility gate verification/support | VERIFIED |
| `tests/manual/playwright.config.js` | 16 | 437 | TEST | playwright.config verification/support | VERIFIED |
| `tests/runner/disposable-evidence.js` | 124 | 4732 | TEST_RUNNER | disposable evidence verification/support | VERIFIED |
| `tests/runner/disposable-policy.js` | 174 | 9139 | TEST_RUNNER | disposable policy verification/support | VERIFIED |
| `tests/runner/disposable-run.js` | 116 | 4205 | TEST_RUNNER | disposable run verification/support | VERIFIED |
| `tests/runner/run-suite.js` | 1120 | 81040 | TEST_RUNNER | run suite verification/support | VERIFIED |
| `tests/unit/access-audit-fail-closed.test.js` | 26 | 1198 | TEST_UNIT | access audit fail closed verification/support | VERIFIED |
| `tests/unit/audit-projection.test.js` | 10 | 3395 | TEST_UNIT | audit projection verification/support | VERIFIED |
| `tests/unit/dashboard-projection.test.js` | 41 | 5157 | TEST_UNIT | dashboard projection verification/support | VERIFIED |
| `tests/unit/design-system-v3.test.js` | 162 | 9013 | TEST_UNIT | design system v3 verification/support | VERIFIED |
| `tests/unit/disposable-evidence.test.js` | 46 | 2089 | TEST_UNIT | disposable evidence verification/support | VERIFIED |
| `tests/unit/disposable-fixture-request.test.js` | 160 | 8478 | TEST_UNIT | disposable fixture request verification/support | VERIFIED |
| `tests/unit/disposable-policy.test.js` | 178 | 7467 | TEST_UNIT | disposable policy verification/support | VERIFIED |
| `tests/unit/disposable-run.test.js` | 325 | 14383 | TEST_UNIT | disposable run verification/support | VERIFIED |
| `tests/unit/document-containment-boundaries.test.js` | 35 | 1684 | TEST_UNIT | document containment boundaries verification/support | VERIFIED |
| `tests/unit/execution-projection.test.js` | 65 | 4356 | TEST_UNIT | execution projection verification/support | VERIFIED |
| `tests/unit/export-spool.test.js` | 24 | 2311 | TEST_UNIT | export spool verification/support | VERIFIED |
| `tests/unit/mjl-financial-preview.test.js` | 36 | 1630 | TEST_UNIT | mjl financial preview verification/support | VERIFIED |
| `tests/unit/monitoring-reports.test.js` | 98 | 14176 | TEST_UNIT | monitoring reports verification/support | VERIFIED |
| `tests/unit/navigation-shell.test.js` | 35 | 2549 | TEST_UNIT | navigation shell verification/support | VERIFIED |
| `tests/unit/operational-script-boundary.test.js` | 54 | 1974 | TEST_UNIT | operational script boundary verification/support | VERIFIED |
| `tests/unit/report-format.test.js` | 49 | 4874 | TEST_UNIT | report format verification/support | VERIFIED |
| `tests/unit/timeline-presentation.test.js` | 69 | 5707 | TEST_UNIT | timeline presentation verification/support | VERIFIED |

## Reconciliation

- Application/runtime files: **157/157** classified and fully source-inspected across a final complete-file pass (20,535 lines). Earlier subsystem passes remain useful behavior evidence, but the final denominator no longer depends on overlapping assignments.
- Verification files: **80/80** classified and fully source-inspected, including all 31 E2E files. Test execution remains separately qualified in `13-regression-baseline.md`.
- Repository controls (`AGENTS.md`, `CONTEXT.md`, `DESIGN.md`, `README.md`, `docker-compose.yml`, `package.json`, `package-lock.json`, `playwright.config.js`) were inspected separately in the baseline and regression passes.
- Canonical product and design documents are evidence inputs, not executable application files. Their authority and conflicts are recorded in the topical reports.
- The six untracked files under `docs/inspiration/auth/` are user-owned visual references. They were fingerprinted as baseline inputs and not treated as executable source.
- Symbol/top-level coverage is individually inspectable in `annex-runtime-symbols.tsv` (84 files, 874 records) and `annex-supplemental-symbols.tsv` (73 files, 1,119 records). The complements have zero overlap.
