# MJL Decision Register v2

This register records post-cadrage decisions and their status. Detailed rules
belong to the subject-specific canonical document referenced in each row.

## Status Vocabulary

- `APPROVED`: authoritative for implementation.
- `FORBIDDEN`: explicitly excluded.
- `DEFERRED_CLIENT_INPUT`: no implementation until required client material exists.
- `PENDING_APPROVAL`: proposed reset action or later decision awaiting approval.
- `EXECUTED`: approved execution is complete and verified.
- `EXECUTED_PENDING_RATIFICATION`: physical execution occurred, but a recorded
  approval-boundary deviation must be checksum-ratified before completion.

## Decisions

| ID | Decision | Status | Canonical owner | Source or rationale |
| --- | --- | --- | --- | --- |
| DEC-001 | The application is not live and backward compatibility is not required. | APPROVED | Functional specification | Revised post-cadrage package |
| DEC-002 | Use `Partenaire -> Projet -> Activité -> Opérations`. | APPROVED | Data dictionary | Revised post-cadrage package |
| DEC-003 | One Partenaire may contain several Projects. | APPROVED | Data dictionary | Revised post-cadrage package |
| DEC-004 | `Programme` is not a generic entity label. | APPROVED | Functional specification | Revised post-cadrage package |
| DEC-005 | Retain the four existing internal role codes with revised labels and powers. | APPROVED | Permission matrix | User decision during Phase 0 planning |
| DEC-006 | Native Dolibarr admin implies `ADMIN_PLATEFORME` and excludes a concurrent business role. | APPROVED | Permission matrix | User decision during Phase 0 planning |
| DEC-007 | Agent access is based on current Activity assignment, not Partner scope. | APPROVED | Permission matrix | Revised post-cadrage package and confidence review |
| DEC-008 | Supervisor and Validator can view all Activities. | APPROVED | Permission matrix | Revised post-cadrage package |
| DEC-009 | Validator is the business superuser; Admin is technical and audit-only. | APPROVED | Permission matrix | Revised post-cadrage package |
| DEC-010 | Every submission creates an immutable business revision. | APPROVED | Status model | Revised post-cadrage package |
| DEC-011 | Separation of duties is identity-based and revision-based. | APPROVED | Permission matrix | Revised post-cadrage package |
| DEC-012 | Structural editing is prohibited at or after the Activity start date. | APPROVED | Status model | Revised post-cadrage package |
| DEC-013 | Missing spent amount is null and never inferred as zero. | APPROVED | Data dictionary | Product principle |
| DEC-014 | XOF is the only first-release currency and amounts use integer-safe storage. | APPROVED | Data dictionary | Revised post-cadrage package |
| DEC-015 | Cancellation and reopening use version-bound request workflows. | APPROVED | Status model | Revised post-cadrage package |
| DEC-016 | Audit data is append-only and transactional with the mutation. | APPROVED | Functional specification | Revised post-cadrage package |
| DEC-017 | PDF and XLSX are required operational outputs; audited CSV remains supplemental. | APPROVED | Functional specification | User decision during Phase 0 planning |
| DEC-018 | CSV keeps UTF-8 BOM, semicolon separators, French headers, stable filenames, and audited generation. | APPROVED | Functional specification | Existing safe contract retained by DEC-017 |
| DEC-019 | Public registration is prohibited. | FORBIDDEN | Scope boundary | Revised post-cadrage package |
| DEC-020 | PTA negotiation, fund requests, receipt of funds, e-Tresor processing, reconciliation, and external audit are outside core scope. | FORBIDDEN | Scope boundary | Revised post-cadrage package |
| DEC-021 | Implement the approved contextual document strategy only in Phase 4 after Phases 2 through 3C provide its parent, revision, assignment, audit, and job interfaces. | APPROVED | Functional specification and roadmap | Explicit Phase 4 approval on 2026-08-19; sequence remains mandatory |
| DEC-022 | Accounting entries wait for approved accounting rules and real examples. | DEFERRED_CLIENT_INPUT | Scope boundary | Phase 5 gate |
| DEC-023 | Official Partner reports wait for approved templates and mappings. | DEFERRED_CLIENT_INPUT | Scope boundary | Phase 6 gate |
| DEC-024 | Phase 3C is not a go-live authorization. | APPROVED | Roadmap | Revised post-cadrage package |
| DEC-025 | Every reset-manifest action requires explicit later approval. | APPROVED | Reset manifest | Phase 0 restriction |
| DEC-026 | Delete all existing local sample/demo data through an approved clean reset; migrate no existing user, role assignment, Partner, Project, Activity, finance record, log, or document. | APPROVED | Reset manifest | User decision on 2026-08-10 |
| DEC-027 | Preserve exactly one native Dolibarr technical administrator account and delete every other existing sample account. | APPROVED | Permission matrix and reset manifest | User decision on 2026-08-10 |
| DEC-028 | Create no persistent sample/demo dataset until all implementation phases are complete and a later dataset specification is approved. | APPROVED | Roadmap | User decision on 2026-08-10 |
| DEC-029 | Permit disposable test-only fixtures in isolated tenants when they are created for a test and removed with that tenant. | APPROVED | Acceptance tests | User decision on 2026-08-10 |
| DEC-030 | Legacy sample data and fixture behavior are implementation debt, never evidence for current business rules. | APPROVED | Functional specification | User decision on 2026-08-10 |
| DEC-031 | Approve RST-000A at unit level and begin read-only implementation preparation; destructive execution remains blocked until the generated deletion-appendix bundle checksum receives explicit approval. | APPROVED | Reset manifest | User decision on 2026-08-10 |
| DEC-032 | Approve RST-000A appendix bundle checksum `15ba42a2dba1e3e8c3f8171b93e1049ffcbee7ddea1fb12fb6f3cfe358ce593d` for destructive execution. | APPROVED | RST-000A deletion appendix | User decision on 2026-08-10 |
| DEC-033 | Execute RST-000A against the local tenant, preserve native administrator row 1, retain no migrated business data, and keep the new bootstrap non-seeding. | EXECUTED | RST-000A execution report | Execution on 2026-08-10 |
| DEC-034 | Ratify the exact RST-000A out-of-appendix transient role row and 22-file supporting snapshot bound by checksum `5ecc8e68574358526817051cc4ce4d3322d144775b978e7154f633dfe913a870`; authorize no new mutation or later RST unit. | APPROVED | RST-000A supplemental appendix | User decision on 2026-08-10 |
| DEC-035 | Approve and execute RST-001: enforce one effective MJL role, derive Admin from native Dolibarr administrator status, forbid native-admin business roles, and migrate no deleted assignment. | EXECUTED | Reset manifest and RST-001 execution report | User approval and execution on 2026-08-10 |
| DEC-036 | Approve and execute RST-002A: remove Partner scope from authorization inputs, retain the exact empty legacy table, freeze legacy Activity mutations, permit only the safe reviewer read projection, and migrate no data. | EXECUTED | Reset manifest and RST-002A execution report | User approval and execution on 2026-08-12 |
| DEC-037 | Approve and execute RST-003: create the empty Partenaire, Projet, and Type d’Opération reference foundation; use activation rather than hard deletion; cascade Partner deactivation to active Projects without reopening them; and make Project ownership and technical reference immutable. | EXECUTED | Reset manifest and RST-003 execution report | User approval and execution on 2026-08-13 |
| DEC-038 | Approve and execute the evidence-gated sequence RST-007A, RST-004, RST-008, then RST-009A; preserve the empty tenant and one native Admin; introduce one append-only audit, remove obsolete finance, retarget invitation/reset credentials, and expose only Phase 1 navigation. | EXECUTED | Reset manifest and 2026-08-14 per-unit execution reports | Implemented after explicit user authorization; operational `initdb.log` checksum deviation ratified by DEC-039 |
| DEC-039 | Ratify only the Phase 1 operational `data/documents/initdb.log` checksum change from `8f999bca21f305125a240b319dc02bb08228d45e073f14229a91d82e69d77e68` to `6e66f68985cb1eba6fd8fcd3c3a030b84ef77b7f4967b125db78eeab472aaf21`; no business document changed, and this ratification authorizes no RST-010A or later unit. | APPROVED | Phase 1 reset execution report | Explicit user ratification on 2026-08-18 |
| DEC-040 | Approve and execute revised RST-010A as containment hardening only: retain the exact dormant ECM seams, expose no document business behavior, close MJL and native delivery paths for authenticated and anonymous GET/POST, preserve all filesystem/ECM data, and permit rollback only to denial-only containment. | EXECUTED | RST-010A containment strategy and execution report | Explicit user approval and verified implementation on 2026-08-19 |
| DEC-041 | Approve the complete future Phase 4 contextual document strategy, including its role/lifecycle/storage/preview/test gates and the accepted residual risks of one-minute preview authorization staleness, a permanent environment wrapping key without rotation, and browser rendering of scanned originals. | APPROVED | Functional specification, permission matrix, status model, data dictionary, and roadmap | Explicit Phase 4 approval on 2026-08-19; implementation remains sequenced after Phase 3C |
| DEC-042 | Clarify DEC-009 and DEC-041: the Phase 4 Admin document exception is read-only within the runtime active Dolibarr entity (`$conf->entity`); category rules and document lifecycle are append-only revisions/events, and submitted requirement snapshots freeze their complete rule payload. | APPROVED | Functional specification, permission matrix, status model, and data dictionary | User approved the attached Authoritative Correction and Phase Sequence and requested its implementation on 2026-08-19; no Phase 4 runtime behavior is authorized out of sequence |
| DEC-043 | Approve and execute RST-014A as the guarded, disposable Phase 1 fixture infrastructure unit with fail-closed dual attestation, per-run non-Admin credentials, safe SQL channels, streaming shared-state evidence, secret scanning, and unconditional tenant teardown; RST-013A remains separately approval-gated. | EXECUTED | RST-014A strategy and execution report | Explicit initial and amended user approvals on 2026-08-19; the amendment approves the tenant-active native `dol_hash(..., '0')` algorithm, canonical stdin-only auth-worker secret transport, and recorded review corrections; complete committed-source gates and independent clean reviews on 2026-08-21 |
| DEC-044 | Approve and execute RST-013A as the Phase 1 test-reset unit: retarget the maintained test inventory, add current-model RST-002A authorization/projection replacements, reuse executed RST-014A disposable fixtures, permit exactly one disposable same-entity/matched-parent Activity projection control plus the approved hostile rows, forbid SQL fixture resumption, and preserve shared state. Issue `PHASE_1_READY_WITH_NOTES` after complete gates and clean independent reviews; the signed human accessibility gate is the sole deferred note and Phase 2 remains separately gated. | EXECUTED | RST-013A strategy and execution report | Explicit user statement `I approve RST-013A` and separate approval of the exact positive-control/serial-factory amendment on 2026-08-21; complete committed-source gates and final clean Standards, Spec, and Security/Isolation reviews on 2026-08-21 |
| DEC-045 | Approve RST-005 as the containment-first empty Activity foundation: exact target schema and dormant database guards, dual-oracle read-only projection, dedicated evidence-gated migration, no business mutation/navigation/revision/assignment behavior, and containment-only dependency-aware rollback. | APPROVED_ORIGINAL; GUARDED_LOCK_AMENDMENT_PENDING | RST-005 Activity foundation strategy and reset manifest | Explicit user statement `I approve RST-005` on 2026-08-24; disposable implementation later proved MariaDB rejects atomic rename under explicit table locks, so the documented temporary insert-guard amendment requires separate approval before shared execution |

## Deliberately Unspecified

The following are not decisions and must not be invented:

- final Opération-type values;
- accounting journals, accounts, budget codes, and posting rules;
- document category values and the legally confirmed indefinite-retention policy;
- Partner template mappings, official-report approval, and signature rules;
- final go-live inclusion of Phases 4, 5, and 6.
