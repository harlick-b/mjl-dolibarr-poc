# Phase 12 Secure Document Download Compliance Report

## Scope

- Added guarded expense supporting-document downloads.
- Kept preview, activity documents, convention documents, and fund-receipt
  document management out of this batch.
- Preserved Dolibarr core boundaries; all source changes remain under
  `custom/mjlfinancement`.

## Design-System Rules Applied

- French-first expense detail action label: `Télécharger la pièce`.
- ECM remains the storage layer; MJL screens expose contextual document access.
- No public document route, no public registration, and no normal-user access
  to advanced/non-expense document records.
- E2E remains the primary validation method.

## Security Controls

- Download route requires `expense/read`, active entity match, linked
  `mjlfinancement_expense`, and the same expense visibility rules as the
  expense detail page.
- Non-expense ECM rows, orphan rows, cross-entity rows, and unauthorized
  expense rows are refused.
- Filesystem resolution rejects unsafe filenames, traversal paths, control
  characters, symlink escapes, missing files, and unreadable files through
  realpath containment under the ECM output directory.
- Downloads are forced as attachments; preview remains deferred.

## Modified Areas

- `custom/mjlfinancement/documentdownload.php`
- `custom/mjlfinancement/lib/mjl_document.lib.php`
- `custom/mjlfinancement/lib/mjl_expense_access.lib.php`
- `custom/mjlfinancement/expenses.php`
- `custom/mjlfinancement/css/mjl_app.css.php`
- `tests/e2e/phase11-expense-workflow.spec.js`
- Production readiness, deployment, feature coverage, and ongoing todo docs.

## Validation

- PHP syntax checks passed for the new route, new helpers, and `expenses.php`.
- Phase 11 E2E now covers successful uploaded-document and ECM-only downloads.
- Phase 11 E2E now covers direct forbidden attempts for unauthorized,
  cross-entity, non-expense, orphan, and poisoned-path ECM rows.

## Known Limitations

- No inline preview in this phase.
- No activity, convention, or fund-receipt document download workflow in this
  phase.
- Final production permission matrix is still pending.
