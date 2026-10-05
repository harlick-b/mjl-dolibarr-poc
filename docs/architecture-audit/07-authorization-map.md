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

## Gaps

All principal policy families were traced, but the 281 textual auth/input/redirect sites were not converted into a complete path-by-path denominator. The authorization gate is therefore `FAIL`, despite strong coverage of the critical role and workflow paths.
