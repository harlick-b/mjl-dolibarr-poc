# PTA-4B implementation status

**PTA_4B_COMPLETE** on 2026-11-02.

## Implemented boundary

`GET /api/v1/activities/{activity_id}/fiche.pdf` authorizes a fresh internal
business-role session, takes the established shared workflow lock, rejects a
draft-only or unknown Activity, and generates a French A4 PDF in memory. The
approved revision snapshot is the planning baseline, so pending candidate
content is not exposed. Current authoritative execution, financial authorization,
external confirmation, reversement and closure rows supply the remaining facts.
Successful generation records `activity.fiche_generated` in the existing audit
table before the response is returned.

The existing Activity detail screen exposes one native same-origin download
action only when an approved revision exists. No migration, stored binary,
document table, preview route, signature mechanism, Partner access or generic
export framework was added. PC1/PC2, real accounts and production remain
excluded.

## Candidate verification evidence

- Final review-candidate backend image
  `sha256:817a342e7221f02bec71ed16f656655bfa90ce14ecea4c216f9347beb5612ecb`
  was built from the candidate with ReportLab and the test-only pypdf parser.
- Seven final-candidate disposable-PostgreSQL tests passed in 33.23 seconds. They extracted
  the generated PDF and verified approved planning, Operation spending,
  décaissement/virement amounts, reversement, closure and document status; all
  three business roles; Admin/guessed-ID denial; draft fail-closed behavior;
  download/no-store headers; the generation audit and its rollback; approved
  baseline isolation during an amendment; exact reversement labels/values;
  execution corrections and reasoned financial return/cancellation; valid
  maximum-length content; and the explicit OpenAPI PDF response.
- Before reviewer corrections, the focused plus adjacent closure, annual-metrics
  and full financial-chain regression run passed **121 tests** in **841.96
  seconds**. That evidence belongs to the earlier candidate and is not relabelled
  as a final-candidate run. Reviewer fixes were confined to the new Fiche module
  and its tests; the affected seven-test file was rerun on the image above.
- Ruff formatting/lint and strict mypy passed. OpenAPI validation passed.
- The focused Planning Vitest file passed **22 tests**. ESLint, Stylelint,
  Prettier and the production/PWA build passed; the existing chunk-size warning
  remains. One focused real-Chromium mobile journey passed and verified the
  guarded French action and PDF request.
- `git diff --check` passed. Only synthetic identities and the disposable
  `mjl-pta4b` PostgreSQL resources were used.

## Exact commands and results

Run from the repository root unless a working directory is stated:

- `POSTGRES_PASSWORD=synthetic-pta4b-only POSTGRES_DB=mjl_test_base docker compose -p mjl-pta4b -f compose.rebuild.yaml build backend` — built the image above.
- The same Compose project with
  `run --rm -e TEST_DATABASE_URL=postgresql+psycopg://mjl:synthetic-pta4b-only@postgres:5432/mjl_test_base backend pytest -q tests/test_fiche.py` — **7 passed** in **33.23s** on the final candidate.
- The same Compose project and database URL with
  `backend pytest -q tests/test_fiche.py tests/test_closure.py tests/test_metrics.py tests/test_disbursement.py tests/test_virement.py tests/test_reversement.py` — **121 passed** in **841.96s**.
- From `backend`, with `UV_CACHE_DIR=/tmp/mjl-pta4b-uv-cache`,
  `uv run ruff check app/planning/fiche.py app/main.py tests/test_fiche.py` and
  `uv run mypy app` passed. `openapi-spec-validator` validated the generated
  contract using a synthetic complete PostgreSQL URL.
- From `frontend`, `npm run test:unit -- src/planning.test.jsx` — **22 passed**;
  `npm run lint -- --quiet`, `npm run lint:css`, `npm run format:check` and
  `npm run build` passed.
- From `frontend`, `npm run test:e2e -- e2e/fiche.spec.js` — **1 passed** using
  real Chromium after sandbox escalation allowed the local preview listener.

## Exact-commit review corrections

Independent review of commit `41cc974` found four bounded projection/contract
gaps. The corrected candidate now resolves approved Operation-type labels from
the immutable approved snapshot as well as current rows, renders requested
correction amounts and available workflow reasons (including withdrawal and
transfer submission reasons), uses French labels for the finite Activity
journal actions, and exposes distinct `LocalSession` and `SecureSession`
OpenAPI cookie schemes.

The added public-boundary tests first failed on the missing approved type,
requested amount, withdrawal reason and French journal behavior. On final
backend image
`sha256:366a35e8c3804a7133d368ab157fe9404be254ff12c7f1a07b85960462bb67ca`,
`pytest -q tests/test_fiche.py` passed **10 tests** in **65.55 seconds**. Ruff
format/lint, strict mypy and `git diff --check` also passed. The broader
121-test result above belongs to the earlier candidate and is not relabelled as
post-correction evidence.

## Independent review

The independent standards and security/specification reviewers initially returned
`CHANGES_REQUIRED`. They found an incorrect reversement basis, missing Operation
and settlement correction attribution, incomplete financial reason chronology,
failure on valid long table content, technical English execution labels, an
implicit OpenAPI success media type, missing approved-baseline evidence and stale
candidate evidence. The implementer corrected those findings without expanding
scope and ran the affected final-candidate checks above.

Both original read-only reviewers inspected the corrected source and evidence.
The standards reviewer returned **PASS**, including a final source-only delta
check. The security/specification reviewer returned **PASS** after verifying that
status evidence names the exact final image and result. Neither reviewer modified
files. No blocking correctness, security, specification, scope, overengineering
or verification finding remains. This is synthetic development completion, not
application acceptance or production readiness.

Two further read-only reviewers then inspected exact commit `41cc974` and found
the bounded gaps recorded above. After the corrections, those same reviewers
performed focused re-reviews and both returned **PASS**. Neither modified files.
