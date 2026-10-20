# MJL Phase 4 Contextual Document Management Planning Brief

## Status and authority

```text
PHASE_4_PLANNING: REQUESTED
PHASE_4_IMPLEMENTATION: NOT_AUTHORIZED
DOCUMENT_ROUTES: DENY_ALL_403
```

This brief defines what MJL wants from Phase 4. It consolidates DEC-021,
DEC-041, DEC-042, the current canonical v2 documents, and the user's Phase 4
planning request of 2026-10-12.

This is a cross-cutting planning and handoff index. The subject-specific
canonical v2 documents remain authoritative for business rules, permissions,
states, data invariants, and implementation state. If this brief and a
subject-specific owner disagree, do not choose one silently: reconcile the
canonical owner before implementation.

This is documentation-only planning authority. It does not authorize source,
schema, configuration, tenant, infrastructure, or production changes. Until a
separate implementation authorization and controlled cutover, every MJL and
native document delivery route must retain its current deny-all behavior.

If this brief conflicts with a later explicit user instruction, the later
instruction wins and the affected canonical guidance must be updated.

## Outcome

MJL users must be able to manage supporting evidence in its business context,
without exposing Dolibarr's native document delivery surface. Phase 4 covers:

- guarded upload from an authorized Projet, Activité, or Opération context;
- category management and immutable category-rule revisions;
- append-only document series and versions;
- atomic replacement and irreversible, reasoned withdrawal;
- safe in-browser preview through an isolated origin;
- guarded, audited download after a fresh authorization check;
- immutable requirement snapshots tied to submitted Activity revisions;
- entity isolation, encryption, quota enforcement, malware screening,
  reconciliation, and recovery controls.

The interface is French-first, accessible, usable without JavaScript for core
actions, and consistent with the approved MJL design system.

## Current baseline

- `custom/mjlfinancement/documents.php` and
  `custom/mjlfinancement/documentdownload.php` intentionally return HTTP 403
  for every method without accessing document storage.
- Deployment containment blocks native Dolibarr document delivery paths.
- No active MJL document category, series, version, lifecycle, quota, preview,
  or requirement-snapshot schema exists.
- Dormant ECM references, document fixtures, selectors, and historical code are
  evidence only. They are not an implementation design or reuse requirement.
- The persistent tenant remains empty except for one native technical Admin.
  Phase 4 tests may create only minimal records in isolated disposable tenants.

## Scope boundary

### Included

- Contextual evidence attached to exactly one Projet, Activité, or Opération.
- A read-only scoped document library in addition to contextual panels.
- Entity-specific categories managed by the Validateur définitif.
- Multiple document series for the same parent and category.
- Immutable versions and append-only lifecycle events.
- Current and historical metadata, subject to role and reason requirements.
- PDF, JPEG, and PNG originals, with a maximum accepted file size of 20 MiB.
- A 10 GiB retained-document quota per Dolibarr entity, counting every retained
  version.
- Audited upload, publication, replacement, withdrawal, preview grant,
  download, historical recovery, category change, and reconciliation outcome.

### Excluded

- Documents attached directly to a Partenaire.
- Public links, public registration, or a public document register.
- Raw ECM links or native Dolibarr routes as a delivery mechanism.
- Physical document deletion through the MJL application.
- Bulk upload, bulk download, OCR, document editing, electronic signature,
  antivirus administration UI, external portals, or mobile/offline sync.
- Accounting documents or official Partner-report workflows from Phases 5 and
  6.
- Persistent demo data, production rollout, or a production-readiness claim.

## Roles and permissions

All checks are server-side, filtered by the runtime active Dolibarr entity
`$conf->entity`, and re-evaluated on every route and mutation. Hiding an action
in the UI is not authorization.

| Capability | Agent | Supervisor | Validator | Admin |
| --- | --- | --- | --- | --- |
| View current documents | Assigned Activity context | Active entity | Active entity | Read-only, active entity |
| Upload evidence | Assigned Activité or Opération | No | Projet, Activité, or Opération | No |
| Append a version | Assigned Activité or Opération | No | Yes, but not as replacement of Agent evidence | No |
| Withdraw current version | Assigned Activité or Opération, reason required | No | Yes, but not Agent evidence | No |
| Manage categories and rules | No | No | Yes | Technical import support only |
| View historical or withdrawn bytes | No | No | Reasoned and separately audited | Reasoned and separately audited |
| Download or preview current bytes | If current read access remains | Active entity | Active entity | Read-only, active entity |

Additional rules:

- Agent access derives from current Activity assignment, never Partner scope.
- Project-level upload is Validator-only because Agents are authorized through
  Activity assignment.
- A Validator may add separate evidence but cannot replace or withdraw evidence
  uploaded by an Agent.
- Admin is a technical and audit role, not a business document manager.
- Historical recovery means controlled read access to an immutable version. It
  never restores that version as current.
- Every uploader of evidence selected into a submitted revision becomes a
  contributor to that revision and cannot prevalidate or definitively validate
  it.

## Domain model

### Category and Category Rule Revision

A category is an entity-scoped stable identity with a user-facing French label.
Categories are created inactive or active and are never physically deleted.
The initial category values are client input and must not be invented.
Every configured category applies to all three supported parent types: Projet,
Activité, and Opération. The first implementation has no per-parent category
applicability switch.

Each category change appends an immutable, monotonically numbered Category Rule
Revision. The complete revision payload includes:

- category identity and label;
- active or inactive state;
- applicability to Projet, Activité, and Opération;
- requirement mode;
- effective timestamp and actor;
- canonical payload and integrity hash.

The planned requirement modes are:

- optional;
- required for an Activité;
- required once for each planned Opération.

Rule changes are prospective. They do not rewrite earlier submitted revisions.
At least one qualifying current Document Series satisfies one requirement.
Historical, superseded, or withdrawn versions do not satisfy it, and the rule
does not restrict the parent to exactly one series.

### Document Series

A Document Series is the stable identity of one contextual item of evidence. It
belongs to exactly one active entity, one parent object, and one category. A
parent and category may have several distinct series.

### Document Version

A Document Version is an immutable accepted file in a series. It records its
sequence, original safe display name, verified media type, byte size, integrity
hash, uploader, timestamps, storage reference, matching ECM metadata reference,
and lifecycle evidence. Accepted bytes are never overwritten.

### Requirement Snapshot

Draft Activities do not freeze document requirements. Submission or
resubmission atomically selects the effective committed Category Rule Revisions
and stores their complete payloads and hashes, together with the qualifying
Document Series and Version identifiers. Review always uses that frozen
snapshot. A correction and later resubmission uses the rules effective at the
new submission.

A concurrent category-rule change must produce either one coherent snapshot or
a retryable conflict. It must never produce a mixed snapshot.

## Lifecycle

The lifecycle is append-only:

1. `PUBLISHED`: an accepted version becomes the sole current version of its
   series.
2. `SUPERSEDED`: publishing a replacement version atomically makes the prior
   current version historical and the new version current.
3. `WITHDRAWN`: a reasoned action makes the current version unavailable as
   current evidence. Withdrawal is irreversible.

There is no physical delete, unwithdraw, or in-place replacement. A series has
at most one current published version. The current-state projection must be
rebuildable from immutable versions and lifecycle events.

Per-series locking or an equivalent version check must prevent two concurrent
replacements from both becoming current. The version, lifecycle event, audit
event, quota update, and current projection commit atomically.

## Workflow integration and locks

- Evidence selected into a submitted or prevalidated revision is locked against
  replacement or withdrawal while that revision is under review.
- Activity evidence becomes permanently locked after definitive validation.
- Operation evidence may continue to receive later versions after Activity
  validation while the Operation remains non-terminal.
- Terminal Operation evidence is locked.
- Reopening an Operation unlocks only future append actions. It does not mutate
  earlier versions or requirement snapshots.
- A stale form, revoked assignment, changed role, changed parent state, changed
  category rule, or exhausted quota fails without changing document, audit, or
  quota state.

## Upload controls

The guarded upload operation owns authorization, validation, storage, ECM
metadata, lifecycle, quota, and audit as one cohesive application operation.

For each upload it must:

1. verify the active entity, role, current assignment, parent, category, and
   lifecycle permission;
2. enforce CSRF protection, request size, per-file size, and a limit of 10
   upload attempts per user in 10 minutes;
3. normalize the display filename and reject path or control-character abuse;
4. compare the declared extension and media type with server-side MIME
   detection, file signature, and parsed structure;
5. reject encrypted PDFs, PDF JavaScript, embedded files, launch actions,
   malformed documents, excessive image dimensions, and decompression or
   resource bombs;
6. scan the plaintext synchronously with the configured local malware scanner,
   fail closed when the scanner is unavailable, and require signatures no more
   than 24 hours old;
7. reserve quota, encrypt and durably stage the accepted bytes, then commit
   document metadata, one entity-matched ECM row, lifecycle, quota, and audit;
8. compensate a failed metadata commit and leave no public or plaintext file;
9. remove rejected and temporary plaintext bytes.

The actual scanner product, signature-update operation, and local development
substitute require an implementation-readiness decision. No test-only bypass
may be enabled in a shared or production tenant.

## Storage and ECM boundary

- Accepted originals are stored as extensionless authenticated ciphertext
  outside the web root.
- Each file uses a random data-encryption key. The key is wrapped by a permanent
  environment-held wrapping key.
- Effective keys are never logged or stored as plaintext application data.
- The accepted Phase 4 risk boundary has no wrapping-key rotation in the first
  implementation. Key custody, escrow, and recovery still require an operator
  decision before production readiness.
- Exactly one accepted version maps to exactly one entity-matched ECM metadata
  row and one immutable ciphertext object.
- Native ECM is a metadata and storage adapter only. It performs no MJL
  authorization and serves no document bytes.
- A reconciliation operation detects orphan ciphertext, orphan metadata,
  missing objects, hash mismatch, invalid current projections, quota mismatch,
  and cross-entity links without silently repairing uncertain state.
- Backup and restore must preserve ciphertext, wrapping-key availability,
  metadata, audit correlation, and integrity verification.

## Authorized download

Every download passes through an MJL guarded route. Immediately before
streaming, it rechecks active entity, effective role, assignment or portfolio
scope, parent lifecycle, current or historical permission, and any required
recovery reason.

Successful delivery:

- is separately audited;
- uses `Content-Disposition: attachment` with a safe filename;
- uses the verified media type;
- sends `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`;
- decrypts as a bounded stream without exposing a stable plaintext path;
- fails closed on integrity, storage, authorization, or audit failure.

No native Dolibarr URL, filesystem path, storage identifier, wrapping key,
preview token, or internal error is disclosed.

## Isolated preview

Preview is delivery, not a shortcut around download authorization. It uses a
separate HTTPS registrable origin that receives no MJL application cookies.

The application issues a one-time opaque grant after a fresh authorization
check. The preview origin exchanges that grant through POST for a one-minute,
host-only, `Secure`, `HttpOnly`, `SameSite=Strict` cookie, then redirects to a
token-free URL. Grants are single-use, short-lived, not logged, and bound to the
user, active entity, exact version, and permitted operation.

The preview service:

- rechecks the bound grant and exact immutable version;
- decrypts only into bounded temporary memory or tmpfs;
- supports guarded byte ranges where required by the browser;
- sends no CORS permission to the application origin;
- blocks external resources and active content;
- sends strict no-store, framing, content-type, and content-security headers;
- removes temporary plaintext on completion or failure;
- provides an accessible download fallback when inline rendering is unusable.

Accepted residual risks are one minute of preview authorization staleness,
browser rendering of scanned originals, and the first implementation's
permanent wrapping key without rotation.

## User experience

The planned UI consists of:

- a contextual `Documents justificatifs` panel on eligible Projet, Activité,
  and Opération detail screens;
- a read-only `Documents` library filtered to the viewer's authorized scope;
- a Validator category-management screen;
- an upload form showing accepted formats, maximum size, selected category,
  requirement context, and clear validation errors;
- a version history showing uploader, date, category, state, withdrawal reason,
  and the permitted preview/download actions;
- explicit replacement and withdrawal actions with confirmation and reasons;
- visible locked-state explanations when workflow state prevents mutation.

Core upload, replacement, withdrawal, browsing, and download must work with
server-rendered forms and links. Keyboard operation, focus order, labels,
status messages, error association, responsive behavior, reduced motion, and
contrast follow the active design-system authority. Dormant legacy CSS is not
design authority.

## Architecture boundary

- All MJL behavior stays in `custom/mjlfinancement` and documented safe support
  areas. Dolibarr core files are never modified.
- Use one cohesive contextual-document application module with narrow adapters
  for authorization, persistence, encrypted object storage, ECM metadata,
  malware scanning, preview grants, delivery, audit, and time.
- Do not create a generalized storage framework or duplicate existing MJL
  entity, role, assignment, audit, transaction, or lifecycle mechanisms.
- The same authorization policy is used by UI visibility, metadata reads,
  upload, preview grant, download, historical recovery, and background work.
- The existing deny-all routes remain the rollback boundary until the complete
  guarded replacement is authorized and verified.

## Lean implementation sequence

Implementation requires a separate user authorization. The implementing agent
must first perform a readiness review against the then-current code and
authority. Because frozen architecture document 17 currently defines the
document endpoints as denial adapters, the readiness gate must also produce and
obtain approval for the smallest architecture amendment or ADR that reconciles
Phase 4 ownership, dependencies, transactions, authorization, lifecycle, route
cutover, and rollback with the frozen architecture and Engineering Standard.
DEC-074 does not approve that amendment. Subject to those gates, use the
smallest vertical sequence:

1. Define the schema and cohesive domain/application operation for categories,
   rule revisions, series, versions, events, snapshots, and quota. Prove entity
   isolation and append-only invariants in a disposable tenant.
2. Add contextual category management, guarded upload, current metadata lists,
   version append/replacement, withdrawal, and authorized attachment download.
3. Integrate requirement snapshots, contributor separation, and workflow locks
   with Activity submission, review, validation, Operation terminal state, and
   reopening.
4. Add the isolated preview origin and one-time grant exchange after its
   deployment boundary is available.
5. Add reconciliation and backup/restore evidence, then perform the explicit
   containment-to-guarded-route cutover only after all required gates pass.

Do not build later steps speculatively. Each slice must have an actual current
consumer and retain deny-by-default behavior for capabilities not yet cut over.

## Acceptance criteria

Phase 4 is functionally complete only when focused disposable checks prove:

- role, assignment, active-entity, direct-URL, POST, CSRF, stale-form, and
  cross-entity denial for every document action;
- allowed formats and valid uploads succeed, while malicious names, MIME
  mismatch, polyglots, malformed or active PDFs, resource bombs, malware test
  files, stale signatures, and scanner failure are rejected without residue;
- category-rule revisions are immutable and prospective;
- every category applies to Projet, Activité, and Opération, and one or more
  qualifying current series satisfy a requirement while historical,
  superseded, and withdrawn versions do not;
- submitted requirement snapshots are complete, coherent, and immutable;
- uploaders become revision contributors and cannot review their revision;
- replacement produces one current version and supersedes the prior version in
  one transaction under concurrency;
- withdrawal is reasoned, audited, irreversible, and respects ownership;
- review, final-validation, terminal-state, and reopening locks behave exactly
  as specified;
- quota counting includes historical versions and remains correct under
  concurrent uploads and failed commits;
- stored bytes are encrypted, authenticated, extensionless, and unreachable by
  native or public paths;
- authorized downloads and historical recovery are audited and unauthorized
  streams disclose no bytes;
- preview grants are bound, one-time, token-free after exchange, range-safe,
  cookie-isolated, and inaccessible after expiry or replay;
- reconciliation detects every supported mismatch and backup/restore preserves
  readable, integrity-checked evidence;
- the original deny-all containment can be restored without reopening native
  delivery.

The affected French-first role flows require targeted accessibility review.
Passing automated or E2E checks is evidence only and does not establish user
acceptance or production readiness.

## Decisions required before implementation authorization

The following are deliberately unresolved and must not be invented:

1. The initial document-category catalog and French labels.
2. Legal retention duration, including whether retained versions are truly
   indefinite and the procedure for a legally required purge outside normal
   MJL lifecycle actions.
3. Malware scanner product, signature source, update/health operation, and
   responsibility for scanner outages.
4. Preview hostname, TLS termination, network isolation, and deployment owner.
5. Wrapping-key generation, custody, escrow, backup, and disaster-recovery
   procedure.
6. Production storage location, capacity alerts, backup schedule, and restore
   responsibility.

Before implementation, an approved architecture amendment or ADR is also
required to reconcile the frozen denial-adapter boundary with the selected
Phase 4 slice. That governance gate is not client content and must not be
silently inferred from this planning request.

These decisions may block their dependent implementation slice or production
readiness. They do not justify inventing a broader document platform.

## Required next-agent response

The next agent must review this brief against current authority and code before
executing anything. It should return:

- a concise readiness verdict;
- any real contradiction or missing client decision, with impact;
- the smallest proposed first implementation slice and its acceptance checks;
- confirmation that document routes remain deny-all until separately authorized.

It must stop before implementation unless the user separately authorizes that
specific reviewed slice.
