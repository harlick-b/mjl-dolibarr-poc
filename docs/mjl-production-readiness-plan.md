# MJL Core Integration and Release Readiness

Authority comes from `docs/mjl-authoritative-decisions.md`. Phase 3C evaluates
the implemented core through RST-012 for integration. It does not authorize a
production launch.

## Two readiness boundaries

`npm run audit:production-readiness` runs a read-only CLI diagnostic in a
disposable tenant. It reports each observed control as `OK`, `UNKNOWN`, or
`BLOCKED`. It never emits the Phase 3C integration verdict and never converts a
missing client decision into a pass.

Integration readiness is decided only after the complete committed-source gate
matrix. Schema, authorization, entity isolation, data integrity, reconciler,
restore, security, performance, errors, and teardown evidence are blocking.
Final public URL, mail delivery, infrastructure custody, production logging and
the signed human accessibility review are release controls. Their unknown state
remains visible without making a sound local core fail integration.

## Current core boundary

The core hierarchy is `Partenaire -> Projet -> Activité -> Opérations`.
Activity assignments determine Agent access. Supervisor and Validator roles
have portfolio visibility; the native Admin is technical and audit-only.
Planning revisions, review decisions, execution, exception requests, audit and
export evidence are guarded and entity-scoped. Operational outputs are PDF and
XLSX with audited CSV support. Phase 4 document behavior remains absent behind
RST-010A containment.

## Client-owned Phase 4–6 decisions

| Input | Available | Go-live requirement | Dependency | Blocker | Owner | Decision date | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Phase 4 document categories and final retention policy | Partial strategy only | Required if Phase 4 ships | Post-Phase-3C inventory | Client rules and legal confirmation | Client | Needs confirmation | Needs confirmation |
| Production public/base URL | No | Required for invitations and reset links | Hosting topology | Final hostname and TLS termination | Client/operator | Needs confirmation | Needs confirmation |
| Production mail transport and sender | No | Required before real invitations | Client mail service | SMTP/API credentials and delivery proof | Client/operator | Needs confirmation | Needs confirmation |
| Production secret custody and rotation | No | Required | Hosting and operations model | External secret store, access owners and rotation procedure | Client/operator | Needs confirmation | Needs confirmation |
| Persistent database/document/configuration storage | No | Required | Hosting topology | Volumes, access and custody | Client/operator | Needs confirmation | Needs confirmation |
| Production backup and restore procedure | No | Required | Persistent storage | Schedule, retention and restore evidence | Client/operator | Needs confirmation | Needs confirmation |
| Session, error and logging posture | No | Required | Reverse proxy and runtime | Final configuration and operator evidence | Client/operator | Needs confirmation | Needs confirmation |
| Signed human accessibility review | No | Required | Stable release candidate | Named human evidence | Client/project owner | Needs confirmation | Needs confirmation |
| Phase 5 accounting rules and examples | No | Required only if Phase 5 ships | Client accounting decisions | Journals, accounts and posting rules | Client | Needs confirmation | Needs confirmation |
| Phase 6 official Partner templates and mappings | No | Required only if Phase 6 ships | Approved templates | Columns, signatures and mappings | Client | Needs confirmation | Needs confirmation |
| Final inclusion of Phases 4, 5 and 6 | No | Required for go-live scope | Phase 3C verdict and client inputs | Project-owner decision | Client/project owner | Needs confirmation | Needs confirmation |

The signed accessibility review remains a release blocker under DEC-057. No
current evidence supports a WCAG conformance or production-readiness claim.
