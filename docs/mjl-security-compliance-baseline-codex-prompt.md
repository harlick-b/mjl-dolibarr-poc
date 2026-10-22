# MJL SECURITY AND COMPLIANCE BASELINE

## Retained source input

This prompt is preserved for contractual provenance. The consolidated draft is
[rebuild security baseline 03](rebuild/03-security-compliance-baseline.md).
Its old execution/output-path instructions do not create a second baseline or
override the 2026-10-22 rebuild request and latest PTA business rules.

# CODEX EXECUTION PROMPT

## OBJECTIVE

Create the authoritative MJL security and compliance baseline for the current repository.

The output must be a single Markdown file:

`mjl-security-compliance-baseline.md`

This task is primarily a SECURITY REQUIREMENTS AND TRACEABILITY task.

It is NOT a code remediation task.
It is NOT a penetration test.
It is NOT permission to redesign the application.
It is NOT permission to modify business behavior.
It is NOT permission to change authentication, roles, workflows, APIs, infrastructure, database structure, or deployment configuration.

You may inspect the repository, existing documentation, configuration, migrations, application code, tests, and deployment-related files to understand the current MJL context.

Do not modify application code.

The only expected repository change for this task is the creation or update of:

`mjl-security-compliance-baseline.md`

If you discover security issues while inspecting the repository, record only facts needed to understand scope. Do not remediate them and do not turn this task into the repository audit. The formal evidence-based implementation audit will happen in a separate task after this baseline has been reviewed and frozen.

Use normal execution mode, not plan-only mode.

---

# 1. AUTHORITATIVE PURPOSE OF THE DOCUMENT

The baseline must answer:

> What must be true for MJL to satisfy its confirmed project security and compliance obligations?

The document must NOT claim that MJL is currently compliant.

The document must define:

- the applicable requirements;
- their authoritative source;
- their interpretation for MJL;
- their scope;
- how they can be verified;
- the evidence that will eventually be required;
- known dependencies;
- unknown facts that still require verification;
- the difference between application-level, infrastructure-level, operational, contractual, and organisational requirements.

The baseline will later be used as the reference for a separate read-only audit of the current implementation.

The intended chain is:

```text
Official / contractual requirements
        ↓
MJL security and compliance baseline
        ↓
Read-only implementation audit
        ↓
Gap register
        ↓
Remediation plan
        ↓
Controlled implementation
        ↓
Verification and security acceptance
```

---

# 2. MANDATORY SOURCE HIERARCHY

The baseline must explicitly distinguish the following requirement families.

## 2.1 CLIENT

Formal contractual requirements from the client.

These requirements are mandatory for MJL even where they overlap with PSSIE or another standard.

Known contractual requirements are listed in section 5 of this prompt.

## 2.2 LEGAL / REGULATORY

Applicable Beninese legal and regulatory obligations, including relevant security and personal-data requirements.

Do not turn every law referenced by another document into a blanket software requirement.

Only include provisions that materially apply to MJL security, personal data, information systems, electronic services, or project acceptance.

## 2.3 PSSIE

The Politique de Sécurité des Systèmes d'Information de l'État approved by:

`Décret n° 2021-550 du 27 octobre 2021`

Treat PSSIE as a formal project requirement and the minimum State information-system security baseline applicable to MJL.

## 2.4 RSPSL / ASIN ONLINE-SERVICE SECURITY REQUIREMENTS

Use the current official ASIN:

`Référentiel de sécurité pour la protection des services en ligne`

This must complement PSSIE for web application, secure development, identity, authentication, application security, logging, infrastructure, vulnerability management, continuity, data protection, and related requirements.

Where the RSPSL references standards such as OWASP or ISO, distinguish:

- the ASIN requirement itself;
- a referenced standard;
- implementation guidance.

Do not falsely classify every recommendation from a referenced standard as a legal or contractual obligation.

## 2.5 MJL BUSINESS SECURITY INVARIANTS

Some MJL business rules also protect integrity, segregation of duties, traceability, or financial correctness.

Include those as MJL security invariants where relevant.

They may have multiple sources.

Example:

```text
MJL control
Sources:
- CLIENT requirement
- PSSIE / RSPSL
- MJL business rule
```

Do not duplicate one objective into several competing controls when a single normalized MJL control can trace to several sources.

---

# 3. SOURCE QUALITY RULES

Use authoritative sources.

For PSSIE, prefer the official Government of Benin / SGG publication.

For ASIN references, prefer official `asin.bj` publications.

For legal material, prefer official Beninese legal or regulatory publications where available.

Do not base a normative requirement solely on:

- a blog;
- an SEO page;
- a secondary summary;
- an unofficial copy;
- an LLM-generated interpretation.

If Internet access is unavailable, do not invent missing official wording or control identifiers.

In that situation:

1. use any official source material already present in the repository;
2. include only requirements whose source and meaning can be established reliably;
3. mark unresolved source extraction items clearly as `SOURCE_VERIFICATION_REQUIRED`;
4. explain the exact missing official source in the final execution report.

Do not fabricate PSSIE or RSPSL control IDs.

---

# 4. CRITICAL INTERPRETATION RULE

Never implement obsolete or unsafe technical examples literally merely because they appear in an older security document.

The baseline must distinguish:

- `Normative objective`
- `Source wording`
- `MJL interpretation`
- `Contemporary secure implementation expectation`

If an implementation example in an annex or historical guide conflicts with current secure engineering practice, preserve the normative objective while requiring a contemporary secure mechanism.

For example, an objective requiring secure password storage must not be interpreted as permission to use a weak or obsolete fast hash.

The baseline should point to modern secure implementation standards where useful, but it must not silently elevate implementation guidance to a contractual or statutory requirement.

---

# 5. CONFIRMED CLIENT CONTRACTUAL REQUIREMENTS

The following requirements come from the client document under the heading:

`Exigence contractuelle`

Treat them as confirmed contractual project requirements.

Do not describe them as assumptions.

## CLIENT-SEC-01 - Référentiel PSSIE

Client wording:

> Ajouter un chapitre complet sur la sécurité conformément à la PSSIE (chiffrement, séparation des profils, MFA).

MJL interpretation must cover at least:

- PSSIE compliance;
- encryption;
- profile / role separation;
- MFA;
- security requirements documented as an explicit project chapter / baseline;
- traceability between requirements and evidence.

Do not reduce "séparation des profils" to UI visibility.

Backend authorization is authoritative.

## CLIENT-ARCH-01 - Nature de l'application

Client wording:

> Spécifier clairement et de manière contraignante dans le cahier des charges que l'application devra être exclusivement une application web (architecture client-serveur accessible via navigateur).

MJL interpretation:

- MJL is a web application;
- the supported application architecture is browser-based client-server;
- do not introduce a mandatory native desktop or mobile client as part of normal MJL usage unless the project scope is formally changed.

## CLIENT-API-01 - Interopérabilité et extensibilité

Client wording:

> Spécifier des API REST documentées pour permettre de futures interconnexions avec d'autres systèmes du MJL ou les plateformes des bailleurs.

Confirmed project clarification:

- the current project contains REST APIs used by the MJL application itself;
- there are currently NO external/public/partner APIs in project scope;
- API documentation is required for the application's own REST API;
- do not create or expose new external APIs for this task;
- do not reinterpret this requirement as permission to expose every internal endpoint publicly;
- future external interconnection would require its own explicitly approved scope and security design.

The baseline should require appropriate documentation for the current application API, including security-relevant behavior where applicable.

## CLIENT-INT-01 - Intégrité des écritures comptables

Client wording:

> Exiger un mécanisme technique empêchant toute modification ou suppression d'une écriture comptable validée (journalisation en écriture d'annulation, pas de modification directe en base).

This is a critical MJL integrity invariant.

The baseline must require, at minimum:

- a definitively validated accounting / financial record cannot be directly edited;
- it cannot be directly deleted through ordinary application operations;
- correction occurs through a traceable cancellation / reversal mechanism;
- the original validated record remains preserved;
- cancellation/reversal references the original record;
- actor, timestamp, reason, and relevant state transitions are auditable;
- the rule is enforced server-side;
- UI restrictions alone are insufficient;
- direct database mutation is not a normal correction mechanism;
- exceptional administrative database intervention, if it can exist at all, must be governed by a separate controlled operational procedure and must not be represented as ordinary application functionality.

Do not incorrectly make all draft financial records immutable.

The immutability boundary applies after the relevant definitive validation state.

Where exact MJL state names differ, use repository terminology and document the mapping.

## CLIENT-MIG-01 - Migration des données

Client wording:

> Fournir un plan de migration détaillé : audit, nettoyage, reprise des historiques, backup, tests de non-régression.

The baseline must cover migration security and integrity, including where applicable:

- source inventory;
- pre-migration audit;
- data-quality analysis;
- cleanup rules;
- mapping and transformation rules;
- historical data recovery;
- backup before migration;
- reconciliation;
- migration execution traceability;
- non-regression testing;
- rollback/recovery strategy;
- controlled handling of temporary exports/dumps;
- secure disposal of temporary migration data;
- protection of credentials/secrets used by migration tooling;
- post-migration verification and acceptance.

Do not invent a migration implementation if none has been designed yet.

## CLIENT-INFRA-01 - Infrastructure technique

Client wording:

> Respecter les contraintes et obligations imposées par l'infrastructure du MJL (hébergement, connectivité, annuaire, SSO).

Confirmed project clarification:

- the Ministry may have LDAP or directory services;
- current MJL account creation DOES NOT depend on Ministry LDAP;
- account creation remains through the MJL in-application invitation process;
- current MJL authentication remains application-managed;
- do not redesign authentication around LDAP or SSO;
- do not leave LDAP/SSO as an implicit dependency of current authentication;
- if the client later formally requires federation, that is a future architecture change and must trigger baseline revision.

Infrastructure controls that genuinely depend on unknown target hosting/network parameters may remain `TO_VERIFY`.

## CLIENT-DOC-01 - Livrables techniques

Client wording requires delivery of:

- architecture technique documentation;
- administration guide;
- user guide;
- security test reports;
- load test reports;
- deployment script and associated deployment process;
- data modelling and governance;
- data dictionary;
- MCD;
- MLD;
- SPD;
- training;
- knowledge transfer.

The baseline must treat these as project deliverables and, where applicable, compliance evidence.

Do not manufacture evidence that does not exist yet.

---

# 6. CONFIRMED MJL AUTHENTICATION MODEL

The authentication architecture is NOT open for redesign in this task.

The current confirmed model is:

```text
Invitation
    ↓
Account activation / password definition
    ↓
Login with MJL credentials
    ↓
MJL OTP
    ↓
Authenticated session
```

MJL is invitation-only.

There is no public registration.

MFA is implemented through the MJL OTP step.

The baseline must define security expectations around the existing model, including where applicable:

- invitation-token security;
- password-definition security;
- secure password storage;
- password policy;
- login protections;
- OTP generation;
- OTP lifetime;
- OTP single-use behavior;
- OTP replay prevention;
- attempt limiting / abuse controls;
- session creation only after successful MFA;
- session lifecycle;
- logout / invalidation;
- security logging;
- prevention of secrets, passwords, OTPs, or authentication tokens leaking into logs;
- recovery/reset flow;
- disabled/inactive account behavior.

Do not change the authentication design.

Do not introduce LDAP authentication.

Do not introduce SSO.

Do not replace MJL OTP with another mechanism.

If the current repository behavior differs from this confirmed architecture, do not fix it during this task. The later audit must identify that gap.

---

# 7. CONFIRMED PROFILE SEPARATION / AUTHORIZATION MODEL

Profile separation is implemented through MJL roles in the UI, with authorization rules also enforced in the backend.

The baseline must explicitly state:

> UI role visibility is not the security boundary. Server-side authorization is authoritative.

The compliance model must cover:

- role-based access control;
- backend route/action enforcement;
- service/business-layer authorization where required;
- least privilege;
- segregation of duties;
- workflow-transition authorization;
- protection against direct API bypass;
- auditability of privileged operations;
- user/account activation state;
- prevention of self-validation where prohibited by MJL business rules;
- effective-role invariants already defined by the project.

Do not assume that the existence of role-specific menus proves compliance.

The later audit must be able to prove authorization through code and negative tests.

---

# 8. CURRENT MJL BUSINESS SECURITY CONTEXT

Preserve the current confirmed MJL business structure and security invariants.

The application structure includes:

```text
Partner
  ↓
Project
  ↓
Activity
  ↓
Operation
```

Relevant confirmed project rules include:

- one effective role per user;
- roles include Agent de saisie, Superviseur/Prévalidateur, Validateur définitif, and Admin;
- no self-validation by identity;
- financial validation rules and workflow invariants must be enforced server-side;
- XOF / F CFA is the project currency;
- validated financial/accounting records require integrity and traceability;
- cancellation and reopening rules must preserve auditability;
- audit must be transactional for relevant sensitive operations.

Do not reopen or redesign already confirmed business rules merely because this is a security task.

If current implementation differs, that belongs in the later audit.

---

# 9. BASELINE DOCUMENT STRUCTURE

Create `mjl-security-compliance-baseline.md` with the following major structure.

You may improve section titles slightly if needed, but preserve the substance.

## 1. Document Control

Include:

- title;
- baseline version;
- status;
- creation date;
- repository / project name;
- purpose;
- scope;
- explicit statement that this document defines requirements and does not itself prove compliance;
- last source-verification date;
- baseline-change rule.

Initial status should be:

`DRAFT FOR REVIEW`

Do not label it `FINAL` or claim certification.

## 2. Executive Scope

Explain concisely:

- why PSSIE is mandatory for MJL;
- why contractual, regulatory, ASIN, and MJL business requirements are normalized into one baseline;
- why code compliance alone cannot establish whole-system compliance;
- why evidence is release-specific.

## 3. Normative Source Register

Create a traceable table containing, where available:

- source ID;
- source family;
- official title;
- issuing authority;
- date/version;
- authority level;
- official reference or URL if reliably available;
- role in this baseline;
- source-verification status.

Include at least:

- client contractual requirements;
- PSSIE / Decree 2021-550;
- ASIN online-service security reference;
- applicable legal/regulatory sources identified during research;
- referenced implementation standards only where actually used.

Clearly distinguish official requirement sources from referenced standards.

## 4. Requirement Hierarchy and Conflict Rules

Define the hierarchy and interpretation rules.

Include:

- contractual obligations;
- legal/regulatory obligations;
- PSSIE;
- ASIN RSPSL;
- MJL business security invariants;
- implementation standards/guidance.

Explain that overlapping requirements should be normalized rather than duplicated.

Explain that stronger compatible requirements prevail where appropriate.

Do not invent a legal conflict-resolution doctrine. If two authoritative requirements genuinely conflict, mark the issue for human/legal/client resolution.

## 5. MJL Security Scope Profile

Document confirmed facts separately from unknowns.

Include at minimum:

### Confirmed

- browser-based web application;
- client-server architecture;
- invitation-only account creation;
- MJL-managed credentials;
- MJL OTP MFA;
- UI roles plus backend authorization;
- no public registration;
- REST API used by the application;
- no external/public partner API currently in scope;
- Ministry LDAP may exist but does not control MJL account creation;
- current authentication does not depend on LDAP/SSO;
- financial/accounting integrity requirements;
- required auditability;
- required technical deliverables.

### To Verify

Use repository inspection to resolve anything that can be factually determined.

Keep genuinely external unknowns explicit, such as potentially:

- final production hosting topology;
- WAF;
- network segmentation;
- production administrative access path;
- backup infrastructure;
- restore testing;
- monitoring/SIEM arrangements;
- vulnerability scanning operation;
- client network constraints;
- final disaster recovery environment;
- supplier security obligations not present in repository documentation.

Do not guess.

## 6. Data and Risk Classification Framework

Define what must eventually be classified for MJL.

At minimum cover:

- confidentiality;
- integrity;
- availability;
- personal data;
- financial/accounting data;
- authentication data;
- audit logs;
- documents/uploads if applicable;
- administrative/security data.

If the repository gives sufficient evidence for specific data categories, document them.

Do not invent business data that is not present.

Where a formal classification cannot yet be concluded, define the classification requirement and set status to `TO_VERIFY`.

## 7. Normalized MJL Security and Compliance Controls

This is the core of the document.

Do not merely paste PSSIE text.

Create normalized MJL controls grouped by domain.

Suggested domains:

### GOV
Security governance and accountability

### ARCH
Architecture and security-by-design

### IAM
Identity, invitation, authentication, MFA, sessions

### AUTHZ
Authorization, roles, least privilege, segregation of duties

### APP
Application and API security

### DATA
Data protection, minimization, confidentiality, integrity

### FIN
Financial/accounting integrity and immutable validated records

### CRYPTO
Encryption, keys, certificates, secrets

### LOG
Audit logging, security events, log protection

### SDLC
Secure development lifecycle, code review, dependencies, testing

### MIG
Data migration and historical recovery

### INFRA
Hosting, network, segmentation, WAF, administration

### VULN
Vulnerability scanning, penetration testing, remediation

### CONT
Backup, restore, resilience, business continuity

### INCIDENT
Incident detection and response

### SUPPLIER
Third parties, hosting providers, security providers

### DOC
Technical documentation, API docs, guides, diagrams, data documentation

### TRAIN
Training and knowledge transfer

Add or merge domains only when justified.

## 8. Contractual Traceability Matrix

Map every confirmed client requirement to one or more normalized MJL controls.

No contractual requirement from section 5 may disappear.

## 9. PSSIE / RSPSL Traceability Matrix

Map applicable PSSIE and RSPSL requirements to normalized MJL controls.

Preserve official control identifiers where known.

Do not fabricate identifiers.

Where exact source wording is long, summarize faithfully and provide the source reference.

## 10. Verification and Evidence Model

Define how compliance can eventually be demonstrated.

Separate evidence domains:

- CODE
- TEST
- CONFIG
- DATABASE
- CI_CD
- INFRA
- OPERATIONS
- DATA
- DOCUMENTATION
- CONTRACT
- GOVERNANCE
- MANUAL_EVIDENCE
- EXTERNAL_EVIDENCE

Explain that application code cannot prove infrastructure or organisational controls.

## 11. Compliance Status Model

Use these statuses:

`NOT_ASSESSED`

`COMPLIANT`

`PARTIALLY_COMPLIANT`

`NON_COMPLIANT`

`TO_VERIFY`

`NOT_APPLICABLE`

`EXTERNAL_DEPENDENCY`

`ACCEPTED_RISK`

Rules:

- the baseline itself should normally initialize controls as `NOT_ASSESSED`, `TO_VERIFY`, or `EXTERNAL_DEPENDENCY`;
- do not declare `COMPLIANT` merely because the requirement has been documented;
- `NOT_APPLICABLE` requires explicit factual justification;
- lack of evidence must not become `NOT_APPLICABLE`;
- `ACCEPTED_RISK` is not equivalent to compliance;
- residual-risk acceptance requires an identified authority.

## 12. Release and Evidence Binding

State that important evidence must be tied to a concrete release where applicable:

- commit;
- release tag;
- build;
- deployment version;
- test environment;
- date.

A security test of one commit does not automatically prove a later release.

## 13. Continuous Compliance Expectations

Separate one-time acceptance from recurring controls.

Examples may include, when required by authoritative sources:

- dependency/security checks during development;
- secret scanning;
- authorization regression tests;
- vulnerability scanning;
- penetration testing;
- access review;
- restore tests;
- incident-response exercises;
- baseline review after major architecture or regulatory change.

Do not invent frequencies. Use official frequencies where the authoritative source defines them.

## 14. Open Items / External Confirmations

List only genuinely unresolved items.

For each include:

- item;
- why it matters;
- requirement affected;
- required evidence or decision;
- owner if determinable;
- current status.

Do not list already resolved questions such as:

- whether MJL account creation uses LDAP;
- whether the project uses public registration;
- whether REST documentation currently means an external partner API.

Those have been clarified in this prompt.

## 15. Baseline Maintenance

Define triggers for baseline review, such as:

- new PSSIE/ASIN version;
- new applicable legal requirement;
- new contractual amendment;
- major architecture change;
- authentication architecture change;
- new external integration;
- new data category;
- production hosting change;
- major security incident;
- major workflow/security invariant change.

Do not silently delete historical requirements.

---

# 10. REQUIRED CONTROL TEMPLATE

Each normalized MJL control must contain enough information to support a later audit.

Use a compact but rigorous format such as:

```markdown
### MJL-IAM-001 - Invitation-only account provisioning

**Sources**
- CLIENT: ...
- PSSIE: ...
- RSPSL: ...

**Source type**
Contractual / Regulatory / PSSIE / RSPSL / MJL invariant / Referenced standard

**Requirement**
Normalized statement of what must be true.

**MJL interpretation**
Project-specific meaning without changing the normative objective.

**Applicability**
Mandatory / Conditional / To verify

**Applicability rationale**
Why it applies.

**Verification domains**
CODE, TEST, CONFIG, etc.

**Expected implementation characteristics**
What a conforming implementation should demonstrate.

**Required evidence**
Concrete evidence expected later.

**Acceptance tests / verification**
What should be tested or manually verified.

**Dependencies / external evidence**
If any.

**Initial assessment**
NOT_ASSESSED / TO_VERIFY / EXTERNAL_DEPENDENCY

**Notes**
Only when useful.
```

Do not bloat every control with repetitive prose.

Use tables where they improve traceability, but use detailed control blocks for requirements that need nuanced interpretation.

---

# 11. SPECIFIC SECURITY TOPICS THAT MUST NOT BE MISSED

The baseline must investigate applicable official requirements and include normalized controls for all materially relevant topics below.

## Identity and authentication

- invitation lifecycle;
- identity uniqueness;
- password handling;
- MFA;
- OTP security;
- authentication abuse protection;
- account activation/deactivation;
- password reset/recovery;
- session lifecycle;
- session invalidation;
- privileged accounts.

## Authorization

- least privilege;
- server-side enforcement;
- role separation;
- segregation of duties;
- direct API access;
- object/resource-level authorization;
- workflow transition authorization;
- self-validation prohibition where applicable;
- privileged/admin operations.

## Application security

- secure development lifecycle;
- secure coding;
- input validation;
- output encoding;
- injection prevention;
- request forgery protections where applicable;
- CORS where applicable;
- file upload security if applicable;
- secure error handling;
- dependency/security library management;
- source-code review;
- security acceptance before production.

## API

- documented application REST API;
- authentication requirements;
- authorization requirements;
- request/response schemas;
- error behavior;
- endpoint inventory;
- documentation access control where necessary;
- no automatic conversion of internal APIs into public integration APIs.

## Financial integrity

- validated-record immutability;
- cancellation/reversal model;
- history preservation;
- traceability;
- direct database mutation prohibition in normal operations;
- authorization of validation/cancellation;
- audit events;
- tests proving rejected mutation after definitive validation.

## Logging and audit

- login/security events;
- privileged actions;
- sensitive-data access where required;
- sensitive-data modification;
- validation/cancellation;
- account/role changes;
- audit integrity;
- log access protection;
- log retention requirements if authoritative source defines them;
- prevention of secrets/passwords/OTP/tokens in logs.

## Cryptography and secrets

- data in transit;
- sensitive data at rest where required;
- backups where required;
- secret storage;
- key lifecycle;
- certificate lifecycle;
- secure password hashing;
- no hard-coded production secrets.

## Data protection

- data inventory;
- minimization;
- classification;
- personal-data handling;
- sensitive data;
- production data in test environments;
- anonymization/pseudonymization where required;
- retention/deletion where applicable;
- access to sensitive datasets.

## Infrastructure and operations

- hosting constraints;
- network security;
- segmentation;
- WAF if required;
- administration path;
- secure administration protocols;
- production access restrictions;
- hardening;
- monitoring;
- backups;
- restore verification;
- continuity;
- RTO/RPO where required;
- vulnerability scans;
- penetration tests.

## Migration

- migration audit;
- cleanup;
- mapping;
- historical recovery;
- backup;
- reconciliation;
- non-regression tests;
- rollback;
- security of temporary migration files;
- migration traceability.

## Documentation and project handover

- architecture documentation;
- administration guide;
- user guide;
- REST API documentation;
- security test report;
- load test report;
- deployment procedure/scripts;
- data dictionary;
- MCD;
- MLD;
- SPD;
- training;
- knowledge transfer.

---

# 12. REPOSITORY INSPECTION RULES

Inspect the current repository only to:

- understand terminology;
- identify architecture that is already confirmed by code;
- identify existing documentation;
- understand current roles;
- understand current auth structure;
- understand financial/accounting entity names and workflow states;
- avoid writing requirements that use obsolete project vocabulary;
- identify what evidence types the later audit will need.

Do NOT use current implementation as the authority for what the requirement should be.

If implementation conflicts with confirmed requirements:

- keep the requirement correct;
- do not weaken it;
- do not fix the code now;
- optionally note that implementation conformity has not yet been assessed.

Do not conduct a full gap analysis in this task.

Do not generate a list of hundreds of code findings.

---

# 13. NO IMPLEMENTATION CHANGES

Hard constraint:

DO NOT modify:

- PHP source code;
- JavaScript;
- CSS;
- templates;
- database schema;
- migrations;
- seed data;
- tests;
- routes;
- APIs;
- authentication;
- authorization logic;
- deployment configuration;
- CI/CD configuration;
- infrastructure configuration.

The only intended change is the compliance baseline Markdown file.

If the repository already contains a document with the same purpose, update it carefully rather than creating conflicting sources of truth.

If a pre-existing security baseline has a different filename, inspect it and decide whether it should be superseded or referenced. Do not delete historical documentation without explicit authorization.

---

# 14. NO SAMPLE PRODUCTION DATA

Do not create persistent sample users, roles, accounting records, activities, operations, credentials, tokens, OTPs, or migration data.

Do not alter the database.

---

# 15. WRITING STYLE

The baseline must be suitable for:

- engineering;
- security review;
- project management;
- client acceptance;
- later audit work.

Use clear professional English unless existing authoritative MJL compliance documentation establishes French as the required language.

Preserve French official titles and contractual wording where useful.

Avoid vague statements such as:

- "use best practices";
- "secure the application";
- "ensure compliance";
- "protect sensitive data";

Translate them into verifiable security objectives.

Do not exaggerate certainty.

Do not say:

- "PSSIE certified";
- "fully compliant";
- "ASIN approved";
- "security guaranteed";

unless there is formal evidence, which is outside this task.

IMPORTANT MJL writing rule:

Do not use the em dash character.

Use commas, colons, parentheses, or standard hyphens instead.

---

# 16. SOURCE AND REQUIREMENT TRACEABILITY

Every significant normalized control must trace back to at least one source.

Every confirmed contractual requirement must map forward to at least one normalized control.

Applicable PSSIE/RSPSL requirements must map forward to normalized controls.

Avoid orphan controls and orphan source requirements.

A many-to-many relationship is allowed.

Example:

```text
CLIENT-SEC-01
       \
        -> MJL-IAM-004 MFA
       /
RSPSL-<official control>
```

and:

```text
CLIENT-INT-01
       \
        -> MJL-FIN-001 Validated financial record immutability
       /
MJL business invariant
```

---

# 17. WHAT TO DO WITH UNKNOWN INFORMATION

Never guess.

Use:

`TO_VERIFY`

when:

- the requirement definitely applies;
- but the implementation or evidence is not known.

Use:

`EXTERNAL_DEPENDENCY`

when:

- proof depends on Ministry infrastructure;
- hosting provider;
- security provider;
- contractual evidence;
- another external actor.

Use:

`SOURCE_VERIFICATION_REQUIRED`

only when:

- an official source or exact normative wording could not be reliably retrieved.

Do not use `NOT_APPLICABLE` simply because information is missing.

---

# 18. BASELINE VS AUDIT

The finished baseline must contain an explicit warning:

> This document defines the MJL security and compliance requirements. It is not itself evidence that the current implementation satisfies them.

The later repository audit will:

- inspect implementation;
- identify concrete evidence;
- classify conformity;
- produce findings;
- propose remediation.

Do not merge those two stages.

---

# 19. REQUIRED FINAL VALIDATION BEFORE COMMITTING THE FILE

Before finishing, perform an internal consistency review.

Verify all of the following:

1. Every contractual requirement in this prompt is present.
2. PSSIE is explicitly mandatory for MJL.
3. PSSIE and RSPSL are not incorrectly treated as identical.
4. Referenced standards are not falsely presented as law.
5. Current MJL OTP authentication is preserved.
6. LDAP/SSO is not introduced as the current identity architecture.
7. Invitation-only account provisioning is preserved.
8. Profile separation includes backend enforcement.
9. REST API documentation is scoped to the application's current REST API.
10. No new external API is invented.
11. Validated accounting record immutability is explicit.
12. Draft records are not accidentally made immutable without business justification.
13. Cancellation/reversal is distinct from direct mutation.
14. Migration security is covered.
15. Non-code compliance domains are represented.
16. `NOT_APPLICABLE` requires justification.
17. Evidence is separated from requirements.
18. Release-specific evidence is addressed.
19. Unknown facts remain explicit.
20. No application code was modified.
21. No database was modified.
22. No persistent sample data was created.
23. The document contains no em dash characters.
24. The document does not claim formal certification or completed compliance.
25. Any PSSIE/RSPSL control identifiers used were verified and not invented.

If any check fails, correct the document before finishing.

---

# 20. EXPECTED OUTPUT

Create:

`mjl-security-compliance-baseline.md`

Do not create additional implementation code.

At the end of execution, report concisely:

1. file created or updated;
2. official sources successfully verified;
3. sources that could not be verified;
4. number of normalized MJL controls created;
5. number of contractual requirements traced;
6. important `TO_VERIFY` items;
7. confirmation that no application code, schema, configuration, or persistent data was changed.

Do not begin remediation after producing the baseline.

Stop after the baseline and execution report.
