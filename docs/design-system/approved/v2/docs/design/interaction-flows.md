# MJL Financement — Interaction Flows

Status: `READY_WITH_ASSUMPTIONS`

## Activity lifecycle

- **Actors:** Agent de saisie, Vérificateur, Validateur définitif.
- **Entry/preconditions:** scoped activity list/detail; authenticated, active entity, assigned programme, server capability.
- **Main path:** create/save draft → complete execution/evidence → submit → independent prevalidation → final validation.
- **Alternates:** return with required reason → correct/resubmit; reject/invalidate/cancel/complete only where permitted.
- **Validation/errors:** action-specific completeness; preserve input; page summary plus field errors; do not disclose inaccessible records.
- **Permission failure:** non-disclosing forbidden/not-found state with safe return.
- **Confirmation/success:** explain consequence; show new status, next action, and updated timeline.
- **History:** actor, reason, date, documents, decisions, and important changed values.

## Expense validation and disbursement

- **Actors:** Agent de saisie, Vérificateur, Validateur définitif.
- **Entry/preconditions:** scoped expense context, financing/budget relationship, required evidence.
- **Main path:** draft → evidence → submit → prevalidate → final validate → separately record disbursement.
- **Alternates:** correction/resubmission, rejection, invalidation where allowed.
- **Decision point:** final validation confirms business approval but never implies funds moved.
- **Restrictions:** no self-prevalidation, self-final-validation, self-disbursement, or override.
- **Success/history:** show final-validated and disbursed amounts/events separately with actors and dates.

## Project and financing management

- **Actors:** Admin plateforme or Validateur définitif; other roles read only if final capability permits.
- **Entry/preconditions:** project/Financement area, active entity, resolvable scope, server capability.
- **Main path:** create/edit project → manage eligible envelope, budget line, or receipt in context.
- **Alternate:** valid global receipt without project is visibly distinct from unresolved/broken data.
- **Failure:** unresolved scope fails closed to Admin-only access.
- **Constraint:** no closure/deactivation lifecycle is invented.

## Contextual document and exchange

- **Actors:** any role with parent-object access and relevant capability.
- **Main path:** open accessible object → upload evidence or add note → view guarded document/timeline → retrieve through MJL route.
- **Alternates:** missing, removed, unavailable, or forbidden use distinct safe states.
- **Validation:** file/object rules remain server-side; never expose ECM/filesystem paths or inaccessible object existence.
- **History:** actor and timestamp; workflow correction reasons remain structured events, not replaced by comments.

## Report and export

- **Actors:** role with approved report visibility and export-write capability.
- **Main path:** choose report → scope/period/filters → CSV/XLSX → review filename/selection → POST/token generation → download.
- **Alternates:** change/reset filters or retry failure.
- **Validation/failure:** server-side scope-aware filters; no partial or cross-scope output.
- **History:** every generated export is auditable.
- **Unknown:** final role-by-report rights and official canevas remain pending.

## Invitation, login, and recovery

- **Actors:** Admin plateforme and invited user.
- **Main path:** Admin sends invitation → user opens valid token → defines password → reaches scoped workspace.
- **Alternates:** invalid, expired, revoked, accepted, resent, delivery failure, forgotten/reset password, session expiry, suspended/disabled account.
- **Validation:** token, CSRF, password, account, and expiry checks remain server-side.
- **Errors:** calm non-enumerating language and safe next step; no public registration.
- **Success/history:** clear confirmation; invitation and important account events logged where relevant.

## Shared state behavior

All flows preserve the shell during local loading/failure, distinguish initial empty from filtered empty, retain unrelated available content during partial errors, restore focus after dialogs/drawers, and announce consequential status changes. Offline behavior is not provided.
