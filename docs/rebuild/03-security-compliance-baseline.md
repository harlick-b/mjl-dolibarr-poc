# MJL rebuild security and compliance baseline

Status: **DRAFT FOR REVIEW**, version 1, 2026-10-22. Source verification:
2026-10-22. Scope: proposed React/FastAPI application, its data, operators,
suppliers and contractual evidence. No implementation conformity was assessed.

This document defines the MJL security and compliance requirements. It is not
itself evidence that the current implementation satisfies them.

## Authority and source register

Precedence is the latest user instruction, confirmed client requirements,
applicable Beninese law, PSSIE, ASIN RSPSL, MJL business invariants, then
implementation guidance. This ordering does not authorize overriding law.
Genuine normative conflicts require client/security/legal resolution. Compatible
stronger requirements remain; overlapping objectives share one control.

| Source | Authority and verified scope | Verification |
| --- | --- | --- |
| CLIENT | [Retained contractual input](../mjl-security-compliance-baseline-codex-prompt.md), section 5: seven original CLIENT identifiers; latest rebuild request section 22 enumerates 16 topics | Confirmed by user; signed original contract is not in this inspected source. Its deliverables remain mandatory. Older prompt's output-path and pre-PTA hierarchy instructions are superseded. |
| PSSIE | [SGG Décret n° 2021-550 du 27 octobre 2021 and annex](https://sgg.gouv.bj/doc/decret-2021-550/download), 55 PDF pages; annex revision 01.07.2021 | Official text retrieved. Articles 1-2 approve the policy and cover State systems and responsible third parties. Mandatory MJL baseline. |
| RSPSL | [ASIN Référentiel de sécurité pour la protection des services en ligne](https://asin.bj/doc/46/download), 226 PDF pages, currently linked by [ASIN](https://asin.bj/documents/) | Official requirement text retrieved. Section 2.2 covers governmental e-services and suppliers; CONF-PSSIE-01 complements PSSIE. Exact adoption date/version currency beyond current publication: SOURCE_VERIFICATION_REQUIRED. |
| LEGAL | [SGG Code du numérique publication register](https://sgg.gouv.bj/recherche/?begin=&end=&keywords=Code+du+num%C3%A9rique&type=loi): loi 2017-20 du 20 avril 2018, amended by loi 2020-35 du 6 janvier 2021 | Publication identities verified. Current consolidated personal-data/transfer/retention provisions and MJL applicability: SOURCE_VERIFICATION_REQUIRED. No unverified article numbers asserted. |
| MJL | [Authority router](../mjl-authoritative-decisions.md), [PTA brief](../mjl_codex_authoritative_pta_change_brief.md), DEC-087 through DEC-090, latest rebuild instruction | Business/security authority; POC code is evidence only. |
| GUIDANCE | [Target engineering standard](02-target-architecture-and-engineering-standard.md) and its official technical references | Proposed implementation guidance, not additional legislation. OWASP/ISO references in RSPSL do not make every recommendation a legal obligation; no automatic GDPR/PCI applicability. |

No existing generated security baseline was found; the retained prompt is input,
not a competing baseline. The frozen Dolibarr architecture remains historical.
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

A proposed FastAPI boundary uses opaque revocable server-side sessions and
HttpOnly/Secure cookies, with the CSRF/origin and deployment routing contract
in the engineering standard. Passwords use a maintained adaptive password hash,
not an obsolete fast-hash example from an annex. No browser storage of bearer
credentials. First Admin creation must be a guarded, one-time operator action
without default credentials or sample users; no such action occurs now.

Role separation applies on the server to every resource/action and again inside
sensitive transactional mutations. All Agents share approved internal visibility;
assignments coordinate work and notifications. Supervisor and Validator approval
stages, contributor-aware no-self-validation, exclusive identities, technical-only
Admin, and one-Partner read-only portal scope remain. Scope is never taken solely
from a browser-supplied identifier.

Validated accounting records remain immutable under CLIENT-INT-01. Final Operation
spending replaces the former itemized expense ledger under current PTA authority.
Do not recreate that ledger to satisfy immutability: preserve definitive financial
facts and their history, with linked, reasoned corrections/reversals. Exact
finalization and late discrepancy resolution require later business decisions.
Drafts are not universally immutable; Phase 5 accounting remains gated.
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
| MJL-SEC-02 | CLIENT-ARCH-01; CLIENT-API-01; rebuild | Browser/PWA client and FastAPI REST only; OpenAPI documents schemas, auth, errors, pagination/filtering and operation inventory. No external integration API is authorized. | Engineering; CODE, TEST, DOCUMENTATION: generated contract checks and direct denied-request cases; only a nonsensitive health query in foundation. |
| MJL-SEC-03 | CLIENT-SEC-01; MJL; RSPSL identity | Admin-only invitation, unique identity, activation/deactivation, single-use expiring invitation/reset tokens, guarded first Admin. Adaptive password hashing and abuse limits; no default credentials. | Backend/security; CODE, TEST, DATABASE: duplicate/replay/expiry/inactive/reset negative tests; controlled bootstrap evidence before auth use. |
| MJL-SEC-04 | CLIENT-SEC-01; MJL; RSPSL identity | Password plus email OTP before session creation; cryptographically random, short-lived, single-use challenges, bounded attempts/resends and no secret logging. Transport failure must not imply delivered OTP. | Backend/email operator; TEST, CONFIG, MANUAL_EVIDENCE: bypass/replay/rate-limit cases and actual mailbox receipt, not merely an SMTP acknowledgment. |
| MJL-SEC-05 | MJL session policy; CLIENT-SEC-01 | Server-owned session rotation/revocation; 24-hour idle and absolute limits; logout, disablement and credential/security-context changes invalidate access. Cookie/CSRF/CORS guards cover auth and mutations; no wildcard credentialed origins. | Backend/frontend; TEST, CONFIG: expiry, fixation, logout, cross-origin forgery, revoked-role and account-switch cases. |
| MJL-SEC-06 | CLIENT-SEC-01; MJL/PTA; RSPSL identity | Deny by default; role, object, organization, Partner, state and contributor checks on reads, exports and mutations. Admin has no business mutation; no self-validation even following role changes. | Backend/domain owner; TEST, DATABASE: guessed IDs, cross-Partner access, direct API bypass, role-change and stale-state negative cases. |
| MJL-SEC-07 | CLIENT-API-01; CLIENT-SEC-01; rebuild | Validate input and output contracts, parameterize queries, encode output, bound uploads/requests and avoid internal error leakage. Use explicit concurrency/version checks and replay protection where duplicate mutation harms integrity. | Backend/frontend; CODE, TEST: invalid input, injection, duplicate submission and concurrent stale mutation tests. No generic workflow/security framework. |
| MJL-SEC-08 | CLIENT-INT-01; MJL/PTA | Exact integer XOF, missing distinct from zero; immutable approved revisions and definitive financial facts; linked audited corrections preserve originals. Transaction-owned writes and audit, database constraints, no normal direct-DB edits/deletes. | Backend/business owner; DATABASE, TEST: rollback, concurrent approvals, post-validation edit/delete denial, no-self-validation and settlement invariants. Later exceptions need approved rules. |
| MJL-SEC-09 | CLIENT-SEC-01; MJL audit; official logging | Transactional append-only business audit; protected security-event logs, actor/time/reason/revision context, restricted audit exports, synchronized time. Never log passwords, OTPs, tokens or raw confidential payloads. | Backend/operations; TEST, CONFIG, OPERATIONS: mutation/audit rollback, log-access tests and redacted samples; retention decision required. |
| MJL-SEC-10 | CLIENT-SEC-01; PSSIE cryptography; RSPSL trust | TLS, sensitive-data and backup encryption, controlled certificate/key lifecycle and secret access/rotation. No committed real credentials or production keys. Determine national PKI obligations before deployment. | Operations/security; CONFIG, INFRA, EXTERNAL_EVIDENCE: TLS/key custody review, encrypted backup and rotation/restore evidence. No new cryptographic protocol. |
| MJL-SEC-11 | CLIENT-SEC-01; LEGAL; RSPSL data | Inventory/classify personal, finance, authentication, audit and uploaded data for confidentiality/integrity/availability. Minimize collection; agree lawful processing, rights, retention/deletion, notices and cross-border conditions. | Ministry data owner/legal/RSSI; GOVERNANCE, DOCUMENTATION: processing inventory, applicable-law assessment and approved retention/transfer decisions before real data. |
| MJL-SEC-12 | MJL Phase 4; CLIENT-SEC-01 | Optional documents stay private; fresh parent/Partner authorization on upload/download, file-type/size checks and safe delivery. No raw storage URL or confidential cache. Existing deny-all routes remain unchanged. | Backend/storage owner; TEST, INFRA: guessed path/ID and expired/revoked access denials; upload/content checks in separately authorized document slice. |
| MJL-SEC-13 | Rebuild PWA instruction; CLIENT-SEC-01 | Cache only public static assets. No confidential documents, authenticated API persistence, offline business database, queue or replay. Clear/isolate Query state on logout/account switch; handle expired sessions, stale worker versions and updates truthfully. | Frontend; TEST, CONFIG: inspect Cache Storage/browser cache policy, logout and switch tests, offline mutation rejection with no success claim. |
| MJL-SEC-14 | CLIENT-DOC-01; CLIENT-SEC-01; official SDLC | Focused review, lint/type/contract/authorization tests and dependency/secret checks. Use disposable isolated test data. Independent security review/tests and load-test reports before relevant delivery; no full suites required on each commit. | Engineering/security reviewer; CODE, TEST, CI_CD, DOCUMENTATION: release-bound reports, negative tests, remediation outcomes; security training evidence. |
| MJL-SEC-15 | CLIENT-MIG-01; clean-database decision | Deliver the migration assessment and non-regression record even though no production records exist. Do not import sample users/business data. Any future genuine source requires audit, mapping, cleanup, backup, reconciliation, rollback, secure temporary files and acceptance. | Client/product/data owner; DATA, CONTRACT, DOCUMENTATION: written empty-source/no-reprise interpretation and evidence, client confirmation; no migration job now. |
| MJL-SEC-16 | CLIENT-INFRA-01; PSSIE cloud; RSPSL production/admin | Approve provider/region, jurisdiction, network boundaries, private PostgreSQL/storage, hardened services and restricted secure administrative access. Assess public-service WAF/zoning and fixed administration IP obligations. No Kubernetes or multi-region assumption. | Ministry DSI/RSSI/hosting provider; INFRA, CONFIG, EXTERNAL_EVIDENCE: approved hosting/network/admin design and configuration checks before deployment. |
| MJL-SEC-17 | CLIENT-SEC-01; official vulnerability controls | Inventory dependencies/assets, evaluate vulnerabilities and track corrective action. Arrange independent security testing and qualified suppliers where required; evidence must match the actual release/environment. | RSSI/security provider/engineering; TEST, OPERATIONS, EXTERNAL_EVIDENCE: scan/pentest scope, qualifications, findings and verified corrections. See verified frequencies below. |
| MJL-SEC-18 | CLIENT-INFRA-01; CLIENT-MIG-01; official continuity | Backups must restore PostgreSQL and required private files consistently. Define business RTO/RPO, restore procedure, continuity and incident handling, escalation and evidence preservation. | Operations/Ministry; OPERATIONS, INFRA: restore demonstration, impact analysis, exercised plans and contacts; no invented availability target. |
| MJL-SEC-19 | CLIENT-INFRA-01; official supplier/cloud | Contractually allocate security, incident, audit, confidentiality, data return/destruction and exit responsibilities. Confirm supplier and security-product qualification requirements; document cloud dependency and connectivity decisions. | Ministry procurement/DSI/RSSI; CONTRACT, EXTERNAL_EVIDENCE: accepted provider terms, responsibility matrix and exit/incident arrangements. |
| MJL-SEC-20 | CLIENT-DOC-01 | Deliver architecture, administration/user guides, security/load reports, deployment scripts/process, data governance/dictionary, MCD, MLD, SPD, training and knowledge transfer. Clarify SPD meaning with client rather than inventing its contents. | Delivery lead/client; DOCUMENTATION, MANUAL_EVIDENCE: versioned deliverables, training/handover records and client receipt; later delivery, not scaffold completion. |

## Contractual coverage

**16/16 topics** in the rebuild request are traced below, covering **7/7 original
CLIENT clauses**. A topic is not a new contractual identifier. Documentation
coverage does not establish completion of the underlying deliverable.

| Rebuild topic | Original clause | Controls |
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
current dependency. CLIENT-MIG-01 proposed interpretation: assess the empty
production source, record no historical reprise, preserve POC/Git as reference,
and provide behavioral non-regression evidence. Client confirmation is required
for contractual delivery acceptance; no production data migration is fabricated.

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
local foundation blockers. None permits sensitive/public deployment by default.
The [gap analysis](../mjl-current-vs-target-gap-analysis.md) owns consolidated
open decisions; this table supplies security acceptance boundaries.

| Dependency | Owner / evidence needed | What it blocks; risk |
| --- | --- | --- |
| SEC-E1: source currency and legal applicability | Ministry legal/RSSI with ASIN/APDP: current RSPSL adoption/version, consolidated Code, processing/consent/rights/retention/transfer requirements, mobile-PWA interpretation | Real personal/sensitive data and relevant deployment; high. Source gaps remain SOURCE_VERIFICATION_REQUIRED, applicability remains TO_VERIFY. |
| SEC-E2: hosting and provider approval | Ministry DSI/RSSI/procurement: provider/region, jurisdiction/residency, national preference analysis, Ministry connectivity/admin restrictions, public-service classification, WAF/zoning, supplier qualifications/terms | Hosted staging with sensitive data and production; high. A popular development provider has no implied production approval. |
| SEC-E3: cryptography and identity operations | RSSI/DSI/email operator: national PKI/certificate route, keys/secrets ownership, approved mail and actual OTP delivery/assurance | Authenticated sensitive use and deployment; high. Local nonsensitive scaffold does not implement or enable OTP. |
| SEC-E4: operational security evidence | Ministry/host/security supplier: backup/restore, RTO/RPO, monitoring, incident escalation, recurring testing, access review and responsibilities | Production and any sensitive environment needing those safeguards; high. No speculative service topology required now. |
| SEC-E5: migration interpretation | Client sponsor/data owner: written acceptance of empty-source/no-reprise deliverable, source inventory and non-regression scope | Contractual migration acceptance or any later import; medium. Does not block empty local foundation. |
| SEC-E6: delivery/acceptance scope | Client delivery lead: SPD meaning, training/handover evidence, security/load acceptance scope and authorized risk acceptor | Relevant deliverable acceptance and production authorization; medium. Does not require load/security campaigns against a scaffold. |

Late financial discrepancy/correction authority and Partner document-field
visibility are LATER_PRODUCT_DECISION items owned by the business sponsor; they
block their product slices, not the health-only foundation. Auth, finance,
documents, operational tests and deliverables are POST_FOUNDATION_WORK until
separately authorized. The old session/bootstrap/ECM mechanisms are HISTORICAL_ONLY.

## Evidence, status and maintenance

Use NOT_ASSESSED, TO_VERIFY, EXTERNAL_DEPENDENCY, COMPLIANT,
PARTIALLY_COMPLIANT, NON_COMPLIANT, NOT_APPLICABLE (with factual rationale),
and ACCEPTED_RISK (named authorized acceptor and scope). Missing evidence is never
NOT_APPLICABLE. Accepted risk does not mean compliant. Source verification is a
separate dimension from implementation assessment.

Evidence domains: CODE, TEST, CONFIG, DATABASE, CI_CD, INFRA, OPERATIONS, DATA,
DOCUMENTATION, CONTRACT, GOVERNANCE, MANUAL_EVIDENCE, EXTERNAL_EVIDENCE.
Bind evidence to commit/build, deployment/environment, date, scope and reviewer;
old POC tests do not establish new-stack conformity. Code cannot prove hosting,
legal or organizational controls. Use the verified official frequencies above;
set other schedules with their owners instead of inventing them.

Revisit this baseline when law, PSSIE/RSPSL, contract, architecture, authentication,
data categories, provider, integrations or integrity rules change, or after a
material incident. Retain decision provenance. No compliance assertion is created
by this documentation review. The smallest foundation remains an empty local
stack with public health data, private database, static-only PWA caching and no
business mutation; separately authorize implementation before any scaffolding.
