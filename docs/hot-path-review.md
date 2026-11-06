# Hot-path and centralization review

Source audit, 5 November 2026. Covers authentication/session recovery, Admin
accounts, planning, execution and financial requests, notifications, global and
activity history, Partner browsing, documents and exports. These are code-backed
opportunities, not measured latency claims. No broad parallelization was applied.

## Avoidable waits and repeated work

| Priority | Hot path / source | Finding and smallest next change |
| --- | --- | --- |
| Addressed for planning reads, 6 November | `backend/app/planning/service.py`, principal | Ordinary reads now share session/user locks; `mutation=True` still forces exclusive locks. A deterministic overlapping projects/reminders regression reproduces and fixes the Dashboard lock timeout. Partner-specific and audited-download optimizations remain separate work. |
| High | `backend/app/planning/execution.py`, execution_list | Builds full execution_detail per activity, then discards fields. This repeats financial reads, operations and closure-history validation. Build a batched list projection; keep full closure validation on mutations. |
| High | `backend/app/planning/routes.py`, activity history; `planning/service.py`, revision_item | Reads all revisions and decisions, merges history, then cursor-filters in Python. Push the merged page window to PostgreSQL and batch only its decision records. Preserve ordering and authorization. |
| Medium | `ExecutionView.jsx`, financial mutation success | Waits for execution/planning refreshes before clearing selection. Show confirmed success immediately and refresh affected records concurrently; prevent follow-on actions until authoritative state is ready. |
| Medium | `PlanningView.jsx`, mutation/document/export success; `AuditHistoryView.jsx`, export | Success feedback or dialog closure waits for list/history refresh after the server confirmed the operation or download. Separate confirmed operation success from read refresh failure. |
| Medium | `NotificationView.jsx`, mark-read success | Awaits list/count refresh. Use returned authoritative notification data where sufficient and refresh other views independently. |
| Medium | `backend/app/auth/access.py`, invitation_item | Latest delivery outcome query per invitation. Batch outcomes for the selected user/generation pairs. |
| Medium | `backend/app/planning/{funding,disbursement,zero_spending,virement}.py`, list/output | Related decisions and source/confirmation/reversement are read per row. Batch by request IDs without changing state-derived actions or exact XOF. |
| Medium | `backend/app/partner_portal/routes.py`, PTA list | Annual metrics perform a query pair for every PTA. Group metrics for the selected page using one consistent cutoff. |
| Medium | `backend/app/auth/service.py`, environment_verified | Full schema/constraint/function evidence is re-read on business requests. Measure first; deduplicate within a transaction before considering any cache. A cross-request cache requires explicit invalidation and fail-closed rules. |
| Medium | `backend/app/auth/service.py`, endpoint_limit; `main.py` | Separate rate-limit transaction performs clock/insert/locked read/update and contends on same-IP rows. Consider atomic UPSERT/RETURNING after measurement. Admission must finish before the handler. |
| High risk / later | `backend/app/auth/service.py`, login | Global advisory lock is held during Argon2 verification. Investigate verification outside the lock followed by locked credential/version revalidation; requires race and abuse/security review. |

Backend database calls are synchronous. Do not use `asyncio.gather` on a shared
SQLAlchemy Session; remove repeated reads or batch within the transaction.

## Conditional opportunities

- Partner deep links currently chain projects → PTAs → activities → detail.
  Explicit URL IDs could permit parallel authorized requests, with parent-membership
  reconciliation before rendering. Default-first-item navigation truly needs the
  preceding result.
- Execution history queries gated by request state may start sooner only if the
  endpoint contract supports those states. Do not remove gates blindly.
- Admin Partner options exhaust cursor pages sequentially. Each cursor depends
  on its predecessor. A searchable paginated picker avoids full traversal; this
  needs a separate UI/API slice, not `Promise.all`.
- Partner export repeats guard/principal resolution. Consolidating it must retain
  fresh authorization at each transaction boundary, including after external work.

## Necessary ordering and already parallel work

- Verify access before protected requests; cancel old requests before starting a
  new access generation. Otherwise an old cancellation can affect the new page.
- Login/OTP mutation precedes session verification because cookies changed.
- Invitation/reset inspection needs the verified pre-auth CSRF context.
- Invitation/OTP prepare-and-commit → mail send → generation/delivery recording
  must remain ordered. Email success and a subsequent list failure are distinct.
- Upload authorization → bounded read/validation → fresh authorization/store
  protects against access changes while processing the file.
- Financial ordered locks → current-state validation → mutation and atomic audit
  are integrity requirements. Never parallelize a retry of an uncertain write.
- Export success requires a consistent authorized snapshot and artifact audit.
- Admin users/invitations already run concurrently. Execution sections and
  planning activities/metrics already parallelize once their required IDs exist.
- Disabled session-query invalidation is redundant bookkeeping, not a network call.

## Centralization assessment

Implemented:

- One frontend role catalog and derived authorization view for page capabilities,
  workspace destinations and role labels, exposed by the existing access context.
- One transaction-level API principal resolver for identity, CSRF on mutation and
  role checks. Admin no longer reads and locks its authentication context twice.
- Page/control dictionaries grouped under `frontend/src/locales/fr/`.

Remaining opportunities (not an execution plan):

1. **Workflow action predicates:** keep `allowed_actions` and mutation enforcement
   based on the same server predicates. Review remaining JSX role checks for
   assignment, evidence and financial actions; do not duplicate state/self-review
   rules in the UI page catalog.
2. **Confirmed success versus refresh failure:** one documented feedback convention
   across forms, exports, notifications and documents. A failed read must not imply
   that a confirmed write failed or encourage duplicate submission.
3. **Query-key and invalidation ownership:** feature-local key helpers and scoped
   invalidation rather than broad planning/execution refreshes. No generic framework.
4. **Download lifecycle:** reuse blob URL creation/revocation, cancellation and access
   generation checks across history, planning and Partner exports.
5. **Failure ownership:** RestClient/access coordinator handles lost authentication;
   section errors handle ordinary resource failures. Remove obsolete no-op
   `onDenied` wrappers after checking local 403/404 behavior.
6. **List projections:** batch selected-page relations through existing projection
   helpers. Avoid a repository framework or concurrent transactions solely to hide
   N+1 reads.

API authorization remains authoritative. The UI role catalog is a presentation
projection, not a cross-language shared policy engine. Partner binding, schema
integrity, state-qualified access and no-self-approval remain server checks.

## Improvement plan

The frontend request-budget changes below are implemented; backend changes remain
planned. Query owns server data: pages use `useQuery`, mutations invalidate affected
`queryKey` prefixes, and complete authoritative mutation responses may update their
exact keys with `setQueryData`. Explicit read retries use Query's `refetch`.

`SessionProvider` shares one session Query observer through React context without
copying its data into React state. Session recovery remains an access-gate
transition: it masks and clears protected data before verifying identity. Bare
session-key invalidation cannot replace that security sequence. Reference catalogs
stay in their consuming screens/forms rather than a global eager-loading context.

### Page request budgets

| Surface | Required reads | Conditional reads |
| --- | --- | --- |
| Auth/account | Shared session | Invitation/reset proof only on their routes; actions on submission |
| Admin users | Users and invitations pages | Partner names for displayed Partner users; invitation Partner choices only when that role is selected, one cursor page at a time |
| Partners/references | Partner and operation-type lists shown on this page | No projects or assignment agents |
| Projects | Project list | Partner choices only when creation dialog opens |
| PTA | Project/year context, then its activities and metrics | No reference catalogs |
| New activity | Operation-type choices | No existing PTA activities or metrics, even with cached PTA context |
| Activity | Detail, displayed revisions/current snapshot and documents | Selected revision/amendment on demand; types while editing; agents only for actionable assignment controls |
| Execution list | Selected PTA execution page | No detail/financial histories |
| Execution detail | Visible execution and financial sections | Selected requests and state-dependent histories only when applicable |
| Partner portal | Visible profile/project/PTA/activity selectors | Detail/documents for selected activity; downloads on action |
| History / notifications | Current page | Export/action on demand; eligible navigation unread count remains separate |
| Health | Page-owned readiness query and existing interval | No duplicate route prefetch |
| Documents | Visible document list | Bytes on preview/download; replacement candidates only in withdrawal dialog |

Enable requests using both active screen and required identifiers: disabled Query
observers may still contain cached data. Only required queries contribute to the
page's loading/error state. Form-option failures remain local; cancellation stays
available. Current and selected views of the same revision share one query key.

Admin Partner names still require traversing Partner pages until all displayed
IDs are found. A minimal authorized name projection in the users response would
remove that remaining traversal; it belongs to the backend list-projection slice.

### Ordered remaining work

| Order | Outcome and implementation | Verification before completion |
| --- | --- | --- |
| 1 | Scope mutation invalidations to affected projections with feature-owned query keys. Separate confirmed success from subsequent read failures; retain ordered reconciliation for uncertain writes. | Count requests after writes; affected views update, unrelated lists do not reload; failed refresh cannot suggest resending a successful invitation or retrying an uncertain approval. |
| 2 | Replace full-detail execution list construction with a dedicated batched projection. Keep full closure validation on mutations. | Disposable PostgreSQL query-count evidence, identical authorized list fields and exact XOF totals; no per-row detail-query growth. |
| 3 | Select a bounded merged activity-history cursor page in PostgreSQL and batch its decisions. | Forward/reverse traversal, timestamp ties, empty pages, concurrent inserts and unauthorized IDs; no full-history Python sort. |
| 4 | Batch invitation delivery outcomes, financial relations and Partner PTA metrics. Add only the Partner-name data needed by the Admin table. | Match user plus invitation generation, preserve allowed actions and one metrics cutoff, approved-only Partner scope and response privacy. |
| 5 | Audit each business/Partner GET for shared identity locks, including reads that write audit records. | Deterministic parallel-read and revocation/role-change races; download audit remains atomic and truthful. |
| 6 | Measure schema-verification and rate-limit cost. Deduplicate within a transaction; consider atomic rate-limit UPSERT. | Schema drift still fails closed; concurrent admission, thresholds and rollover remain correct. Cross-request integrity caching requires an explicit invalidation contract. |
| 7 | Design shorter authentication/export lock duration before implementation: expensive work outside locks requires locked credential/version or snapshot revalidation. | Dedicated credential-change, revocation, audit rollback and abuse races; no weakening based solely on latency. |

Each slice ends with focused checks and an independent review-only agent; accepted
findings return to that reviewer after correction. Preserve exact money, fresh
resource authorization, atomic audit, immutable approvals and no-self-validation.
Never parallelize queries on the same SQLAlchemy Session. Partner deep-link
parallelization is lower priority: explicit IDs may allow it, but default selection
needs preceding results and parent membership must be checked before display.

### Frontend verification

Verified 5 November 2026 against the current working tree; final Vite artifact
`index-TH6vcwt3.js`. From `frontend/`: `npm run test:unit -- --maxWorkers=1`
passed 161 tests; `npm run lint`, `npm run lint:css` and `npm run build` passed.
The combined auth/Admin/loading browser run passed 38 cases; its invitation case
passed on an isolated rerun. After the final Partner-options guard correction,
`npm run test:e2e -- e2e/auth/admin-presentation.spec.js` passed all 8 cases on the
rebuilt artifact. Earlier timing failures were investigated and rerun without
changing assertion timeouts. Independent specification and standards reviews
closed their findings. The build retains its bundle-size warning; these checks
are development evidence, not production or user acceptance.
