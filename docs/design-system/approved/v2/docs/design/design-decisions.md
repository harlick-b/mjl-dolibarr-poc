# MJL Financement — Design Decisions

Status: proposed; not approved

Every decision below is generated-owned unless its classification is `context-confirmed`.

## MJL-DEC-001 — One guarded MJL workspace

- **Decision/classification:** Preserve one coherent custom-module shell and grouped navigation; `context-confirmed` plus proposed consolidation.
- **Rationale:** Users should complete normal work without competing raw ERP navigation.
- **Context:** French-first MJL shell, nine primary areas, guarded routes.
- **Knowledge/sources:** PD-KNOW-002, PD-KNOW-007; GOV.UK navigation clarity; W3C consistency.
- **Conflict/evidence:** Core browser and authorization journeys have substantial user-reported passing evidence, but full conformance is not established: 127 E2E passed, 1 failed, and 2 did not run; dedicated responsive/accessibility checks remain absent (EVID-001/002, ASM-005).
- **Implementation consequence:** Consolidate presentation within safe custom boundaries; no route/core change.
- **Validation:** Direct-route authorization, current-location, keyboard/focus, responsive drawer, role navigation E2E.
- **Status:** proposed.

## MJL-DEC-002 — Density follows task context

- **Decision/classification:** Use compact tables for repeated desktop comparison and spacious grouping for forms, errors, authentication, and confirmations; `proposed`.
- **Rationale:** MJL is data-dense but error-sensitive.
- **Knowledge/sources:** PD-KNOW-003, 005, 009, 010, 012, 013; Carbon operational guidance.
- **Conflict:** Resolves PD-CONFLICT-001 without averaging both modes.
- **Assumptions:** Experienced regular users and unknown data volume (ASM-011).
- **Implementation consequence:** Standard/compact density tokens and responsive row transformations.
- **Validation:** Scanability, keyboard actions, zoom, overflow, mobile card relationships.
- **Status:** proposed.

## MJL-DEC-003 — Status-first, non-color communication

- **Decision/classification:** Every consequential object/action presents textual status, stage, next action, and history; `context-confirmed`/`proposed`.
- **Rationale:** Validation and disbursement must never be confused.
- **Knowledge/sources:** PD-KNOW-004, 006, 014; W3C status/contrast guidance.
- **Conflict:** Semantic contrast overrides provisional branding (PD-CONFLICT-002).
- **Assumptions:** Final palette remains pending (ASM-006).
- **Implementation consequence:** Semantic tokens plus badges/icons/text; no color-only meaning.
- **Validation:** Contrast, accessible name, status announcement, workflow terminology checks.
- **Status:** proposed.

## MJL-DEC-004 — Consequential feedback persists

- **Decision/classification:** Correction, rejection, validation, disbursement, permission, and failed operations use persistent in-context feedback; `proposed`.
- **Rationale:** Users must recover and later understand consequential outcomes.
- **Knowledge/sources:** PD-KNOW-001, 004, 014; GOV.UK error recovery; Carbon state guidance.
- **Assumptions:** Notification delivery policy is not defined.
- **Implementation consequence:** Toasts limited to low-risk confirmation; errors survive navigation when needed.
- **Validation:** Error summary/field linking, focus, partial-error recovery, workflow E2E.
- **Status:** proposed.

## MJL-DEC-005 — Contextual evidence and history

- **Decision/classification:** Documents, comments, workflow decisions, and audit-visible events stay attached to their parent object; `context-confirmed`.
- **Rationale:** Context prevents disclosure and supports traceability.
- **Knowledge/sources:** Context authority; source guidance supplies no permission/audit policy.
- **Rules/assumptions:** Contextual upload plus guarded/audited download are authoritative; inline preview and removal are currently absent and remain unapproved (FACT-005, ASM-008).
- **Implementation consequence:** Guarded links, document checklist, timeline; no raw ECM path or global upload.
- **Validation:** Scope tests, missing/forbidden states, upload/download history.
- **Status:** proposed representation of confirmed constraint.

## MJL-DEC-006 — Role-specific actionable dashboards

- **Decision/classification:** Start each role with its work queue, risks, and decisions; `proposed`.
- **Rationale:** Dashboards must direct work, not decorate.
- **Knowledge/sources:** PD-KNOW-011; Carbon dashboard guidance.
- **Assumptions:** Final KPI wording, thresholds, and freshness remain pending.
- **Implementation consequence:** Every card states scope/period/definition/freshness and links to a scoped destination.
- **Validation:** Role relevance, empty/partial-error states, drill-down, no invented threshold.
- **Status:** proposed.

## MJL-DEC-007 — Provisional institutional foundation

- **Decision/classification:** Use the confirmed current navy/action/system-font/compact-spacing/picto baseline with explicit replacement points; `context-reported` and `provisional-brand-foundation`.
- **Rationale:** The package needs coherent tokens without claiming client-approved branding.
- **Knowledge/sources:** PD-KNOW-006, 008; no external palette or typography source.
- **Conflict:** Focus/semantic contrast overrides brand value.
- **Assumptions:** ASM-006.
- **Implementation consequence:** `#164f7a` critical focus ring; `#7fb3d5` nonessential emphasis only.
- **Validation:** Token contrast matrix, brand-status labels, anti-cloning.
- **Status:** proposed.

## MJL-DEC-008 — Framework-neutral incremental adoption

- **Decision/classification:** Specify tokens/components and migration sequence without production code or framework change; `proposed`.
- **Rationale:** The confirmed stack is Dolibarr/PHP with existing helpers and CSS.
- **Knowledge/sources:** Context technical constraints; no source code reuse.
- **Assumptions:** Runtime implementation details require target inspection later.
- **Implementation consequence:** Map neutral tokens into existing CSS only during a separate approved implementation.
- **Validation:** No code/config output, no route/schema/API change, protected E2E journeys.
- **Status:** proposed.
