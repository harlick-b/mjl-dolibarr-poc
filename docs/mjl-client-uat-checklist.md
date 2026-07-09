# MJL Client UAT Checklist

Target decisions come from `docs/mjl-authoritative-decisions.md`. This
checklist prepares client validation of the current feature-aligned workspace.
It is not a production deployment sign-off.

Status: `PENDING_CLIENT_VALIDATION`.

## Use

For each row, the client or facilitator should record:

- Pass/Fail;
- Comment;
- any blocking decision or correction request.

## Checklist

| Role | Action | Expected result | Pass/Fail | Comment |
| --- | --- | --- | --- | --- |
| ADMIN_PLATEFORME | Send an invitation to a new user. | The user receives an invitation flow; no public registration is exposed. |  |  |
| Invited user | Accept the invitation and define a password. | The user can connect to the MJL workspace after token validation. |  |  |
| ADMIN_PLATEFORME | Assign one global business role and one or many Partenaires / Programmes. | Access follows the assigned role and scopes. |  |  |
| AGENT_SAISIE | Open the workspace with an assigned Partenaire / Programme. | Only assigned Partenaires / Programmes and related data are visible. |  |  |
| AGENT_SAISIE | Attempt to open unassigned Programme Redevabilite data. | Access is denied or returns no unassigned data. |  |  |
| ADMIN_PLATEFORME | Review all Partenaires / Programmes. | Admin can see all scoped portfolios and unresolved-data diagnostics. |  |  |
| VALIDATEUR_DEFINITIF | Create a project inside the MJL workspace. | Project is created without using native Dolibarr project screens. |  |  |
| ADMIN_PLATEFORME | Edit an MJL project inside the workspace. | Project changes are saved and audited. |  |  |
| AGENT_SAISIE | Attempt to create or edit a project. | The action is not available or is rejected server-side. |  |  |
| VALIDATEUR_DEFINITIF | Create a funding envelope for UNICEF. | Envelope is linked to the correct Partenaire / Programme and entity. |  |  |
| VALIDATEUR_DEFINITIF | Record funds received with proof. | Receipt is saved, scoped, and available in finance reports. |  |  |
| VALIDATEUR_DEFINITIF | Allocate a budget line to a project. | Budget is linked to the project and funding envelope. |  |  |
| AGENT_SAISIE | Create an activity for an assigned project. | Activity is saved with planned dates, responsible user, and budget context. |  |  |
| AGENT_SAISIE | Submit the activity for review. | Activity enters the prevalidation queue. |  |  |
| AGENT_VERIFICATEUR | Prevalidate the submitted activity. | Activity moves to final-validation queue; self-prevalidation is blocked. |  |  |
| VALIDATEUR_DEFINITIF | Validate the activity definitively. | Activity is final validated; final validation remains distinct from disbursement. |  |  |
| AGENT_SAISIE | Update physical execution. | Execution rate and actual dates are saved with valid percentage constraints. |  |  |
| AGENT_SAISIE | Create an expense with a justificatif. | Expense is linked to project, budget, optional activity, and guarded document. |  |  |
| AGENT_SAISIE | Submit the expense. | Expense enters the prevalidation queue. |  |  |
| AGENT_VERIFICATEUR | Prevalidate the expense. | Expense moves to final-validation queue; self-prevalidation is blocked. |  |  |
| VALIDATEUR_DEFINITIF | Validate the expense definitively. | Business approval is recorded; no disbursement is implied. |  |  |
| VALIDATEUR_DEFINITIF | Mark the expense as decaisse. | Disbursement is recorded only after final validation and not by the creator when forbidden. |  |  |
| AGENT_SAISIE | Open the global Documents page. | The page is read-only; no global upload is exposed. |  |  |
| Any authorized user | Download a supporting document. | Download uses the guarded MJL route, not a raw public ECM link. |  |  |
| Any authorized user | Add a contextual comment on an accessible object. | Comment appears in the object timeline and is scoped to that object. |  |  |
| Any authorized user | Review object timeline/history. | Decisions, document events, comments, and audit entries are visible where available. |  |  |
| AGENT_VERIFICATEUR | Review alerts. | Pending review, correction, document, and deadline alerts match assigned scope. |  |  |
| VALIDATEUR_DEFINITIF | Review dashboard queues. | Final-validation and disbursement queues show scoped business work. |  |  |
| ADMIN_PLATEFORME | Review platform dashboard diagnostics. | Admin-only unresolved-data indicator is visible; non-admin users do not see it. |  |  |
| Authorized export user | Export a CSV report. | CSV has UTF-8 BOM, semicolon separator, French headers, stable filename, and scoped rows. |  |  |
| Authorized export user | Export an XLSX report. | XLSX generation works and respects the same server-side filters. |  |  |
| Unauthorized user | Attempt report export. | Export is denied server-side. |  |  |
| ADMIN_PLATEFORME | Review audit evidence. | Workflow, document, exchange, and export traces are available without exposing unassigned scope. |  |  |

## Acceptance Boundary

Feature alignment can be accepted as `FEATURE_ALIGNED_PENDING_CLIENT_VALIDATION`
when all in-scope UAT rows pass or have documented non-blocking comments, and
the only remaining blockers are final client approval of permissions/report
templates or production deployment configuration.
