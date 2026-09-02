# MJL Permission Matrix v2

## Effective Roles

| Internal code | User-facing label | Meaning |
| --- | --- | --- |
| `AGENT_SAISIE` | Agent de saisie | Assigned Activity creation, correction, submission, and execution |
| `AGENT_VERIFICATEUR` | Agent superviseur et prévalidateur | Independent review and prévalidation |
| `VALIDATEUR_DEFINITIF` | Validateur définitif | Business superuser and final decision-maker |
| `ADMIN_PLATEFORME` | Admin | Technical administration, audit, and controlled recovery |

Each user has one effective role. Native Dolibarr admin status implies
`ADMIN_PLATEFORME`. A native admin cannot have an active Agent, Supervisor, or
Validator role. Native status must not grant business workflow actions.

The clean local reset preserves exactly one native technical administrator
account. It does not migrate any existing sample business-role assignment.
Later target users receive roles only through the implemented invitation and
account-administration lifecycle.

## Visibility

| Resource | Agent | Supervisor | Validator | Admin |
| --- | --- | --- | --- | --- |
| Active Partner/Project reference data | Read for Activity creation | Read | Read all | Technical diagnostics only |
| Activity and Opérations | Current assignment only | Read all | Read all | Audit or controlled recovery only |
| Current workflow messages | Assigned Activity | Read all | Read all | Complete audit |
| Complete audit | No | No | Yes | Yes |
| Technical access administration | No | No | No | Yes |
| Current supporting documents | Assigned Activity context | Read all in active entity | Read all in active entity | Read-only in active entity |
| Historical/withdrawn document versions | No | No | Active-entity reasoned recovery | Active-entity reasoned recovery |

Partner assignment is not an authorization model. The current
`mjlfinancement_user_soc_scope` behavior is obsolete target behavior.

## Actions

| Action | Agent | Supervisor | Validator | Admin |
| --- | --- | --- | --- | --- |
| Create Activity | Yes | No | No | No |
| Abandon unsubmitted assigned draft | Yes, reason required | No | No | No |
| Restore abandoned draft | No | No | Yes, before start and with selected primary Agent | No |
| Edit authorized Activity structure | If currently assigned | No | No direct edit | No |
| Add/edit/remove draft Opérations | If currently assigned and structurally editable | No | No | No |
| Submit or resubmit revision | If currently assigned | No | No | No |
| Prevalidate revision | No | Yes, subject to separation of duties | No | No |
| Return submitted revision for correction | No | Yes, reason required | No | No |
| Definitively validate | No | No | Yes, same prevalidated revision | No |
| Return prevalidated revision for correction | No | No | Yes, reason required | No |
| Manage Partner/Project/Opération types | No | No | Yes | Technical import support only |
| Add/remove/transfer Activity assignments | No | No | Yes | No |
| Enter Opération execution data | If currently assigned | No | No | No |
| Request or withdraw cancellation/reopening | If currently assigned | No | No | No |
| Decide cancellation/reopening | No | No | Yes | No |
| Export complete audit | No | No | Yes | Yes |
| Invite and activate/deactivate users | No | No | No | Yes |
| Change effective role | No | No | No | Yes, assignment guard applies |
| Controlled technical recovery | No | No | No | Yes, audited |
| Upload document evidence | Assigned Activity/Opération | No | Yes | No |
| Append a new document version | Assigned Activity/Opération | No | Yes, except replacement of Agent evidence | No |
| Withdraw current document version | Assigned Activity/Opération, reason required | No | Yes, except Agent evidence | No |
| Manage document categories | No | No | Yes | Technical import support only |
| Browse scoped document library | Assigned Activity scope | Read all in active entity | Read all in active entity | Read current documents in active entity only |
| Recover historical document version | No | No | Yes, reason required and separately audited | Yes, reason required and separately audited |

## Separation of Duties

For one business revision:

- its creator or structural contributor cannot prevalidate it;
- its creator or structural contributor cannot definitively validate it;
- its prevalidator cannot definitively validate it;
- later role changes do not remove these restrictions.
- every uploader of a qualifying document version in the revision is a
  revision contributor and cannot review that revision;
- the Validator cannot replace or withdraw evidence uploaded by an Agent.

## Assignment Rules

- The creator becomes the primary Agent automatically.
- Primary assignment is coordination metadata, not exclusive permission.
- Every current Agent assignment grants the same authorized edit and submit rights.
- Only the Validator changes ordinary assignments. Creator-primary insertion,
  Agent abandonment, and Validator restoration are the closed exceptions.
- Removing an Agent revokes read and write access immediately, including open-form saves.
- Historical assignments and actions remain in audit.
- An Agent cannot change role while current assignments remain.

## Enforcement

Every route, direct URL, form render, POST, export, and background action must
enforce the matrix server-side with active Dolibarr entity filtering. UI
hiding is not authorization. Stale actions fail without changing data.

For this matrix, active entity means the runtime active Dolibarr entity
`$conf->entity`, never the entity stored on the administrator's user row.
Cross-entity identifiers are denied for every role, including Admin. Permitted
platform entity switching changes the active scope and never authorizes
cross-entity aggregation. The Phase 4 Admin exception is read-only metadata,
guarded download/preview of current documents, and reasoned separately audited
historical recovery. Admin may not upload, append, replace, withdraw,
categorize, review, validate, or use raw/native ECM delivery.
