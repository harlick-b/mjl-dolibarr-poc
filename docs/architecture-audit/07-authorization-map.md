# Authorization and permission map

| Resource/action | Agent | Supervisor | Validator | Admin | Enforcement |
| --- | --- | --- | --- | --- | --- |
| enter MJL workspace | active assigned/business access | yes | yes | technical dashboard | navigation policy + route guards |
| references read | same entity | same entity | same entity | technical access only where explicitly allowed | effective role + entity |
| reference mutation | no | no | yes | no business mutation | direct route + locked reference command |
| Activity/Operation read | current Activity assignment | all same-entity | all same-entity | denied business views | access projection + direct route |
| Activity structure/submit | currently assigned, eligible state/time | no | no | no | route eligibility + locked aggregate |
| assign Agents | no | no | Validator | no | role, entity, target active role, transaction locks |
| prevalidate/return | no | Supervisor, exact revision, not contributor | no | no | aggregate identity checks |
| final validate/return | no | no | Validator, exact prevalidated revision, not contributor/prevalidator | no | aggregate identity checks |
| execution mutation/request exception | assigned Agent | read | decision/read | denied | assignment/state/version guards |
| audit read/export | no | no | yes | yes | report-specific route policy |
| invitations/access lifecycle | no | no | no | native Admin only | direct route + scope/auth command |
| documents/native workspace | denied | denied | denied | limited native technical administration; ECM denied | Apache + dependency-free 403 routes |

## Effective role

The effective role is recomputed from persisted state. An active native Admin maps to `ADMIN_PLATEFORME`; non-admin users require exactly one active same-entity MJL role. Native Admin cannot simultaneously carry an active business role and is rejected by business aggregate mutations.

## Defense in depth

- Presentation eligibility and menus are usability projections.
- Routes independently guard direct URL and POST access and validate CSRF/submission context.
- Command modules reauthorize after row locks using current entity, role, assignment, state, revision and version.
- Database triggers/constraints protect role exclusivity, immutable evidence and unique live states.

These repetitions are D4 intentional security duplication. Consolidation must not reduce the number of trust boundaries.

## Gate qualification

All principal policy families were traced. Critical role, assignment,
no-self-validation, entity, direct-route and database-guard paths are mapped;
the focused auth and Phase 3A suites exercise the touched runtime paths and
fail closed on forbidden requests and invalid direct mutations. The 281
textual auth/input/redirect sites were not converted into a claim of universal
dynamic execution, so the authorization gate is `PASS WITH QUALIFICATION`.

Invitation acceptance and native reset mutations still use POST forms, CSRF
tokens and authorization/state guards without an explicit custom POST-only
check. The custom seams and resulting risk are located and classified as
BC-017; exact native dispatcher method handling remains a medium follow-up.
Because
the existing security checks fail closed without the request token and the
smallest correction remains local to the current route/hook seams, it is a
medium route-hardening concern rather than an unresolved architecture boundary.
