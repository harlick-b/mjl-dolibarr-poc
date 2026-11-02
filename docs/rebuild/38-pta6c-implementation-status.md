# PTA-6C implementation status

**PTA_6C_COMPLETE** on 2026-11-02.

## Implemented boundary

`POST /api/v1/reports/audit/exports` accepts the single `csv` format for a
currently authorized Validateur définitif or Admin with CSRF protection. Under
the shared lifecycle lock it captures the database timestamp and exact ordered
audit-event IDs in one statement, refuses histories above 10,000 rows, projects
only the sanitized PTA-6B fields and returns a UTF-8 BOM, semicolon-separated,
French-headed, formula-safe attachment.

Successful generation records export ID, snapshot time, row count, byte count
and SHA-256 in the existing append-only audit transaction. Audit failure rolls
back delivery. The export event follows the captured snapshot and therefore does
not appear in its own file. The React history screen performs one online-only,
non-retrying download and refetches the active history so the export event is
visible. PDF/XLSX, stored artifacts, jobs and generic reporting remain outside
this slice.

## Verification evidence

- Final backend image
  `sha256:2964f804491a56a2d646fe9c71aa4c7c5faa5ef4d31ec63df9f92d2e8dd93e70`:
  Ruff format/lint and strict mypy passed for 28 source files.
- Twelve focused disposable-PostgreSQL/API/OpenAPI checks passed in 53.22
  seconds on the implementation candidate. They cover Validator/Admin access,
  Agent/Supervisor and CSRF denial, exact concurrent snapshot membership,
  deactivation-before-export serialization, BOM/semicolon/French headers,
  formula safety, sanitization, stable attachment metadata, size refusal,
  transactional evidence/hash rollback and PTA-6B regressions. After the
  independent reviewer tightened the snapshot oracle, that affected test passed
  again in 7.15 seconds against the final image.
- Frontend ESLint, Stylelint and Prettier passed; all 63 Vitest tests passed and
  the production/PWA build completed with the existing chunk-size warning. The
  corrected focused history tests passed 2/2 and prove no offline replay, exactly
  one deliberate POST, safe download and active Query refetch.
- The focused real-Chromium history/download journey passed 1/1 in 2.8 seconds.
  `git diff --check` passed.
- Only synthetic identities and the isolated `mjl-pta6c` PostgreSQL project were
  used. PC1/PC2 remain pending and real accounts remain prohibited.

## Independent review

The read-only independent reviewer initially blocked completion because the
advertised timestamp and selected rows were separate READ COMMITTED statements,
the current-role recheck lacked a deterministic deactivation race, and frontend
invalidation/no-replay evidence was incomplete. The implementation captured the
timestamp and exact event IDs together, added the lifecycle race, and tightened
the frontend oracles. The reviewer then caught a false test oracle: the test now
asserts the concurrent event's returned ID is absent from the parsed CSV. The
same reviewer returned **PASS** after focused re-review with no remaining finding
and modified no files.
