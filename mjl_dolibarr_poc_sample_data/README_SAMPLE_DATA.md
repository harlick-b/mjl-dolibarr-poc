# MJL Sample Data Pack

This package is local development/test fixture data only. Production decisions
come from `../docs/mjl-authoritative-decisions.md`.

Do not load these CSVs into a production tenant.

## Fixture Purpose

The fixture set exercises:

- Partenaires / Programmes;
- projects;
- conventions/funding envelopes;
- activities;
- budget lines;
- fund receipts;
- expenses;
- supporting documents;
- validation/correction traces;
- fixed reports;
- role-based access.

Some filenames, rows, and fixture roles preserve legacy vocabulary so migration
and compatibility paths can be tested. That legacy wording is not production
terminology.

## Import Order

1. `roles_permissions.csv`
2. `users.csv`
3. `ptfs_bailleurs.csv`
4. `projects.csv`
5. `conventions.csv`
6. `activities.csv`
7. `budget_lines.csv`
8. `supporting_documents.csv`
9. `fund_receipts.csv`
10. `expenses.csv`
11. `validation_events.csv`
12. `fixed_reports.csv`

## Object Mapping

| MJL concept | Dolibarr reuse or MJL custom module |
| --- | --- |
| Partenaire / Programme | Dolibarr Third Party |
| Project | Dolibarr Project |
| Convention / funding envelope | `MjlConvention` |
| Activity | `MjlActivity` |
| Budget line | `MjlBudgetLine` |
| Fund receipt | `MjlFundReceipt` |
| Expense | `MjlExpense` |
| Supporting document | Dolibarr Documents / ECM |
| Validation trace | `MjlValidation` |
| Fixed report | MJL report/export inside `mjlfinancement` |

## Local Fixture Rule

Do not modify Dolibarr core files. All MJL-specific code must stay in the
custom module:

```text
/custom/mjlfinancement
```

## Edge Cases Included

- `EXP-JE-003`: rejected because the amount exceeds the available budget line.
- `EXP-JE-004`: corrected expense after an initial issue.
- `EXP-JE-005`: draft expense with missing supporting document.
- `PRJ-EXT-2026`: draft extension project with no funds received yet.
- `LECTEUR`: legacy read-only fixture user.

## Suggested First Workflow To Test

```text
Partenaire / Programme -> Project -> Convention -> Activity -> Budget Line -> Expense -> Document -> Validation -> Report
```

Recommended first chain:

```text
PTF-UNICEF
PRJ-JE-2026
CONV-UNICEF-2026-001
ACT-JE-001
BL-JE-001
EXP-JE-001
DOC-EXP-JE-001
VAL-001
RPT-001
```
