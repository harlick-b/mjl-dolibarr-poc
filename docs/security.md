# Security requirements

Source verification date: 2026-10-22; requirements consolidated 2026-11-04.
This guide defines requirements, not evidence of compliance or production readiness.
Legal/source currency and external acceptance remain subject to the gates below.

## Authority and source register

Precedence is the latest user instruction, confirmed client requirements,
applicable Beninese law, PSSIE, ASIN RSPSL, MJL business invariants, then
implementation guidance. This ordering does not authorize overriding law.
Genuine normative conflicts require client/security/legal resolution. Compatible
stronger requirements remain; overlapping objectives share one control.

| Source | Authority and verified scope | Verification |
| --- | --- | --- |
| CLIENT | [Original client contractual input](#original-client-contractual-input): seven confirmed CLIENT clauses | Confirmed by user; signed original contract was not inspected. Deliverables remain mandatory. |
| PSSIE | [SGG Décret n° 2021-550 du 27 octobre 2021 and annex](https://sgg.gouv.bj/doc/decret-2021-550/download), 55 PDF pages; annex revision 01.07.2021 | Official text retrieved. Articles 1-2 approve the policy and cover State systems and responsible third parties. Mandatory MJL baseline. |
| RSPSL | [ASIN Référentiel de sécurité pour la protection des services en ligne](https://asin.bj/doc/46/download), 226 PDF pages, currently linked by [ASIN](https://asin.bj/documents/) | Official requirement text retrieved. Section 2.2 covers governmental e-services and suppliers; CONF-PSSIE-01 complements PSSIE. Exact adoption date/version currency beyond current publication: SOURCE_VERIFICATION_REQUIRED. |
| LEGAL | [SGG Code du numérique publication register](https://sgg.gouv.bj/recherche/?begin=&end=&keywords=Code+du+num%C3%A9rique&type=loi): loi 2017-20 du 20 avril 2018, amended by loi 2020-35 du 6 janvier 2021 | Publication identities verified. Current consolidated personal-data/transfer/retention provisions and MJL applicability: SOURCE_VERIFICATION_REQUIRED. No unverified article numbers asserted. |
| MJL | [Business rules](business-rules.md) and latest explicit user instructions | Product/security authority; code is implementation evidence only. |
| GUIDANCE | [Engineering guide](engineering.md) | Implementation guidance, not additional legislation. OWASP/ISO references in RSPSL do not make every recommendation a legal obligation; no automatic GDPR/PCI applicability. |

Official PDFs were read through extracted text; screenshot retrieval failed.
Only legible identifiers are used below. No assertion of exhaustive legal review,
certification, ASIN approval, or production readiness is made.

## Scope and interpretation

Protected assets are account identities, authentication secrets, PTA revisions,
financial declarations/decisions, audit records, exports, and optional documents.
Trust boundaries are browser to API, API to PostgreSQL/private storage, and
application to email/hosting operators. MJL owns the application; organizational
and Partner scopes are authorization inputs, not a generic SaaS tenancy model.

Authentication remains Admin invitation, password definition, email/password,
email OTP, then authenticated session. No public registration, LDAP/SSO, new
identity provider or remembered device. Maximum idle and absolute session
lifetimes are both 24 hours; expiry requires password and OTP again. Email OTP
is the approved mechanism, not a claim that independent evaluators accepted its
assurance level. Actual delivery and security acceptance remain required.

The FastAPI boundary uses opaque revocable server-side sessions and
HttpOnly/Secure cookies, with the CSRF/origin and deployment routing contract
in the engineering standard. Passwords use a maintained adaptive password hash,
not an obsolete fast-hash example from an annex. No browser storage of bearer
credentials. First Admin creation must be a guarded, one-time operator action
without default credentials or sample users.

Role separation applies on the server to every resource/action and again inside
sensitive transactional mutations. Unassigned Agents retain read access, while
only assigned Agents may edit, submit and execute Activities, including their
financial submissions/settlement declarations and evidence changes. Assignment
checks run inside the command transaction after acquiring the same lock as
reassignment, so a waiting request cannot use removed responsibility. Assignments also
coordinate work and notifications. Supervisor and Validator approval
stages and reviewer exclusions follow [business rules](business-rules.md), including
the planning creator exception and unchanged financial protections. Exclusive identities, technical-only
Admin, and one-Partner read-only portal scope remain. Scope is never taken solely
from a browser-supplied identifier.

Validated accounting records remain immutable under CLIENT-INT-01. Preserve
definitive financial facts, linked reasoned corrections and original audit history.
Drafts are not universally immutable. The business rules define current
finalization, financial returns, zero spending and additional funding; late
settlement exceptions and accounting entries require separate scope.
Unspent allocations require administrative reversement of
`max(0, approved allocation - final spending)`, never redistribution to another
Activity. Approved amendments pause only affected execution; distinct financial
authorizations and settlement prerequisites remain server-enforced.

## Normalized controls

The following **20 controls** are project identifiers, not invented PSSIE codes.
All are mandatory within their stated scope; conditional branches are explicit.
All initial implementation assessments are **NOT_ASSESSED**. External dependencies
are tracked separately so unknown evidence never becomes a compliance claim.
Source columns combine contractual/business objectives with official mappings
below. Requirements and verification are proposed MJL implementations unless
expressly identified as official wording in the source mapping.

| ID | Sources | MJL requirement and implementation boundary | Owner; required evidence and acceptance verification |
| --- | --- | --- | --- |
| MJL-SEC-01 | CLIENT-SEC-01; PSSIE; RSPSL | Maintain this security chapter, named risk/acceptance owners and data-specific risk assessment. Do not equate a passing test with acceptance. | Ministry sponsor/RSSI; DOCUMENTATION, GOVERNANCE, CONTRACT: approved scope, risk decisions and release acceptance record. |
| MJL-SEC-02 | CLIENT-ARCH-01; CLIENT-API-01; application | Browser/PWA client and FastAPI REST only; OpenAPI documents schemas, auth, errors, pagination/filtering and operation inventory. No external integration API is authorized. | Engineering; CODE, TEST, DOCUMENTATION: generated contract checks and direct denied-request cases. |
| MJL-SEC-03 | CLIENT-SEC-01; MJL; RSPSL identity | Admin-only invitation, unique identity, activation/deactivation, single-use expiring invitation/reset tokens, guarded first Admin. Adaptive password hashing and abuse limits; no default credentials. | Backend/security; CODE, TEST, DATABASE: duplicate/replay/expiry/inactive/reset negative tests; controlled bootstrap evidence before auth use. |
| MJL-SEC-04 | CLIENT-SEC-01; MJL; RSPSL identity | Password plus email OTP before session creation; cryptographically random, short-lived, single-use challenges, bounded attempts/resends and no secret logging. Transport failure must not imply delivered OTP. | Backend/email operator; TEST, CONFIG, MANUAL_EVIDENCE: bypass/replay/rate-limit cases and actual mailbox receipt, not merely an SMTP acknowledgment. |
| MJL-SEC-05 | MJL session policy; CLIENT-SEC-01 | Server-owned session rotation/revocation; 24-hour idle and absolute limits; logout, disablement and credential/security-context changes invalidate access. Cookie/CSRF/CORS guards cover auth and mutations; no wildcard credentialed origins. | Backend/frontend; TEST, CONFIG: expiry, fixation, logout, cross-origin forgery, revoked-role and account-switch cases. |
| MJL-SEC-06 | CLIENT-SEC-01; MJL/PTA; RSPSL identity | Deny by default; role, object, organization, Partner, state and contributor checks on reads, exports and mutations. Admin has no business mutation; enforce the current business-rule reviewer exclusions and explicit planning creator exception, including role-change cases. | Backend/domain owner; TEST, DATABASE: guessed IDs, cross-Partner access, direct API bypass, role-change and stale-state negative cases. |
| MJL-SEC-07 | CLIENT-API-01; CLIENT-SEC-01; application | Validate input and output contracts, parameterize queries, encode output, bound uploads/requests and avoid internal error leakage. Use explicit concurrency/version checks and replay protection where duplicate mutation harms integrity. | Backend/frontend; CODE, TEST: invalid input, injection, duplicate submission and concurrent stale mutation tests. No generic workflow/security framework. |
| MJL-SEC-08 | CLIENT-INT-01; MJL/PTA | Exact integer XOF, missing distinct from zero; immutable approved revisions and definitive financial facts; linked audited corrections preserve originals. Transaction-owned writes and audit, database constraints, no normal direct-DB edits/deletes. | Backend/business owner; DATABASE, TEST: rollback, concurrent approvals, post-validation edit/delete denial, no-self-validation and settlement invariants. Later exceptions need approved rules. |
| MJL-SEC-09 | CLIENT-SEC-01; MJL audit; official logging | Transactional append-only business audit; protected security-event logs, actor/time/reason/revision context, restricted audit exports, synchronized time. Never log passwords, OTPs, tokens or raw confidential payloads. | Backend/operations; TEST, CONFIG, OPERATIONS: mutation/audit rollback, log-access tests and redacted samples; retention decision required. |
| MJL-SEC-10 | CLIENT-SEC-01; PSSIE cryptography; RSPSL trust | TLS, sensitive-data and backup encryption, controlled certificate/key lifecycle and secret access/rotation. No committed real credentials or production keys. Determine national PKI obligations before deployment. | Operations/security; CONFIG, INFRA, EXTERNAL_EVIDENCE: TLS/key custody review, encrypted backup and rotation/restore evidence. No new cryptographic protocol. |
| MJL-SEC-11 | CLIENT-SEC-01; LEGAL; RSPSL data | Inventory/classify personal, finance, authentication, audit and uploaded data for confidentiality/integrity/availability. Minimize collection; agree lawful processing, rights, retention/deletion, notices and cross-border conditions. | Ministry data owner/legal/RSSI; GOVERNANCE, DOCUMENTATION: processing inventory, applicable-law assessment and approved retention/transfer decisions before real data. |
| MJL-SEC-12 | MJL evidence policy; CLIENT-SEC-01 | Optional documents stay private; fresh parent/Partner authorization on upload/download, file-type/size checks and safe delivery. No raw storage URL or confidential cache. | Backend/storage owner; TEST, INFRA: guessed path/ID and expired/revoked access denials; upload/content validation and revoked-sharing checks. |
| MJL-SEC-13 | PWA requirements; CLIENT-SEC-01 | Cache only public static assets. No confidential documents, authenticated API persistence, offline business database, queue or replay. Clear/isolate Query state on logout/account switch; handle expired sessions, stale worker versions and updates truthfully. | Frontend; TEST, CONFIG: inspect Cache Storage/browser cache policy, logout and switch tests, offline mutation rejection with no success claim. |
| MJL-SEC-14 | CLIENT-DOC-01; CLIENT-SEC-01; official SDLC | Focused review, lint/type/contract/authorization tests and dependency/secret checks. Use disposable isolated test data. Independent security review/tests and load-test reports before relevant delivery; no full suites required on each commit. | Engineering/security reviewer; CODE, TEST, CI_CD, DOCUMENTATION: release-bound reports, negative tests, remediation outcomes; security training evidence. |
| MJL-SEC-15 | CLIENT-MIG-01; clean-database decision | Deliver the migration assessment and non-regression record even though no production records exist. Do not import sample users/business data. Any future genuine source requires audit, mapping, cleanup, backup, reconciliation, rollback, secure temporary files and acceptance. | Client/product/data owner; DATA, CONTRACT, DOCUMENTATION: written empty-source/no-reprise interpretation and evidence, client confirmation; no migration job now. |
| MJL-SEC-16 | CLIENT-INFRA-01; PSSIE cloud; RSPSL production/admin | Approve provider/region, jurisdiction, network boundaries, private PostgreSQL/storage, hardened services and restricted secure administrative access. Assess public-service WAF/zoning and fixed administration IP obligations. No Kubernetes or multi-region assumption. | Ministry DSI/RSSI/hosting provider; INFRA, CONFIG, EXTERNAL_EVIDENCE: approved hosting/network/admin design and configuration checks before deployment. |
| MJL-SEC-17 | CLIENT-SEC-01; official vulnerability controls | Inventory dependencies/assets, evaluate vulnerabilities and track corrective action. Arrange independent security testing and qualified suppliers where required; evidence must match the actual release/environment. | RSSI/security provider/engineering; TEST, OPERATIONS, EXTERNAL_EVIDENCE: scan/pentest scope, qualifications, findings and verified corrections. See verified frequencies below. |
| MJL-SEC-18 | CLIENT-INFRA-01; CLIENT-MIG-01; official continuity | Backups must restore PostgreSQL and required private files consistently. Define business RTO/RPO, restore procedure, continuity and incident handling, escalation and evidence preservation. | Operations/Ministry; OPERATIONS, INFRA: restore demonstration, impact analysis, exercised plans and contacts; no invented availability target. |
| MJL-SEC-19 | CLIENT-INFRA-01; official supplier/cloud | Contractually allocate security, incident, audit, confidentiality, data return/destruction and exit responsibilities. Confirm supplier and security-product qualification requirements; document cloud dependency and connectivity decisions. | Ministry procurement/DSI/RSSI; CONTRACT, EXTERNAL_EVIDENCE: accepted provider terms, responsibility matrix and exit/incident arrangements. |
| MJL-SEC-20 | CLIENT-DOC-01 | Deliver architecture, administration/user guides, security/load reports, deployment scripts/process, data governance/dictionary, MCD, MLD, SPD, training and knowledge transfer. Clarify SPD meaning with client rather than inventing its contents. | Delivery lead/client; DOCUMENTATION, MANUAL_EVIDENCE: versioned deliverables, training/handover records and client receipt; delivery acceptance remains separate from implementation checks. |

## Contractual coverage

**16 contractual topics** are traced below, covering **7/7 original
CLIENT clauses**. A topic is not a new contractual identifier. Documentation
coverage does not establish completion of the underlying deliverable.

| Topic | Original clause | Controls |
| --- | --- | --- |
| PSSIE security chapter | CLIENT-SEC-01 | 01, 10, 11, 14, 16-19 |
| Encryption | CLIENT-SEC-01 | 03, 10 |
| Role/profile separation | CLIENT-SEC-01 | 05, 06 |
| MFA | CLIENT-SEC-01 | 04, 05 |
| Browser client-server application | CLIENT-ARCH-01 | 02, 13 |
| Documented REST API | CLIENT-API-01 | 02, 07 |
| Validated accounting immutability | CLIENT-INT-01 | 08 |
| Traceable reversal/correction | CLIENT-INT-01 | 08, 09 |
| Infrastructure obligations | CLIENT-INFRA-01 | 16, 18, 19 |
| Migration and non-regression documentation | CLIENT-MIG-01 | 14, 15 |
| Architecture and operational deliverables | CLIENT-DOC-01 | 20 |
| Security testing | CLIENT-DOC-01 | 14, 17 |
| Load testing | CLIENT-DOC-01 | 14, 20 |
| Deployment documentation | CLIENT-DOC-01 | 20 |
| Modeling and dictionary | CLIENT-DOC-01 | 11, 20 (including MCD, MLD, SPD) |
| Training and knowledge transfer | CLIENT-DOC-01 | 14, 20 |

CLIENT-INFRA-01 retains Ministry constraints, but LDAP/SSO is expressly not a
current dependency. CLIENT-MIG-01 requires an empty-source/no-reprise assessment and client acceptance
when no production data exists. Do not create data import tooling or backups of
nonexistent data. A real future import requires the safeguards listed below.

## Verified official traceability

References below are official identifiers as extracted, with PDF page numbers
(counting from 1). Descriptions are concise normative objectives; detailed MJL
mechanisms above derive from project requirements and engineering judgment.

| Official source / locator | Verified objective or condition | Controls |
| --- | --- | --- |
| PSSIE §§4.3-4.4, PDF 22-25 | Assets and logical access | 03-06, 11 |
| PSSIE EXP-08/09/10, PDF 35; EXP-11/12, PDF 36 | Backup/restore, logging/time, vulnerability monitoring | 09, 17, 18 |
| PSSIE ADM-01/02/04/06/07, PDF 37-38 | Secure lifecycle, acceptance, protected test data | 07, 14 |
| PSSIE §4.14, PDF 40 | Cryptography | 10 |
| PSSIE SCC-01/02/03, PDF 43 | Cloud risk assessment; prioritize national datacenters; guarantees for foreign providers | 16, 19 |
| PSSIE INC-01/02/04, PDF 44; §4.18, PDF 45 | Incident response/evidence and continuity | 18 |
| RSPSL CONF-PSSIE-01, PDF 9; GOUV-ESERV-01/02/03, PDF 10 | PSSIE alignment, governance, annual developer training | 01, 14 |
| RSPSL DEV-ESERV-01 through 09, PDF 11-13 | Classification, secure lifecycle, independent high-risk review, preproduction tests, test-data protection | 07, 11, 14 |
| RSPSL IDEN-ESERV-01 through 05, PDF 20 | Identity, least privilege, authorization, password strength, mandatory MFA | 03-06 |
| RSPSL CONF-ESERV-01/03, PDF 16 | Transaction certificates from national PKI; transit/rest encryption | 10 |
| RSPSL PROD-ESERV-01/02/03, PDF 17; ADMIN-ESERV-01 through 04, PDF 19 | Segmentation/hardening; public-web WAF/zones; restricted administration, outsourced fixed IP | 16 |
| RSPSL PROD-ESERV-05/06, PDF 18 | Pentests before service/major change/annually; scans monthly Internet-facing, quarterly otherwise | 17 |
| RSPSL CONT-ESERV-01/02, PDF 21 | Annual incident/continuity exercises; impact-based RTO/RPO | 18 |
| RSPSL APPRO-ESERV-01/02/03, PDF 21-22 | Qualified products/providers and contractual security | 19 |
| RSPSL DCP-ESERV-01 through 06, PDF 22-24 | Privacy applicability, notices, consent, impact assessment, minimization/protection | 11 |
| RSPSL EVENT-ESERV-01 through 04, PDF 25 | Logging, surveillance, confidentiality and log protection | 09 |
| RSPSL CLOUD-ESERV-01/02, PDF 26 | Exit clauses and communication redundancy | 18, 19 |

PSSIE is mandatory beyond application code. Physical facilities, workstation and
personnel controls require Ministry/provider evidence at deployment scope; this
application baseline does not claim those domains assessed or exempt.

For RSPSL, determine the precise applicability of mobile annex requirements to a
browser-installed PWA before sensitive mobile use; do not infer mandatory native
apps, app-store distribution or remembered devices. No payments or bank transfers
are performed by MJL, so payment-channel requirements are outside current scope;
administrative requests still need truthful timestamped acknowledgment. Electronic
signatures/high-assurance timestamps require their own approved use case. National
PKI, public-service network applicability and any interpretation conflict with
existing choices require RSSI/ASIN resolution, not silent substitution.

## External decisions and timing

These **six dependency groups** are EXTERNAL_SECURITY_DEPENDENCY findings, not
local development blockers. None permits sensitive/public deployment by default.
The [project status](project-status.md) owns consolidated
open decisions; this table supplies security acceptance boundaries.

| Dependency | Owner / evidence needed | What it blocks; risk |
| --- | --- | --- |
| SEC-E1: source currency and legal applicability | Ministry legal/RSSI with ASIN/APDP: current RSPSL adoption/version, consolidated Code, processing/consent/rights/retention/transfer requirements, mobile-PWA interpretation | Real personal/sensitive data and relevant deployment; high. Source gaps remain SOURCE_VERIFICATION_REQUIRED, applicability remains TO_VERIFY. |
| SEC-E2: hosting and provider approval | Ministry DSI/RSSI/procurement: provider/region, jurisdiction/residency, national preference analysis, Ministry connectivity/admin restrictions, public-service classification, WAF/zoning, supplier qualifications/terms | Hosted staging with sensitive data and production; high. A popular development provider has no implied production approval. |
| SEC-E3: cryptography and identity operations | RSSI/DSI/email operator: national PKI/certificate route, keys/secrets ownership, approved mail and actual OTP delivery/assurance | Production and externally accepted sensitive use; high. Local password/OTP and Resend mail are authorized; this is not RSSI/legal approval or live email-client evidence. |
| SEC-E4: operational security evidence | Ministry/host/security supplier: backup/restore, RTO/RPO, monitoring, incident escalation, recurring testing, access review and responsibilities | Production and any sensitive environment needing those safeguards; high. No speculative service topology required now. |
| SEC-E5: migration interpretation | Client sponsor/data owner: written acceptance of empty-source/no-reprise deliverable, source inventory and non-regression scope | Contractual migration acceptance or any later import; medium. Does not block local development. |
| SEC-E6: delivery/acceptance scope | Client delivery lead: SPD meaning, training/handover evidence, security/load acceptance scope and authorized risk acceptor | Relevant deliverable acceptance and production authorization; medium. Does not require load/security campaigns for documentation cleanup. |

Current local authentication, finance, Activity evidence and Partner sharing are
defined by the business rules. External acceptance and operational deliverables
remain open as listed above. Local real-account/Resend authorization does not
resolve legal/RSSI requirements or authorize production.

## Evidence, status and maintenance

Use NOT_ASSESSED, TO_VERIFY, EXTERNAL_DEPENDENCY, COMPLIANT,
PARTIALLY_COMPLIANT, NON_COMPLIANT, NOT_APPLICABLE (with factual rationale),
and ACCEPTED_RISK (named authorized acceptor and scope). Missing evidence is never
NOT_APPLICABLE. Accepted risk does not mean compliant. Source verification is a
separate dimension from implementation assessment.

Evidence domains: CODE, TEST, CONFIG, DATABASE, CI_CD, INFRA, OPERATIONS, DATA,
DOCUMENTATION, CONTRACT, GOVERNANCE, MANUAL_EVIDENCE, EXTERNAL_EVIDENCE.
Bind evidence to commit/build, deployment/environment, date, scope and reviewer;
checks from a different artifact do not establish current conformity. Code cannot prove hosting,
legal or organizational controls. Use the verified official frequencies above;
set other schedules with their owners instead of inventing them.

Revisit this baseline when law, PSSIE/RSPSL, contract, architecture, authentication,
data categories, provider, integrations or integrity rules change, or after a
material incident. Retain decision provenance. No compliance assertion is created
by documentation review. Scope changes require explicit authorization.

## Original client contractual input

The following seven clauses retain the confirmed client wording and identifiers.
The signed original contract was not inspected. Interpretations below govern
requirements, not proof of fulfillment. "No partner APIs" means no external
integration API; the approved Partner portal uses its own protected REST calls.

The following requirements come from the client document under the heading:

`Exigence contractuelle`

Treat them as confirmed contractual project requirements.

Do not describe them as assumptions.

### CLIENT-SEC-01 - Référentiel PSSIE

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

### CLIENT-ARCH-01 - Nature de l'application

Client wording:

> Spécifier clairement et de manière contraignante dans le cahier des charges que l'application devra être exclusivement une application web (architecture client-serveur accessible via navigateur).

MJL interpretation:

- MJL is a web application;
- the supported application architecture is browser-based client-server;
- do not introduce a mandatory native desktop or mobile client as part of normal MJL usage unless the project scope is formally changed.

### CLIENT-API-01 - Interopérabilité et extensibilité

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

### CLIENT-INT-01 - Intégrité des écritures comptables

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

### CLIENT-MIG-01 - Migration des données

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

### CLIENT-INFRA-01 - Infrastructure technique

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

### CLIENT-DOC-01 - Livrables techniques

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


### Business audit / security log boundary

Business audit and protected document-delivery/export evidence remain append-only
in PostgreSQL. Historical authentication records are preserved; routine new auth
records go to the bounded backend security output described in
[engineering](engineering.md#business-history-and-security-output).
Application logs are not exposed by History APIs. Provider/region, authorized
operator access, retention duration, expiration, persistence across deployments,
capacity/drop monitoring and incident-preservation procedure remain external
configuration/verification decisions. Application tests do not satisfy these gates.
Neither a per-worker volume cap nor an environment variable proves retention.
