# MJL Roles And Permissions Matrix

Target decisions come from `docs/mjl-authoritative-decisions.md`.

Status: `PENDING_CLIENT_VALIDATION`.

This matrix records the current production role model for UAT. It is not final
client approval of permissions.

## Role Model

- Each user has one global business role.
- Each user can be assigned to one or many Partenaires / Programmes.
- Non-admin users access only assigned scopes.
- Admin sees all.
- Unresolved scope fails closed for non-admin users.

## Matrix

| Capability | AGENT_SAISIE | AGENT_VERIFICATEUR | VALIDATEUR_DEFINITIF | ADMIN_PLATEFORME |
| --- | --- | --- | --- | --- |
| Access assigned MJL workspace | Yes | Yes | Yes | Yes |
| See all Partenaires / Programmes | No | No | No unless also unrestricted by platform rights | Yes |
| Manage invitations and access | No | No | No | Yes |
| Assign roles and Partenaires / Programmes | No | No | No | Yes |
| Create/edit MJL projects | No | No | Yes | Yes |
| View assigned projects | Yes | Yes | Yes | Yes |
| Create activities | Yes | No | No | No |
| Submit activities | Yes | No | No | No |
| Correct returned activities | Yes | No | No | No |
| Prevalidate activities | No | Yes | No | No |
| Final-validate activities | No | No | Yes | No |
| Update physical execution | Yes | No | No | No |
| Create expenses | Yes | No | No | No |
| Submit expenses | Yes | No | No | No |
| Upload contextual justificatifs | Yes | No | No | No |
| Prevalidate expenses | No | Yes | No | No |
| Final-validate expenses | No | No | Yes | No |
| Mark expenses as decaisse | No | No | Yes | No |
| Create funding envelopes | No | No | Yes | Yes |
| Record funds received | No | No | Yes | Yes |
| Allocate budget lines | No | No | Yes | Yes |
| View global Documents library | Scoped read-only | Scoped read-only | Scoped read-only | All read-only |
| Download guarded documents | Scoped | Scoped | Scoped | All |
| Add contextual comments | Scoped, if write right exists | Scoped, if write right exists | Scoped, if write right exists | All, if write right exists |
| View alerts | Scoped operational alerts | Scoped review alerts | Scoped decision alerts | Platform diagnostics |
| View dashboards | Role dashboard | Review dashboard | Business supervision dashboard | Platform/admin diagnostics |
| Export reports | If explicit export right exists | If explicit export right exists | Yes where granted | Yes |
| View advanced audit/search | No by default | No by default | Supervision/audit where granted | Yes |

## Mandatory Workflow Constraints

- No self-prevalidation.
- No self-final-validation.
- No self-disbursement.
- Final validation and disbursement remain separate states.
- UI hiding is not access control; direct URL and POST guards must enforce the
  same matrix.

## Client Decisions Still Needed

- Final route/action permission approval.
- Whether any non-admin role should receive broader export rights.
- Whether any advanced audit screens should be available to business users.
- Final wording for permissions in training and operational materials.
