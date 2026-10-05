# Preservation ledger

This ledger names behavior that a future refactor must preserve or replace through an explicit product decision. `SOURCE_VERIFIED` means the behavior is established by source inspection; it does not imply runtime acceptance.

| ID | Behavior | Primary owner | Evidence/status |
| --- | --- | --- | --- |
| RT-001 | bootstrapped application routes load Dolibarr through `main.inc.php`; deny-only and dynamic-asset endpoints may intentionally avoid it | route layer | SOURCE_VERIFIED |
| RT-002 | route files enforce access before rendering or mutation | route layer | SOURCE_VERIFIED |
| RT-003 | state-changing requests require Dolibarr CSRF/token validation | route layer | SOURCE_VERIFIED |
| RT-004 | sensitive workflow commands reauthorize under database locks | `MjlActivityCommand` and assignment commands | SOURCE_VERIFIED |
| RT-005 | Activity is the write aggregate for planning, revisions, review, execution and exceptions | `MjlActivityCommand` | SOURCE_VERIFIED |
| RT-006 | no-self-validation and distinct validation actors remain enforced | command/domain layer | SOURCE_VERIFIED |
| RT-007 | integer XOF and aggregate financial invariants remain authoritative on the server | command/domain layer | SOURCE_VERIFIED |
| RT-008 | stale/version-bound requests fail instead of overwriting newer state | command layer | SOURCE_VERIFIED |
| RT-009 | cancellation cascades and reopening rules preserve terminal-state integrity | command/reconciler | SOURCE_VERIFIED |
| RT-010 | monitoring reads use active-entity and role scope | `MjlMonitoring` | SOURCE_VERIFIED |
| RT-011 | schema readiness selects current, predecessor, or unavailable behavior explicitly | readiness libraries/routes | SOURCE_VERIFIED |
| RT-012 | exports use a repeatable snapshot, private spool, fresh locks and audit/export records | export layer | SOURCE_VERIFIED; delivery completion unresolved |
| RT-013 | current custom document endpoints deny every request without storage access | document routes | SOURCE_VERIFIED |
| RT-014 | native Societe, Project, User, module, PDF and spreadsheet adapters remain at defined boundaries | adapter calls | SOURCE_VERIFIED; reference transaction failure contract now directly tested |
| RT-015 | hourly reconciliation remains module-gated and idempotence-aware | cron/reconciler | SOURCE_VERIFIED; multi-entity/fail-fast behavior unresolved |
| SEC-AUTH-001 | access remains invitation-only with Admin as the only invitation sender | auth lifecycle | SOURCE_VERIFIED |
| SEC-AUTH-002 | invitation tokens are selector/verifier pairs with only a verifier digest stored | auth lifecycle | SOURCE_VERIFIED |
| SEC-AUTH-003 | password reset responses do not disclose account existence and are throttled; the retained native Admin can recover through an active-entity reset without weakening business-user entity isolation | auth lifecycle | SOURCE_AND_DISPOSABLE_E2E_VERIFIED |
| SEC-AUTH-004 | OTP is configuration-gated, short-lived, attempt-limited, resend-limited and bound to the login context | login hook/OTP store | SOURCE_VERIFIED |
| SEC-AUTH-005 | active OTP state rejects the native login path until verification completes | login hook | SOURCE_VERIFIED |
| SEC-AUTH-006 | password changes must never persist a reusable cleartext credential in the native legacy password column | auth/native User adapter | REQUIRED; OPEN HIGH blocker |
| SEC-AUTHZ-001 | native technical Admin maps to ADMIN while business users have exactly one effective MJL role | scope/access layer | SOURCE_VERIFIED |
| SEC-AUTHZ-002 | role and account changes are Admin-only, transactional and revoke affected credentials | access administration | SOURCE_VERIFIED |
| SEC-AUTHZ-003 | Agent visibility derives from explicit Activity assignment and active entity | scope/assignment layer | SOURCE_VERIFIED |
| SEC-AUTHZ-004 | UI eligibility, route checks, command checks and DB invariants stay layered by trust boundary | all access layers | SOURCE_VERIFIED |
| SEC-DOC-001 | current document endpoints remain dependency-free deny-only containment surfaces | document layer | SOURCE_VERIFIED |
| SEC-DOC-002 | raw public ECM links remain blocked; future authorized delivery requires a separate Phase 4 decision | routes/UI | SOURCE_VERIFIED current denial; target deferred |
| DB-001 | active-entity isolation remains a required invariant; mapped critical query paths apply it, with a narrow native entity-0 Admin reset exception stored in the active entity | schema/query layer | SOURCE_AND_DISPOSABLE_E2E_VERIFIED for reset; exhaustive write-site proof unresolved |
| DB-002 | audit history remains append-only and transaction-bound to the mutation it records; reference writes must not continue outside a failed outer transaction, and a connection whose rollback fails must be closed before reuse | audit writer/triggers | SOURCE_VERIFIED; reference failure and rollback-quarantine contract passed |
| DB-003 | critical role, immutability and entity invariants remain backed by exact database definitions | triggers/activation | SOURCE_VERIFIED |
| DB-004 | activation remains resumable and guarded against partial or conflicting schema states | module lifecycle | SOURCE_VERIFIED |
| LIFE-001 | a clean bootstrap preserves exactly one native technical administrator and no persistent business fixtures | bootstrap | SOURCE_VERIFIED |
| LIFE-002 | disposable tests create minimal isolated data and tear down their tenant | test runners/fixtures | SOURCE_VERIFIED |
| LIFE-003 | module activation detects predecessor/current schema instead of silently assuming it | descriptor/readiness | SOURCE_VERIFIED |
| LIFE-004 | unsupported native modules are disabled only through the documented bootstrap path | bootstrap | SOURCE_VERIFIED |

Any change touching a ledger item needs a focused proof at its actual trust boundary. A UI assertion alone cannot replace a command, database, authorization or document-containment proof.
