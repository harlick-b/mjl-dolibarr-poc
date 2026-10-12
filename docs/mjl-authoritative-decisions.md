# MJL Authoritative Decisions

This file routes current MJL authority. Development is unfinished. Recorded
implementation, verification, readiness, and approval states are evidence only
and never imply current user acceptance.

## Authority order

1. The user's latest explicit instruction.
2. This authority router.
3. The canonical documents below for their assigned subjects.
4. Approved v3 design guidance for visual presentation only.
5. Gap analysis and current-state evidence.
6. Existing code and tests as current-state evidence only.

The latest user instruction supersedes every conflicting earlier project
decision, approval, plan, report, test convention, and skill procedure. Update
conflicting active guidance instead of applying an older rule. If canonical
documents still contradict each other after applying the latest instruction,
stop and surface the contradiction.

## Canonical ownership

| Subject | Canonical document |
| --- | --- |
| Complete business rules | `docs/mjl-functional-specification-v2.md` |
| Decision history and provenance | `docs/mjl-decision-register-v2.md` |
| Core, excluded, and gated scope | `docs/mjl-scope-boundary-v2.md` |
| Visibility and permitted actions | `docs/mjl-permission-matrix-v2.md` |
| States, transitions, and guards | `docs/mjl-status-and-transition-model-v2.md` |
| Target entities, fields, and invariants | `docs/mjl-data-dictionary-v2.md` |
| Implementation state and unfinished phases | `docs/mjl-implementation-roadmap-v2.md` |
| Architecture preservation requirements | `docs/architecture-audit/14-preservation-ledger.md` |
| Frozen target architecture boundaries and migration-wave contracts | `docs/architecture-audit/17-target-architecture-proposal.md` |
| Implementation and review rules within the frozen architecture | `docs/mjl-engineering-standard-v1.md` |

## Frozen engineering baselines

The architecture and Engineering Standard are frozen authorities. Their freeze
does not authorize implementation.

| Authority | Status | SHA-256 / evidence |
| --- | --- | --- |
| `docs/architecture-audit/17-target-architecture-proposal.md` | `ARCHITECTURE_FROZEN` | `b32655df213a5d5f8cc2e4b4cd1bf6f7aa4c6b6ec5d3ac4273ae9759ff6d9b9c` |
| `docs/mjl-engineering-standard-v1.md` | `STANDARD_FROZEN`; amended by DEC-066 | `b24021ac52a55f5a9921801aac8d100d9238268c55b3775875a0709132fb9560`; original freeze hash `a47f2d942172a4685b02efce027ca04c0a2361f258ebd8c0b776117c97f8f62e`; review history: `docs/mjl-engineering-standard-v1-review.md` |
| `docs/architecture-audit/18-independent-architecture-review.md` | immutable historical review; `ARCHITECTURE_REVISION_REQUIRED` at that review point | `3b0a4fe46a9ea5bc666c32d997ddb98ef430f47594bb152a738f1aa9d8f8919f` |

The preservation ledger remains 35/35 mapped. W0 is a prerequisite, not a
migration wave, and is `W0_COMPLETE`. W1, W2, W3, and W4 are `COMPLETE`. The
documentation-only W5 review found W5 `READY_FOR_AUTHORIZATION`. After the
pre-movement stop, DEC-066 amended the blocking assumption and the user
separately re-authorized the same bounded scope. W5 is now `W5_COMPLETE` under
DEC-067. DEC-068 records the separately authorized closure of BC-021,
activation-time BC-022, the RST-012 transition matrix, and descriptor state
characterization. That readiness verdict was followed by an explicit W6
authorization whose hard prohibition on lifecycle-ownership movement conflicted
with the frozen W6 delegation ledger. DEC-069 records that attempt as
`W6_FAILED` before movement. The user then resolved all three blockers through
DEC-070: retain and authorize the exact frozen W6 delegation, use the DEC-066
Standard hash `b24021ac...`, and use commit `725821a` as the clean named
prerequisite baseline. The exact delegation and all W6 gates then completed
under DEC-070. W6 is now `W6_COMPLETE`. The documentation-only W7 review found
the frozen two-wrapper removal `W7_READY_FOR_AUTHORIZATION`; DEC-071 then
authorized and completed that exact retirement. W7 is now `W7_COMPLETE`.
Any future work must consult the applicable
business/preservation authority, then the frozen architecture and Engineering
Standard, and finally the roadmap for the currently authorized migration state.

## W0 prerequisite state

The documentation-only W0 readiness review is recorded in
`docs/mjl-w0-readiness-review.md` with verdict
`W0_READY_FOR_AUTHORIZATION`. The user then explicitly authorized the bounded
prerequisite, and its focused characterization, runner correction, and required
verification completed successfully.

```text
W0_COMPLETE
W1_COMPLETE
W2_COMPLETE
W3_COMPLETE
W4_COMPLETE
W5_COMPLETE
W6_COMPLETE
W7_COMPLETE
```

W0 completion does not authorize W1 or any later migration wave. The subsequent
documentation-only W1 readiness review is recorded in
`docs/mjl-w1-readiness-review.md`. The user resolved its scope blocker through
DEC-061: Partner and Project empty-action list GETs form one shared W1 slice;
Operation Type and all detail/create/edit/lifecycle/recovery/POST paths are
excluded. The focused re-review verdict was `W1_READY_FOR_AUTHORIZATION`.
The user subsequently authorized that exact slice, and DEC-062 records its
verified implementation and completion.

```text
W1_COMPLETE
W2_COMPLETE
W3_COMPLETE
W4_COMPLETE
W5–W7: NOT_AUTHORIZED
```

The post-W1 W2 readiness review and its traceability ledger are recorded in
`docs/mjl-w2-readiness-review.md`. Its exact boundary is the complete
`activities.php` GET and POST surface plus the Activity-specific monitoring
list/read/render branch. Operation and request-queue handlers, command/query
internals, dashboards, alerts and all later waves are excluded. The user later
authorized that exact slice. Its handler/read/presentation/template cutover,
focused characterization, disposable Phase 2 verification, and clean
independent reviews completed successfully. This completion authorizes no W3
work.

```text
W2_COMPLETE
W3_COMPLETE
W4_COMPLETE
W5–W7: NOT_AUTHORIZED
```

The post-W2 W3 readiness review is recorded in
`docs/mjl-w3-readiness-review.md`. Its exact boundary is reference and access
write ownership: deep reference/access commands, retained HTTP/native behavior,
and the atomic invitation-caller switch to a transaction-participating access
operation. Reference reads/UI, authentication ownership, schema, Activity/W2,
tooling and later waves are excluded. The user subsequently authorized that
exact slice. The deep commands, caller cutovers, legacy-writer retirement,
transaction/failure characterization, disposable behavioral gates, and final
independent reviews completed successfully.

```text
W3_COMPLETE
W4_COMPLETE
W5–W7: NOT_AUTHORIZED
```

The post-W3 W4 readiness review and execution ledger are recorded in
`docs/mjl-w4-readiness-review.md`. Its exact boundary is authentication
responsibility ownership: one cohesive auth command, one private procedural
session adapter, stable routes/hooks/templates, preserved W3 access
participation and role vocabulary, and removal of the email-to-auth capture
callback. The user subsequently authorized that exact slice. All ten constrained
rows, six cutover groups, ten verification gates, and the 35 preservation
requirements completed without an architecture or Engineering Standard amendment.

```text
W4_COMPLETE
W5–W7: NOT_AUTHORIZED
```

The post-W4 W5 readiness review is recorded in
`docs/mjl-w5-readiness-review.md`. Its exact boundary is reporting/export
ownership separation, an independently mergeable dashboard/index/alerts move
onto the W2 monitoring-read module, and only directly proven frontend
producer/consumer changes. `MjlMonitoring` remains the query owner. Six
constraints had to resolve before their affected movement or cutover. DEC-066
resolved the T02 contract ambiguity by
preserving the existing generic unavailable/HTTP 503 result when rollback
reports failure on a read-only report/audit preview. Rollback and exact session-
budget restoration are still attempted; no partial content or download action
is exposed. The user then explicitly re-authorized the existing W5 scope. The
report/audit handler-read-presentation split, export-delivery seam, and
dashboard/index/alerts move to W2 monitoring-read completed with all focused
contracts and G00–G08 runtime/source gates passing. `MjlMonitoring` remains the
query owner, durable export meaning is unchanged, no CSS/JS or schema changed,
and execution stopped before W6.

```text
W5_COMPLETE
W6–W7: NOT_AUTHORIZED
```

The post-W5 W6 readiness review is recorded in
`docs/mjl-w6-readiness-review.md`. It reconciles the amended Standard hash, the
exact lifecycle-delegation boundary, 35/35 preservation requirements, and the
post-W5 source and the DEC-068 prerequisite closure. Its verdict is
`W6_READY_FOR_AUTHORIZATION`. The later authorization did not permit a valid
implementation: it simultaneously required the frozen ledger and prohibited
the lifecycle-ownership movement that ledger requires. Under its own conflict
rule, DEC-069 records `W6_SCOPE_CONFLICT` and `W6_FAILED` before movement.
DEC-070 superseded only those conflicting authorization inputs and authorized
the frozen lifecycle delegation from clean prerequisite baseline `725821a`.
The descriptor now delegates once to the existing current-path lifecycle seam;
native `_remove`/`_init`, exact detectors/installers, SQL-resource paths,
states, DDL, auth behavior, and guarded entrypoints remain unchanged. All
G00–G10 evidence passed, including the focused disposable lifecycle gates and
independent reviews. No W7 work was authorized or performed.

```text
W6_COMPLETE
Baseline: 725821a
Lifecycle ownership delegated: YES, exactly as frozen
W7: NOT_AUTHORIZED
```

The post-W6 W7 readiness review and implementation outcome are recorded in
`docs/mjl-w7-readiness-review.md`. It corrects the pasted brief's historical
Standard hash and W6 ownership wording, then applies the lean frozen boundary:
only `mjl_activity_access_can_mutate()` and
`mjl_activity_access_require_mutation()` were removed after repository and
dynamic-registration/include proof. The containing library, its read-access
functions, all action-specific and locked authorization, every other cleanup
candidate, and every W0-W6 owner remain unchanged. PHP syntax, the focused
access/audit unit gate, disposable VUI03 3/3, and final independent reviews
passed. W7 is complete; no `MIGRATION_COMPLETE` state is created.

```text
W6_COMPLETE
W7_COMPLETE
MIGRATION_COMPLETE: NO
```

Completed plans and reports are recoverable from Git history and are not active
guidance. `docs/mjl-current-app-functional-map.md` records current-state
evidence only. Unresolved weaknesses and unapproved recommendations belong in
`docs/mjl-current-vs-target-gap-analysis.md`.

## Current product decisions

- The application is under development and nothing is accepted by default.
- No phase, passing test, verdict, or registered approval authorizes later work.
- Production preparation and production-readiness assessment are deferred until
  the user explicitly requests them.
- The application is not live. Existing local sample data is not migrated.
- Preserve exactly one native Dolibarr technical administrator in the empty
  development tenant.
- Create no persistent sample/demo dataset until the user approves one. Tests
  may create minimal records only in isolated disposable tenants and must tear
  them down.
- The canonical hierarchy is `Partenaire -> Projet -> Activité -> Opérations`.
- `Programme` is not a generic entity name; it may remain in a proper name.
- Each user has one effective role. Stable codes are `AGENT_SAISIE`,
  `AGENT_VERIFICATEUR`, `VALIDATEUR_DEFINITIF`, and `ADMIN_PLATEFORME`.
- `AGENT_VERIFICATEUR` is labeled `Agent superviseur et prévalidateur`.
- Native Dolibarr admin implies `ADMIN_PLATEFORME`, cannot coexist with an
  active MJL business role, and grants no business workflow mutation.
- Agent visibility follows current Activity assignment. Supervisors and
  Validators can view all Activities.
- Only Admin can send invitations for now; no public registration route exists.
- Submitted business revisions are immutable and review decisions target one
  exact revision. Self-validation remains forbidden.
- Missing financial information is never zero. XOF amounts use integer-safe
  storage.
- Operational outputs require French-labeled PDF and XLSX; audited CSV is
  supplemental.
- Document business behavior remains behind the current containment boundary.
  Phase 4 requires a fresh user request. Accounting and official Partner
  reports remain deferred pending user decisions.
- The future Phase 4 Admin document exception is read-only and non-mutating in
  the runtime active Dolibarr entity (`$conf->entity`) only.

## Implementation boundary

MJL-specific code stays outside Dolibarr core. Native Dolibarr capabilities may
be reused through guarded MJL interfaces. The roadmap records which phases are
implemented; that status does not establish acceptance.

Over-engineering is banned. Remove obsolete mechanisms and their stale
callers together; historical references do not justify keeping them. Use the
smallest implementation that satisfies the current request and a concrete
authorization, security, or data-integrity risk. Check scope before
editing and when new work appears. Record useful optional work as an unapproved
recommendation rather than implementing it.

## Design authority

The approved v3 design package is authority for visual presentation only.
`docs/design-system/approved/v3/` owns visual tokens, components, density,
interaction states, responsive behavior, and accessibility guidance. Product,
role, permission, workflow, document, and export assertions are superseded by
the canonical documents when they conflict.
