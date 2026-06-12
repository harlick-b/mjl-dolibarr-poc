# MJL Dolibarr POC — Sample Data Pack

This sample data pack is designed for a Dolibarr POC for the Ministry of Justice and Legislation (MJL) project-financing accounting tool.

The POC objective is to verify whether Dolibarr can support a web MVP for:

- PTF / bailleurs
- projects
- conventions
- activities
- budget lines
- funds received
- expenses
- supporting documents
- validation / correction trace
- fixed reports
- role-based access

The sample data intentionally includes normal cases and edge cases.

## Import / manual creation order

Use this order when entering the data manually in Dolibarr or when asking an AI agent to create import scripts:

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

## Object mapping assumption

| MJL concept         | Dolibarr reuse or custom module                          |
| ------------------- | -------------------------------------------------------- |
| PTF / bailleur      | Dolibarr Third Party                                     |
| Project             | Dolibarr Project                                         |
| Convention          | Custom object: `MjlConvention`                           |
| Activity            | Custom object: `MjlActivity`                             |
| Budget line         | Custom object: `MjlBudgetLine`                           |
| Fund receipt        | Custom object: `MjlFundReceipt`                          |
| Expense             | Custom object: `MjlExpense`, or adapted expense workflow |
| Supporting document | Dolibarr Documents / ECM                                 |
| Validation trace    | Custom object: `MjlValidation`                           |
| Fixed report        | Custom export/report inside `mjlfinancement` module      |

## Important POC rule

Do not modify Dolibarr core files.  
All MJL-specific code must stay in the custom module, for example:

```txt
/custom/mjlfinancement
```

## Edge cases included

- `EXP-JE-003`: rejected because the amount exceeds the available budget line.
- `EXP-JE-004`: corrected expense after an initial issue.
- `EXP-JE-005`: draft expense with missing supporting document.
- `PRJ-EXT-2026`: draft extension project with no funds received yet.
- `LECTEUR`: read-only user who should not be able to modify financial data.

## Suggested first workflow to test

Start with:

```txt
PTF → Project → Convention → Activity → Budget Line → Expense → Document → Validation → Report
```

Recommended first chain:

```txt
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
