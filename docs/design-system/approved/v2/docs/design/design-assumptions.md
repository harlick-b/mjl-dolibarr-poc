# MJL Financement — Design Assumptions

Status: `READY_WITH_ASSUMPTIONS`

This v2 classification incorporates the user-supplied manual review of v1. The review
evidence is authoritative for this generation but was not independently obtained by
`proj-design`; it does not authorize target-repository access or implementation.

## Reclassified authoritative rules and current evidence

| ID | Classification | Corrected finding | Design consequence |
| --- | --- | --- | --- |
| FACT-001 (was ASM-001) | authoritative security rule | Unresolved scope must fail closed. No role or capability may be inferred from the pending route/action matrix. Current scope/access tests pass, while the unresolved-scope integrity audit currently fails. | Preserve fail-closed behavior and treat the failing integrity audit as a release blocker, not permission to weaken scope. |
| FACT-002 (split from ASM-002) | authoritative export rule | Exports are CSV/XLSX only, with BOM, semicolon separator, French headers, stable filenames, and export auditing. | Preserve these invariants; only canevas details and role-by-report rights remain provisional. |
| EVID-001 (was ASM-004) | user-reported runtime snapshot | 127 E2E tests passed, 1 failed, and 2 did not run. Schema and workflow smokes mostly passed; the unresolved-scope integrity audit failed. | Do not claim full runtime conformance or release readiness. Re-run and resolve the failing/not-run checks before release. |
| EVID-002 (split from ASM-005) | user-reported runtime evidence | Browser, authorization, guarded-document, export, and workflow journeys have substantial passing runtime evidence. | Preserve those journeys, while keeping responsive and accessibility conformance explicitly unproven. |
| FACT-003 (split from ASM-006) | confirmed current pattern | The current product uses the supplied palette, Arial/Helvetica, compact spacing, and Dolibarr pictos. | Treat these as the current baseline, with final brand approval and formal token/icon policy still pending. |
| FACT-004 (was ASM-007) | confirmed current lifecycle boundary | Budget lines have draft/inactive and active states plus activation. No approved budget-line closure/deactivation transition exists. | Do not design or imply a reverse transition. |
| FACT-005 (split from ASM-008) | authoritative document rule/current behavior | Global Documents is read-only, uploads are contextual, and downloads are guarded and audited. No user-facing inline preview or document-removal action currently exists. | Preserve the first three rules; do not invent preview or removal. |
| FACT-006 (split from ASM-009) | authoritative terminology rule | French terminology is the required baseline. `Partenaires / Programmes` and the four production role terms are protected terminology. | General microcopy may be reviewed, but protected terms are not freely replaceable. |
| FACT-007 (split from ASM-010) | authoritative role boundary/current compatibility evidence | Exactly four production roles are approved. No fifth role or dedicated read-only audit overlay is approved. A generic internal `readonly` capability flag and legacy `LECTEUR` fixtures exist. | Do not model those compatibility mechanisms as a fifth production role or deny that any read-only mechanism exists. |
| FACT-008 (was ASM-012) | current-scope boundary | No product-wide search, bulk mutation/upload, asynchronous export, notification center, or user-facing document deletion was found. Exports are synchronous POST actions. Scoped audit/search under Supervision remains permitted. | Do not introduce absent capabilities in this package, but do not describe them as permanently prohibited. |

## Remaining assumptions and unknowns

| ID | Assumption | Reason | Confidence | Affected decisions | Impact if incorrect | Recommended confirmation | Domain |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ASM-002 | Donor/client report canevas, columns, order, and role-by-report rights remain provisional. | Those report-specific decisions are pending even though the export format invariants are authoritative. | High | 003, 006, 008 | Report content, order, and visibility may change. | Client approves each canevas and role-by-report matrix. | reports |
| ASM-003 | Production email, URL, secrets, backup/restore, monitoring, and rehearsal are unconfirmed and block release readiness. | No operational sign-off evidence was supplied. Unconfirmed does not mean unconfigured. | High | 008 | Release, authentication, email, support, and recovery behavior cannot be declared ready. | Operations and security provide current configuration evidence and sign-off. | deployment |
| ASM-005 | Responsive layouts, keyboard operation, screen-reader behavior, contrast, and 200% zoom remain unproven. | The reported suite has no dedicated viewport, keyboard, axe, contrast, or zoom checks. | High | 001–004, 006–008 | Components and layouts may require revision. | Execute automated and human accessibility/responsive test matrix. | accessibility/mobile |
| ASM-006 | Final brand assets, formal tokens, palette approval, and icon policy remain pending. | Current visual patterns are confirmed, but final brand governance is not. | Medium | 003, 007 | Visual tokens/assets may be replaced or formalized. | Client brand approval and contrast review. | branding |
| ASM-008 | Whether user-facing inline document preview or removal should be introduced remains unresolved. | Neither action currently exists, and no approval to add it was supplied. | High | 005 | Later document states and capabilities may expand. | Explicitly approve or reject each capability with authorization/audit rules. | permissions |
| ASM-009 | General French microcopy may still require client review. | Protected terminology is authoritative, but other labels and messages are not finally signed off. | Medium | 001–006 | Non-protected labels and messages may change. | Client content review preserving protected terminology. | branding/reports |
| ASM-010 | A future dedicated read-only audit overlay remains unapproved. | Four production roles are authoritative; existing generic/legacy read-only mechanisms do not establish a fifth product role. | High | 001, 005, 006 | Navigation and audit/export presentation may change if an overlay is later approved. | Decide within the existing capability model without inferring a fifth role. | permissions |
| ASM-011 | Desktop-first design, tablet/mobile adaptation, and no offline mode are valid targets; actual mobile/tablet usability and usage conditions remain unproven. | Browser mix, data volume, connectivity, usage frequency, and current mobile/tablet usability are unknown. | Medium | 002, 006, 008 | Breakpoints, pagination, and performance guidance may change. | User/device/data-volume research and responsive testing. | mobile/deployment |

The remaining assumptions are not client decisions, permissions, security guarantees,
legal requirements, accessibility claims, or evidence of release readiness.
