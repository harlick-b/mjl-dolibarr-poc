# MJL Financement — Product Model

Status: `READY_WITH_ASSUMPTIONS`

## Classification legend

- `context-confirmed`: confirmed target requirement.
- `context-reported`: reported current implementation, not independently verified.
- `proposed`: generated design representation.
- `assumed`: conservative default pending confirmation.
- `unknown`: unresolved without a safe product conclusion.

## Actors

| Actor | Classification | Purpose | Restricted actions |
| --- | --- | --- | --- |
| `AGENT_SAISIE` | context-confirmed | Create, correct, submit, document, and follow scoped work | Cannot prevalidate, finally validate, or disburse own work |
| `AGENT_VERIFICATEUR` | context-confirmed | Independently review, return, invalidate where allowed, and prevalidate | Cannot self-review or make final/disbursement decisions |
| `VALIDATEUR_DEFINITIF` | context-confirmed | Final decisions, finance supervision, project editing, separate disbursement | Cannot self-final-validate or self-disburse |
| `ADMIN_PLATEFORME` | context-confirmed | Access, invitation, role, scope, configuration, and diagnostics | Administration does not imply business-validation authority |
| Dedicated read-only audit overlay | unknown | Possible future capability, distinct from generic internal `readonly` behavior and legacy `LECTEUR` fixtures | No fifth production role, capability, or navigation may be inferred |

## Objects and relationships

- Partenaire / Programme scopes projects and non-admin access (`context-confirmed`).
- Project contains activities and financing context (`context-confirmed`).
- Convention represents a funding envelope; target user wording is “Enveloppe de financement” pending final approval (`proposed`).
- Activity belongs to project/convention context (`context-confirmed`).
- Expense belongs to project/convention context and may reference an activity and budget line (`context-confirmed`).
- Budget line and fund receipt represent financing structure; a valid global receipt may lack a project (`context-confirmed`).
- Document and exchange attach to an accessible parent object (`context-confirmed`).
- Validation, workflow action, alert, report/export, and history make decisions and system events visible (`context-confirmed`/`context-reported`).

## State model

Business states are limited to those named by context: draft, submitted, correction requested/corrected, prevalidated, final validated, rejected/invalidation where applicable, completed/cancelled where applicable, and disbursed for eligible expenses.

Invitation/account states are separate: non envoyée, envoyée, acceptée, expirée, révoquée, renvoyée, échec d’envoi, invalid token, expired token, session expired, suspended, and disabled.

Permission and system states are not business statuses. Available, unavailable prerequisite, forbidden/not-found, loading, empty, filtered-empty, partial error, failure, and unavailable service remain separate representations.

## Actions and constraints

- Draft saving may accept incomplete data where business rules permit.
- Submission and decisions enforce action-specific completeness.
- Return/rejection carries a reason and audit event.
- Final/irreversible decisions require consequence-aware confirmation.
- All reads/writes remain entity-, scope-, role-, capability-, token-, and relationship-guarded.
- UI visibility never replaces route/POST enforcement.
- No approved budget-line closure/deactivation transition exists.
- Product-wide search, bulk mutation/upload, asynchronous export, notification-center, and user-facing document-deletion capabilities are absent from the current scope, not permanently prohibited. Scoped audit/search under Supervision remains permitted.
- Inline document preview/removal and a dedicated read-only audit overlay remain unapproved.

## Information architecture

Primary areas: Tableau de bord, Partenaires / Programmes, Projets, Activités, Dépenses, Documents, Financement, Supervision, Administration. Object pages provide contextual links to related records, evidence, alerts, and history. Global Documents is read-only; upload remains contextual. Reports live under Supervision.

## Documents, reports, alerts, and history

Documents use guarded MJL routes and never reveal ECM paths. Reports use synchronous POST actions and are scoped CSV/XLSX with BOM, semicolon separator, French headers, stable filenames, token protection, and audit. Report canevas details and role-by-report rights remain pending. Alerts cover deadlines, missing evidence, pending validation, budget risk, and validated-undisbursed expenses. History presents actors, reasons, dates, status changes, documents, and important value changes.

## Interface versus authorization

This model describes representation only. It does not define the final route/action matrix, report permissions, audit-retention policy, or backend authorization. Those remain server-controlled and client-pending.
