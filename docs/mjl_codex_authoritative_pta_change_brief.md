# MJL — Authoritative post-client-meeting business change brief

**Recipient:** Local Codex, working in the existing MJL repository  
**Status:** New authoritative business decisions; supersede all conflicting earlier MJL rules  
**Purpose:** Audit, design the implementation plan, and subsequently implement approved phases  
**Not a visual-design prompt.** Online Work will produce the new visual reference separately.

## 1. Execution instructions

1. Read `AGENTS.md`, the repository's authority router and authoritative decisions (including `docs/mjl-authoritative-decisions.md` if present), the frozen architecture/engineering standard, relevant RST/phase plans, and the current implementation. Identify their *actual* status before touching code.
2. Treat the business decisions **in this brief as newer than conflicting previous Activity/PTA/finance/permission rules**. Preserve unrelated security and engineering standards. Identify and explicitly list every superseded rule, screen, endpoint, model assumption, permission and test.
3. **First execution: audit and propose a dependency-ordered implementation plan only. Do not implement before approval.** Include data/model impact, migrations (no invented backward compatibility for an application not yet live), authorization, audit, API/domain workflows, notifications, documents, PDF generation, Partner access, UI impact, verification and rollout. Codex chooses coherent implementation phases; do not implement everything in one batch.
4. Following explicit approval, implement one approved phase at a time, with regression tests and an end-of-phase report. Stop after each phase. Respect existing phase authorization gates, especially any document-management security gate. Do not open guarded document endpoints early.
5. If this brief conflicts with an unambiguous technical or legal requirement, identify the conflict and ask, rather than silently overriding controls. Do not infer missing financial permissions or create unrequested features.

## 2. Core domain and PTA planning

- Structure: **Partenaire → Projet → PTA (per calendar year) → Activités → Opérations**.
- **Validateur définitif** creates and closes Projects. A Partner has **at most one active Project** at a time; retain all past Projects. A Project may span multiple years and has **one PTA per relevant calendar year**.
- The PTA is the annual planning collection. An **Agent de saisie enters Activities and their original details through the PTA**, including planning dates, allocated amount, one or more Operations and their authorized allocations. **No independent Activity creation bypassing a PTA.** Activity authorized allocation equals the sum of its Operation authorized allocations; no zero/negative Operation allocation. Preserve XOF-only business scope, displayed `F CFA`.
- All Agents have **identical visibility and editing rights across all PTAs and Activities**, replacing the old “currently assigned Activities only” restriction. Activities may still have one or more assigned Agents. **Superviseur and Validateur définitif** manage those assignments; assignment is coordination/notification metadata, **not Agent access control**.
- Validation is **per Activity within a PTA**. The Agent submits; Superviseur can prevalidate some Activities and return others; Validateur can definitively approve those eligible while other Activities are still in correction. A Validateur's correction request goes **straight to Agent**; after structural modification and resubmission, the Activity needs **fresh Superviseur prevalidation and Validateur approval**. Retain no-self-validation safeguards unless a newer express decision removes them.
- A definitively approved PTA Activity can be added to, modified, postponed or withdrawn via a **formal PTA revision** with the same two-level approval for affected content. Preserve old approved revisions, actors, reasons, changes and decisions. Unaffected approved Activities can proceed independently. Never silently delete an Activity with administrative history.
- Activity details may be changed **after its planned end date**, via the applicable controlled revision process. Remove the former post-start/end hard prohibition. Record temporal changes and retain approved history.
- Activity belongs to the PTA for its **planned start year**. Cross-year postponement to a different start year requires an auditable transfer between annual PTAs, preserving history. An Activity starting late in one year and ending in the next remains in the original PTA until such a formal change.
- Default **end date = start date + 3 calendar months**, for **all Partners**, including UNICEF. Auto-suggest it but **allow authorized editing**; don't overwrite a manually chosen end date unexpectedly.

## 3. Physical execution, spending and administrative authorizations

The user-facing product has two distinct operational modules:

1. **Prévisions d'activités (PTA)**: annual planning, per-Activity validation, amendments and approvals.
2. **Réalisation d'activités**: execution of **approved, scheduled** Activities only. Never independently create an executable Activity.

Workflow for an eligible Activity:

1. Agent records physical work as complete and final **actual expenditure per Operation**; the Activity's `Montant dépensé` is the sum of explicit numeric Operation spending. Preserve `Non renseigné` vs explicit `0 F CFA`; do not infer missing values as zero. Documents may be attached contextually, but their absence is not by itself a blocker.
2. Any funding insufficiency must be addressed **before starting décaissement**: a formal PTA budget revision (with approvals) **and a distinct financial authorization** are required. Once financial settlement starts, do not silently modify its approved budget basis. If a genuine late exception arises, report it for controlled resolution rather than invent an automatic adjustment.
3. **Demande d'autorisation de décaissement**: Agent initiates for the finalized **actual amount needed/spent**, **not the entire approved allocation**; Superviseur approves then Validateur définitif approves. This is an administrative authorization, **not an in-app financial transfer**.
4. **Demande de virement**: separate Agent request for the actual amount needed, followed by Superviseur and Validateur approvals. Normally one request per Activity, but **do not impose an irreversible one-request database restriction**; leave room for future evolution.
5. **Confirmation de virement**: Agent declares that the external transfer occurred; record **actual amount and date**, with optional bank justificatif. MJL does not initiate or independently verify the banking transaction. Preserve any discrepancy between requested/authorized and confirmed amounts, and surface unresolved discrepancies rather than treating them as equal.
6. **Reversement of unused budget (mandatory)**: calculate `montant_à_reverser = max(0, montant_autorisé_courant − montant_dépensé_final)`. If positive, automatically initiate an **administrative reversement requirement** to the Partner. Reversement occurs **outside MJL**. Agent records its completion, declared amount/date and optional justificatif. Distinguish **à reverser** from **effectivement reversé**. Required reversement must be fully settled before closure; do not equate “workflow started” with “reversement completed.” **No transfer/reallocation of unused funds to another Activity in MJL.**
7. **Clôture de l'activité**: after required workflow checks (operational work complete, final Operations spending, approval chain, external virement confirmation, mandatory reversement completed if applicable, no unresolved settlement discrepancy), the **Agent closes directly**, with **no extra Superviseur/Validateur closure approval**. Only **closed** Activities count as physically realized.

**Illustration (not seed data):** budget authorized `3 000 000 F CFA`, final spent `2 700 000 F CFA`; décaissement request `2 700 000`, virement request `2 700 000`, external virement confirmation `2 700 000`, automatically required reversement `300 000` to Partner, externally performed and declared before closure. Preserve a clear reconciliation in the Activity and Fiche.

## 4. Administrative records and documents

- Every material action and decision is auditable: creation, submissions, per-Activity prevalidation/final approval, returns with reasons, PTA revisions, date/budget changes, assignment changes, execution data, financial authorizations, external transfer declarations, required reversement and closure. Record **who, when, what, previous/new values, revision, affected entity, reason** when relevant. Audit events must not be silently editable.
- For each Activity, generate a **Fiche récapitulative (PDF)** with administrative evidentiary value: Activity/PTA/Project context, current approved values, Operations, actual spending, approval and correction chronology, decisions, authorized/requested/confirmed amounts, `Montant à reverser` and `Montant reversé`, supporting-document references and generation date. PDF can be **regenerated using current authoritative data**; immutable underlying audit remains the proof history. No additional electronic-signature system is required by this brief.
- Administrative documents are contextual to PTA, Activity, revisions, approvals, requests, transfer confirmations and reversement where appropriate; permit guarded upload, preview/download and audit. Documents are **optional and not automatic blockers**. Do not invent mandatory attachments. Respect any existing Phase 4 document security/authorization freeze and plan dependencies instead of bypassing them.
- **Full audit-history exports** remain limited to **Validateur définitif and Admin**.

## 5. Deadlines, notifications and metrics

- **Administrative relance** is due **21 calendar days before the current Activity end date**. Send to **all assigned Agents** via **in-app/PWA notification and email**. Recalculate if end date/assignments change; avoid duplicate delivery, handle already-due Activities and stop future reminders for closed Activities. Follow the existing delivery infrastructure and browser push/permission requirements; do not claim delivery without confirmation.
- Role-appropriate dashboard KPIs, calculated for the **whole annual PTA** using only definitively approved Activity/budget revisions:
  - **Taux d'exécution physique** = `number of closed Activities / number of approved planned Activities × 100`.
  - **Taux d'exécution financière** = `sum of final spending for closed Activities / total definitively approved PTA allocation × 100`.
- Pending draft/revised amounts are not official denominator values. Handle a zero denominator as **non-calculable** rather than dividing by zero, and do not silently cap valid >100% anomalies. Preserve correct historical/annual attribution and report date context.

## 6. Partner portal and permissions

- Build a **separate read-only Partner portal** (same MJL design system, simpler navigation). Partner accounts are **invited by Admin**, linked to **exactly one Partner**, and reuse **email/password + email OTP** authentication. This is not self-registration and does not give Partners internal Agent/Superviseur/Validateur powers.
- Partners **cannot create or close Projects or modify PTA/Activities**. They may consult their own current/past Projects, approved PTA, Activity/Operation progress, Fiches, allowed justificatifs, budget revision requests, correction reasons and individual administrative decisions, and export authorized Partner-scoped records. Partners must **never** access another Partner's records, files, generated PDFs or exports.
- The **read-only Partner portal export** is separate from **global audit-history export**, which remains Validateur/Admin only. Enforce scope server-side, including direct URLs and document endpoints.
- Preserve the existing Admin, Agent, Superviseur and Validateur roles; update the permission model to allow Partner portal identity without accidentally introducing internal role switching or multi-role escalation.
- Authentication remains **invitation-only, email/password followed by email OTP**, using the existing secure MJL Auth experience.

## 7. Required Codex deliverables

On the **first run**, produce a **concise but complete architecture and phased implementation plan**, including:

- Authority/source conflict register: new decisions vs obsolete code and docs, with explicit removals.
- Target domain entities and state transitions (PTA, per-Activity revisions, Operation spending, independent approval requests, transfer declarations, mandatory reversement, closure, Partner access); avoid one giant ambiguous `status` field.
- Changes to existing tables/migrations, APIs, services and transactional audit; preserve money as exact XOF integers and distinguish missing from zero.
- Role/authorization matrix including unrestricted Agent access and Partner scoping; explicit validation guards and anti-self-approval controls.
- External side-effect architecture: email/PWA notifications, PDF Fiche, document storage/preview, evidence and export protection.
- Dependencies on already frozen/authorized architecture, PSSIE/security requirements and Phase 4 document management; do not silently enable denied routes.
- Domain and integration tests, seeded **test-only** scenarios, accessibility, reusable design-system components and skeleton loading during eventual UI implementation.
- A reviewable order of work with **clear approval stops after each phase** and no fake front-end state transitions.

**First run deliverable = audit + plan, not code changes.** After approval, implement sequentially, verify, report, and stop. Do not create Online Work visuals in this Codex assignment.

## 8. Non-negotiable exclusions

No independent Activity creation outside PTA. No Agent assignment-based read/edit restriction. No blanket prohibition on modifying an Activity after its start/end date. No transfer or reallocation of leftover funds to another Activity. No in-app bank transfer, payment execution or reversement execution. No closure approval stage beyond the confirmed direct Agent closure. No invented mandatory document requirement. No public registration. No unauthorized global audit export. No obsolete compatibility features retained solely for legacy behavior.

**New decisions in this brief take precedence over conflicting earlier MJL rules. Verify the existing repository before planning; preserve unrelated security, confidentiality and engineering controls.**
