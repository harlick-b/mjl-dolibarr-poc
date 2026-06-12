# Prompt for AI Agent — Use the Sample Data

You are working on the MJL Dolibarr POC repository.

Goal:
Use the sample data in `/seed` to test whether Dolibarr can support the MJL project-financing accounting workflow.

Rules:

- Do not modify Dolibarr core files.
- Use or create the custom module `/custom/mjlfinancement`.
- Reuse Dolibarr core objects where relevant:
  - Third Parties for PTF / bailleurs
  - Projects for MJL projects
  - Documents / ECM for supporting documents
  - Users and groups for roles and permissions
- Create custom objects only for MJL-specific entities:
  - MjlConvention
  - MjlActivity
  - MjlBudgetLine
  - MjlFundReceipt
  - MjlExpense
  - MjlValidation
  - MjlReport
- Keep user-facing labels in French.
- Keep currency as XOF / FCFA.
- Before implementation, produce a plan explaining:
  1. which CSV files will be used,
  2. how each object maps to Dolibarr,
  3. what will be created manually vs scripted,
  4. what acceptance tests will prove the POC.

Acceptance tests:

- Create a full chain PTF → Project → Convention → Activity → Budget Line → Expense → Document → Validation → Report.
- Show funds received by convention.
- Show budget execution by convention.
- Enforce role-based access.
- Ensure read-only user cannot modify financial data.
- Ensure no core Dolibarr file is modified.
