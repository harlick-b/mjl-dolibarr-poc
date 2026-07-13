# MJL Client Decision Log

This log is prepared for real client validation. No client approval is recorded
until actual feedback is provided.

## Decision status values

- APPROVED
- APPROVED_WITH_CHANGES
- TO_REVIEW
- REJECTED
- DEFERRED

## Decision categories

- Permissions
- Workflow
- Partenaires / Programmes
- Projects
- Activities
- Physical execution
- Funding
- Budget
- Expenses / Decaissements
- Documents
- Timeline / Historique
- Alerts
- Dashboards / KPI
- Reports / Exports
- Audit
- Production preparation

## Decisions

| ID | Category | Decision item | Current proposal | Client feedback | Status | Owner | Impact | Follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DEC-001 | Permissions | Permission matrix | Use the current role/action matrix in `docs/mjl-roles-permissions-matrix.md`. | Not recorded; client validation not run. | TO_REVIEW | Client / MJL | Final permissions remain pending. | Validate role/action access during client session. |
| DEC-002 | Permissions | Role names | Use `AGENT_SAISIE`, `AGENT_VERIFICATEUR`, `VALIDATEUR_DEFINITIF`, and `ADMIN_PLATEFORME` with French labels. | Not recorded; client validation not run. | TO_REVIEW | Client / MJL | Training and permissions wording pending. | Confirm labels and training wording. |
| DEC-003 | Partenaires / Programmes | Scope by Partenaires / Programmes | One global business role per user plus one or many assigned Partenaires / Programmes. | Not recorded; client validation not run. | TO_REVIEW | Client / MJL | Access model pending client approval. | Demonstrate UNICEF and Programme Redevabilite isolation. |
| DEC-004 | Projects | Project creation by Admin / Validateur definitif | Only `ADMIN_PLATEFORME` and `VALIDATEUR_DEFINITIF` create/edit MJL projects. | Not recorded; client validation not run. | TO_REVIEW | Client / MJL | Project governance pending approval. | Validate create/edit expectations. |
| DEC-005 | Workflow | Activity workflow labels | Agent creates/submits, verifier prevalidates, final validator validates definitively. | Not recorded; client validation not run. | TO_REVIEW | Client / MJL | Workflow wording pending. | Confirm labels and rejection/correction language. |
| DEC-006 | Expenses / Decaissements | Expense / Decaissement workflow labels | Expense final validation and disbursement are separate states. | Not recorded; client validation not run. | TO_REVIEW | Client / MJL | Finance workflow wording pending. | Confirm `Valide definitivement` versus `Decaisse`. |
| DEC-007 | Workflow | Valide definitivement vs Decaisse | Business approval does not imply money moved. | Not recorded; client validation not run. | TO_REVIEW | Client / MJL | Critical finance rule pending approval. | Validate with client finance owners. |
| DEC-008 | Physical execution | Physical execution formula | Track percentage and actual dates for activity execution. | Not recorded; client validation not run. | TO_REVIEW | Client / MJL | KPI wording pending. | Confirm formula wording and thresholds. |
| DEC-009 | Funding | Financial execution formula | Compare allocated, submitted, prevalidated, final validated, disbursed, remaining, validation rate, and execution rate. | Not recorded; client validation not run. | TO_REVIEW | Client / MJL | Dashboard/report calculations pending approval. | Confirm formulas against client monitoring practice. |
| DEC-010 | Dashboards / KPI | Dashboard KPI labels | Use current Phase 10R KPI families and role dashboards. | Not recorded; client validation not run. | TO_REVIEW | Client / MJL | Dashboard wording pending. | Confirm labels, exposure, and training wording. |
| DEC-011 | Alerts | Alert thresholds | Use current computed alert defaults until client validates thresholds. | Not recorded; client validation not run. | TO_REVIEW | Client / MJL | Alert noise/risk language pending. | Confirm threshold values and severity labels. |
| DEC-012 | Reports / Exports | Report/export list | Use current CSV/XLSX report inventory. | Not recorded; client validation not run. | TO_REVIEW | Client / MJL | Official report list pending. | Validate required report set. |
| DEC-013 | Reports / Exports | Report/export columns | Use current French-labeled columns as validation baseline. | Not recorded; client validation not run. | TO_REVIEW | Client / MJL | Official canevas pending. | Confirm columns, order, and wording. |
| DEC-014 | Timeline / Historique | Timeline / Historique behavior | Show workflow decisions, contextual comments, document events, and audit traces inside object detail pages and audit/supervision views. | Not recorded; client validation not run. | TO_REVIEW | Client / MJL | Traceability presentation pending. | Confirm expected history wording. |
| DEC-015 | Documents | Global Documents read-only | Keep global Documents page read-only; uploads remain contextual. | Not recorded; client validation not run. | TO_REVIEW | Client / MJL | Document workflow pending approval. | Demonstrate contextual uploads and guarded downloads. |
| DEC-016 | Documents | Contextual uploads | Upload justificatifs in the relevant activity, expense, funding, or convention context. | Not recorded; client validation not run. | TO_REVIEW | Client / MJL | Document controls pending approval. | Validate upload points. |
| DEC-017 | Reports / Exports | CSV/XLSX only for current phase | No PDF or Word reports in this phase. | Not recorded; client validation not run. | TO_REVIEW | Client / MJL | Output scope pending approval. | Confirm PDF/Word remains deferred. |
| DEC-018 | Production preparation | Production SMTP deferred | Production email transport is outside client feature validation. | Not recorded; client validation not run. | DEFERRED | Deployment owner | Production release blocker remains. | Resolve during production readiness closure. |
| DEC-019 | Production preparation | Public URL/base URL deferred | Public/base URL is outside client feature validation. | Not recorded; client validation not run. | DEFERRED | Deployment owner | Production release blocker remains. | Resolve during production readiness closure. |
| DEC-020 | Production preparation | Backup/restore deferred | Backup/restore procedure is outside client feature validation. | Not recorded; client validation not run. | DEFERRED | Deployment owner | Production release blocker remains. | Resolve during production readiness closure. |
| DEC-021 | Production preparation | Monitoring/log retention deferred | Monitoring/log retention is outside client feature validation. | Not recorded; client validation not run. | DEFERRED | Deployment owner | Production release blocker remains. | Resolve during production readiness closure. |
