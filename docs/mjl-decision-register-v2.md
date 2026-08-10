# MJL Decision Register v2

This register records post-cadrage decisions and their status. Detailed rules
belong to the subject-specific canonical document referenced in each row.

## Status Vocabulary

- `APPROVED`: authoritative for implementation.
- `FORBIDDEN`: explicitly excluded.
- `DEFERRED_CLIENT_INPUT`: no implementation until required client material exists.
- `PENDING_APPROVAL`: proposed reset action or later decision awaiting approval.

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
| DEC-021 | Document-management implementation waits for approved document rules. | DEFERRED_CLIENT_INPUT | Scope boundary | Phase 4 gate |
| DEC-022 | Accounting entries wait for approved accounting rules and real examples. | DEFERRED_CLIENT_INPUT | Scope boundary | Phase 5 gate |
| DEC-023 | Official Partner reports wait for approved templates and mappings. | DEFERRED_CLIENT_INPUT | Scope boundary | Phase 6 gate |
| DEC-024 | Phase 3C is not a go-live authorization. | APPROVED | Roadmap | Revised post-cadrage package |
| DEC-025 | Every reset-manifest action requires explicit later approval. | APPROVED | Reset manifest | Phase 0 restriction |

## Deliberately Unspecified

The following are not decisions and must not be invented:

- final Opération-type values;
- accounting journals, accounts, budget codes, and posting rules;
- document categories, retention, replacement, and validation dependencies;
- Partner template mappings, official-report approval, and signature rules;
- final go-live inclusion of Phases 4, 5, and 6.
