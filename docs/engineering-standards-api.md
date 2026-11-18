# Backend engineering standard

Portable reference for humans and agents · Reviewed 2026-11-18.

**Use this file as the authority for accepted engineering rules.** Observed behavior documents the source project; it is not automatically a requirement for a new product. Open decisions remain unresolved. Examples labelled adapted illustrate a pattern; they do not establish production behavior.

## Contents

- [Adoption checklist](#adoption-checklist)
- [Migrating an existing project](#migration-workflow)
- [Authority and adoption](#backend-readme)
- [Folders, code and architecture](#backend-architecture)
- [Registration, login and session lifecycle](#backend-authentication)
- [Dependencies, configuration and tests](#backend-tooling-and-tests)
- [Unresolved choices and verification gaps](#backend-open-decisions)
- [Accepted adoption decisions](#adoption-questions)
- [Complete examples and dependency map](#examples)
- [Embedded source evidence](#evidence)

**At a glance:** FastAPI/Python; `AppMain/` composition and `app/` routes, models, serializers, controllers and queries; MongoDB/Beanie with sapx; typed API contracts, server authorization, isolated pytest fixtures and behavior tests.

<a id="adoption-checklist"></a>
## Adopt this standard

Use this checklist when starting a project or introducing the standard into an existing one. It applies the accepted rules below; it does not turn observed source behavior into additional requirements.

- [ ] **Establish ownership.** Copy this file into the destination's `docs/engineering-standards.md` and link it from the README and agent instructions. If both stack standards share one docs directory, give them distinct frontend/backend filenames and link both.
- [ ] **Check stack compatibility.** Review the [toolchain](#backend-tooling-and-tests), confirm MongoDB/Beanie and `sapx` availability, and verify compatible versions and imported dependencies. A different database requires an explicit adaptation of persistence/query rules; the examples are not database-independent.
- [ ] **Wire one representative resource.** Follow the model/serializer/query/controller/route boundaries. Define request/response contracts, enforce actor-scoped access on the server, and provide isolated synthetic fixtures. Replace the example's default-deny auth placeholder with approved authentication and authorization.
- [ ] **Settle remaining auth details.** Apply [AUTH-001](#adoption-questions): simple registration, verified email before first sign-in, email OTP enabled by default with a user setting, shared password checks and return to login after reset. Record session storage/transport/expiry, how users confirm OTP-setting changes, and the email-verification mechanism/expiry. Do not reopen accepted choices unless an approved exception is needed.
- [ ] **Record adaptations.** Replace eHadj branding, role names, campaign fields and integrations with the destination's requirements while preserving the documented responsibility boundaries. Keep source evidence labelled as historical evidence. Record each exception's rule ID, scope, reason, approval, risks, checks and review condition. In ongoing projects, inventory deviations and migrate deliberately.
- [ ] **Verify adoption.** Run relevant pytest scenarios and configured lint/type checks against a disposable test database. Cover validation, exact authorization outcomes, response projection, persistence effects and AUTH-001 flows. Test concurrency before claiming atomic token consumption or exact multi-worker limits; record checks and remaining gaps.

<a id="migration-workflow"></a>
## Migrating an existing project

1. **Audit before editing.** Read this standard and the destination's product decisions. Compare actual code/configuration/tests against each applicable rule. Record `rule ID | evidence | gap | risk | planned change | status`; mark unknowns rather than guessing behavior. Inventory existing user edits.
2. **Establish the baseline.** Run the project's available checks and representative user flows. Record pre-existing failures and missing coverage. Add focused behavior checks where a risky migration otherwise has no reliable verification.
3. **Plan small steps.** Separate structural moves/import fixes from dependency, behavior, authentication, permission, API-contract and deployment changes. Order dependent work and identify a rollback point for each step. Preserve product behavior during structural cleanup; resolve conflicting product decisions before affected changes.
4. **Migrate one responsibility at a time.** Use the destination's version control to keep changes reviewable. Update imports, exports, aliases, routes, test paths, configuration and documentation affected by each move. Do not combine unrelated rewrites or overwrite existing work.
5. **Verify each step.** Run relevant pytest and lint/type checks against isolated test data; verify request/response compatibility, persistence and authorization. For API contract changes, verify frontend consumption too, or explicitly mark it unverified. Database migrations need their own approved environment and rollback plan. If a change breaks the baseline, repair it or revert only that migration step before continuing. Record any checks that could not run.
6. **Report rule-by-rule completion.** Mark each applicable rule compliant, approved exception, pending or unverified, with evidence. Record exception owners/review conditions and remaining migration work. A passing build alone is not proof of full compliance; do not claim completion while required work remains.

<a id="backend-readme"></a>

## Backend engineering standards


### Authority and adoption — BE-001

**Accepted.** MUST means required; SHOULD means the default with a documented reason for deviation; MAY means optional. Accepted sections establish reusable rules. Observed sections describe source behavior. Open decisions do not establish defaults. Adapted examples are illustrative and are not tested drop-in features.

The owner approved documentation with concrete examples, preservation of architecture and coding/testing patterns, inclusion of authentication, and gradual adoption on new and ongoing projects. New and substantially modified code MUST follow accepted rules. Existing deviations MUST be inventoried and migrated deliberately. Substantial modification changes behavior, responsibility or data flow; a wording/formatting edit does not trigger a broad migration.

Apply compliance to the touched responsibility. Adoption does not authorize changing auth, permissions, API contracts, migrations, data, integrations or deployment. Explicit product requirements and approved project exceptions govern product behavior. If a destination's accepted decision conflicts, record the exact conflict and obtain a decision before changing the affected behavior; continue independent work.

Exceptions MUST identify rule ID, scope, reason, owner approval, risks, checks and review/migration condition. Proposed amendments MUST identify old/new rules, rationale, affected projects/contracts and approval. Source drift does not silently change the standard. Version observations are not a permanent version freeze or certification of security/currentness.

### Reading path

1. [Architecture and implementation](#backend-architecture): directory ownership, functions, models, serializers, controllers, queries and routes.
2. [Authentication](#backend-authentication): registration, login, OTP, recovery, credentials and logout.
3. [Tooling and tests](#backend-tooling-and-tests): dependencies, formatter/linter hooks, fixtures and endpoint test logic.
4. [Open decisions and evidence limits](#backend-open-decisions): unresolved conflicts and portability gaps.

### Adoption and agent entry

Decision map: BE-001 authority/adoption; BE-002 folders; BE-003 Python interfaces/style; BE-004 persistence/validation/query boundaries; BE-005 routes/contracts; BE-006 integrations/tasks; BE-007 authentication; BE-008 runtime/tooling; BE-009 tests. Each topic gives source evidence and verification guidance. Original design rationale is unknown unless explicitly documented.

Copy this file to `docs/engineering-standards.md` in the destination backend and link it from human and agent onboarding. Embedded evidence and example modules need no original checkout. Do not copy production data or environment values.

```markdown
## Engineering standards

Follow docs/engineering-standards.md and its relevant sections.
Accepted rules govern new and substantially modified code.
Record existing deviations and approved exceptions. Resolve open decisions
with the owner; adoption does not authorize sensitive behavior changes.
```

Before implementation, inspect project context, nearby owners, authorization and consumers; choose meaningful behavior checks. After implementation, update affected contracts/examples and report executed checks and limitations. Keep one local source of truth rather than duplicating rules in tool adapters.

Original reasons for many historic choices are not recorded. Responsibility descriptions explain how the code is organized, not invented decision history. The handbook covers common FastAPI/MongoDB technical patterns and representative authentication/test flows. Hajj entities, role names, finance/identity rules, provider credentials and operational data are not universal defaults.

<a id="backend-architecture"></a>

## Backend architecture and implementation

Authority: [BE-001](#backend-readme).

### Folder ownership — BE-002

**Accepted.** Preserve the following boundaries and exact directory names. Resource/domain subpackages are allowed. Create modules when they have a responsibility, not as unused scaffolding.

```text
AppMain/
  asgi.py                     # app composition, middleware and DB initialization
  settings.py                 # environment-backed configuration
app/
  webapi/                     # resource routers and HTTP orchestration
    __init__.py               # aggregate router/prefix registration
  models/                     # Beanie documents, embedded models, enums
    example/
      example.py
      _embedded.py            # when embedded value models are needed
      __init__.py
  serializers/                # input validation and output shaping
  controllers/                # reusable business operations
  query/                      # actor-scoped listing/retrieve/search/aggregation
  tasks/                      # background work
  xlib/                       # external-service adapters and utilities
tests/
  conftest.py                 # environment isolation/shared infrastructure
  samples.py                  # synthetic shared scenarios
  _helpers/                  # shared REST/assertion utilities
  webapi/
    conftest.py               # cross-resource API fixtures
    example/
      conftest.py             # resource setup/cleanup
      samples.py
      test_example.py
  unit/                       # isolated domain logic when useful
scripts/                      # operational/check wrappers
```

`audit_module/` and `notification_module/` are existing separate capabilities, with their own models/controllers/serializers/utilities. Preserve those owners when working in eHadj; their product policies are not mandatory modules in every project. Templates/static assets, migrations and deployment files are separate concerns, not substitutes for application boundaries.

Evidence: [instructions](#evidence-003), [app](#evidence-007), [tests](#evidence-031). Verification: trace a resource through its existing owners; reject parallel folders introduced merely to avoid updating established code or tests.

### Python style and interfaces — BE-003

**Accepted.** Use snake_case modules/functions, PascalCase classes, typed inputs/returns and async functions for asynchronous I/O. Keep `typing.Any` localized to dynamic contracts; do not widen response types to hide a mismatch. Keep docstrings/comments focused on contracts and non-obvious decisions. Use Black/isort and the project's type/lint configuration rather than manual competing styles.

Use imports through existing `app.models`/serializer package exports where established; update exports when adding models consumed by initialization. A local import MAY break a real cyclic dependency (the auth controller already does this); do not introduce a new registry solely for hypothetical reuse. Pure calculations SHOULD remain independently testable, while endpoint behavior is tested through its actual route and persistence boundaries.

Reuse established helpers. Avoid speculative service/repository layers on top of the existing query/controller/serializer split. No universal function length or mandatory class-per-operation rule is established here.

Evidence: [pyproject](#evidence-027), [model exports](#evidence-010), [user controller](#evidence-009), [query base](#evidence-015). Verification: relevant formatting, typing and behavior checks.

### Models, serializers, controllers and queries — BE-004

**Accepted.** Models own persistence shape, links, indexes and model-level operations. Separate read serializers from write serializers so input cannot silently set server-owned or output-only fields. Perform request-independent field validation with Pydantic; perform database/actor checks in the established async validator step. Reusable multi-step operations belong in controllers. Query objects own actor/data scoping, filters and retrieval.

Observed stack is MongoDB with Beanie/Motor/PyMongo and `sapx` helpers imported as `sap`. This is not a plain FastAPI-only template. `sap.beanie.Document`, `ObjectSerializer`, `WriteObjectSerializer`, `CursorInfo` and `PaginatedData` have external implementations; their internals were not audited here. A project choosing another database or replacing sap requires an explicit architecture decision.

Read serializers commonly use `Serializer.read(instance)` / `read_page(...)`. Write serializers commonly expose `run_async_validators`, `create`, `update` and `instance`. Routes explicitly call async validators; do not assume FastAPI automatically runs these custom methods. Serializer methods currently also perform writes and some domain calculations; a strict “serializers never touch persistence” rule would contradict the source.

A query is constructed with the request actor and filters. `get_qs()` creates a fresh scoped query, and `retrieve()` narrows that query by ID rather than bypassing it. Preserve scoping on list, detail, search, export and aggregate operations. New field projections MUST preserve the actual response contract and authorization-dependent redaction.

Adapted persistence/serializer excerpt for a hypothetical resource:

```python
# app/models/example/example.py
from sap.beanie import Document


class Example(Document):
    """Persist a named example."""

    name: str

    class Settings:
        """MongoDB collection settings."""

        name = "example"


# app/serializers/example/example.py
import typing

from pydantic import Field

from sap.fastapi.serializers import ObjectSerializer, WriteObjectSerializer

from app.models import Example


class ExampleSerializer(ObjectSerializer[Example]):
    """Public example representation."""

    id: str
    name: str


class WriteExampleSerializer(WriteObjectSerializer[Example]):
    """Accepted example input."""

    name: str = Field(min_length=1, max_length=120)

    async def create(self, **kwargs: typing.Any) -> Example:
        """Persist validated input."""
        self.instance = await Example(name=self.name).create()
        return self.instance
```

This is a shortened illustration, not a complete feature: add project-specific async validation, authorization/scoping, package exports, initialization and tests. Do not infer uniqueness, transactions or access rules from this minimal shape. Whitespace-only names require an explicit normalization/validation decision.

Evidence: [Category model](#evidence-011), [Category serializers](#evidence-018), [Organization query](#evidence-016), [query base](#evidence-015), [user operations](#evidence-009). Verification: input constraints, persisted changes, output shape and actor isolation.

### Routes, contracts and composition — BE-005

**Accepted.** Define a router per resource in `app/webapi/` and register prefixes/tags in `app/webapi/__init__.py`. Compose the app and middleware in `AppMain/asgi.py`. Route functions orchestrate dependencies, query/serializer/controller calls and HTTP responses. Keep declared responses aligned with serialized output.

Observed API mounts at `/api/v1`. Common operation names are `listing`, `retrieve`, `create`, `update`, `destroy`. Typical status conventions are 200 for reads, 201 for creation, 202 for accepted updates/reset and 204 for deletion; the specific endpoint contract is authoritative. Use explicit `HTTPException(status_code=..., detail=...)` for HTTP failures where established. Client code depends on `detail`; do not change that payload incidentally.

Lists use an envelope containing `object`, `data`, `count`, `next`, `previous`. Routes commonly construct `CursorInfo(request=request)`, apply its Beanie parameters, set count and call `read_page`. Statistics use `StatsCollection` with `data: list[StatSerializer]`; do not narrow/widen annotations merely to suppress validation. Search and pagination variants exist; verify the affected endpoint rather than claiming every branch applies identical limits.

Exact route registration excerpt:

```python
router_api = APIRouter(redirect_slashes=True)
router_api.include_router(router_auth, prefix="/auth/user_token", tags=["auth"])
```

Adapted protected listing fragment; [complete modules](#examples) provide imports, `ExampleQuery` and a default-deny auth placeholder. Integrate the destination’s approved authorization policy before use:

```python
@router.get("/", status_code=status.HTTP_200_OK)
async def listing(
    request: Request,
    request_user: User = Depends(require_example_read),
) -> PaginatedData[ExampleSerializer]:
    cursor = CursorInfo(request=request)
    query = ExampleQuery(user=request_user, filters=request.query_params)
    qs = await query.get_qs()
    qs = qs.find(**cursor.get_beanie_query_params())
    rows = await qs.to_list()
    cursor.set_count(await qs.count())
    return ExampleSerializer.read_page(rows, request=request, cursor_info=cursor)
```

`require_example_read` is a named placeholder for an approved auth dependency, not an existing helper or permission default. Count/pagination semantics MUST be verified against the chosen query/library. Add search only with its tested parameter contract. To complete this vertical slice: register the model and router, define actor-scoped query and write validation, add create/update endpoints, then test HTTP payloads, database effects and denied actors in `tests/webapi/example/`.

App initialization observes model exports, Beanie initialization, middleware and mounted sub-apps. The inspected API has protected custom docs/OpenAPI routes while automatic docs are disabled. This does not prove deployment-level protection or make protected docs a universal product policy.

Evidence: [router registry](#evidence-022), [app composition](#evidence-004), [Organization listing](#evidence-024), [query/StatsCollection](#evidence-015). Verification: actual mounted URL, slash behavior, dependencies, response schema, pagination/count, search and consumer compatibility.

### Background work and external services — BE-006

**Accepted.** Keep external clients under established `app/xlib/` owners and background work under `app/tasks/`. Keep credentials in environment-backed settings and out of code/examples. Mock external sends/writes in tests and verify relevant request/response contracts. Audit/notification behavior stays with its modules. Do not infer retries, idempotency, scheduling or delivery guarantees merely from a task filename or installed package.

No production migration, seed, email, storage or deployment command is a harmless verification step. Existing command authorization rules remain applicable. Provider-specific payment, identity, notification and audit implementations need separate extraction/contract work before they can be claimed as portable complete modules.

Evidence: [adapters](#evidence-026), [tasks](#evidence-021), [settings](#evidence-005), [instructions](#evidence-003). Verification: isolated boundary tests and explicit operational prerequisites.

<a id="backend-authentication"></a>

## Authentication and account lifecycle

Authority: [BE-001](#backend-readme). Authentication behavior is included as requested. Accepted responsibilities below are reusable; observed endpoint details remain an eHadj profile, not an implicit choice for all future products.

### Authentication ownership — BE-007

**Accepted.** The server MUST authenticate credentials, enforce authorization and scope data independently of the frontend. Keep credential verification/guards in the existing auth owner, input validation in serializers, and shared account operations in controllers. Keep interactive sessions distinct from machine API credentials. Registration, login, OTP, reset and logout MUST be verified as complete flows, including invalid credentials and state changes.

For organization-scoped access, use the role paired with the active organization and deny malformed membership pairings. Reuse centralized role groups rather than duplicating role arrays across routes. Product-specific role names, privileged exceptions and platform-lock actions remain local product policy. Do not infer authorization from the existence of a route or its docstring.

Evidence: [UserAuth](#evidence-013), [User membership/session model](#evidence-014), [role enums](#evidence-012), [instructions](#evidence-003). The distinction between `require`, `require_active` and `require_action` is important; see the unresolved behavior below.

### Observed request flows

All paths here are relative to `/api/v1`.

| Flow | Implemented orchestration |
| --- | --- |
| Public registration | POST `pilgrim_org/`: registration throttle dependency, write serializer validation, organization creation, primary-user creation and activation email |
| Staff-created account | User write serializer validates email/memberships/roles, creates account and sends activation email |
| Set initial password | Activation email points to frontend reset screen; reset serializer sets password and `is_verified` |
| Login | POST `auth/user_token/`: throttle, email/password validation, issue OTP; 201 response is not yet a session token |
| OTP verification | POST `auth/user_token/verify_otp/`: throttle, lookup, OTP check, clear OTP, generate auth key, fetch links, return AuthTokenSerializer |
| Forgot password | POST `auth/user_token/forgot_password/`: count attempts, lookup email, send link when found, return `{result: true}` with 202 |
| Reset | POST `auth/user_token/reset_password/`: throttle, validate JWT/nonce/password, update password and verification, generate session, return AuthTokenSerializer with 202 |
| Authenticated request | Basic credential lookup against interactive key or API key; inactive-account and session-expiry checks; route-specific guards follow |
| Logout | DELETE `auth/user_token/{key}/`: locate current key and conditionally clear that same key and expiry; 204 |
| Deactivate account | User controller clears interactive key/expiry while marking inactive, except its existing superuser exception |

Registration creates a pilgrimage-specific organization/user pairing. A generic project MUST define its own account entity/activation requirements rather than inheriting those business fields. CAPTCHA enforcement was not established from the inspected route/serializer. External mail delivery was not executed.

### Credential and OTP mechanics

Observed `UserAuth.authenticate` accepts Basic authorization (also via `X-Beans-Authorization`), decodes a presented key and looks up `auth_key` or `api_key`. Interactive keys have `auth_key_expires_at`; a missing expiry is rejected. API keys bypass interactive expiry. User deactivation is checked centrally. This is not a Bearer-JWT access-token design, even though JWT is used for reset links.

`generate_auth_key` generates a random 32-character key and stores expiry based on `SESSION_EXPIRE_MINUTES`. The model stores one interactive key, so issuance replaces the prior key. Machine-key lifetime is separate. Logout does not revoke the API key. Do not call it “revoke all credentials.”

The shared `issue_login_otp` operation refuses a still-pending OTP, checks persistent attempt limits, generates a six-character alphanumeric code, stores it for 180 seconds and sends email. Send failure clears it. Verification checks expiration and uses `hmac.compare_digest`; successful verification clears it before issuing a session. Separate check/clear operations do not prove atomic one-time consumption under concurrent requests.

Throttle records are persisted by scope/identifier; configuration supplies attempt/window/lock values. Login and OTP failures are counted, while request-style flows count hits. Read/modify/save implementation is not proof of exact cross-worker concurrency limits. Recovery and OTP timing policy needs destination approval; do not invent values from library defaults.

### Reset-token logic and session revocation

Reset issuance generates a random nonce, stores its SHA-256 hash on the user, and signs a JWT containing `exp`, `user_id` and `nonce`. Verification decodes HS256, finds the user and compares the nonce hash with constant-time comparison. Reset clears the stored hash after setting the password and verified state. Sequential reuse is explicitly tested; simultaneous consumption was not proven by this extraction.

The API creates a session after reset, but the inspected frontend discards that returned session and sends the user to login. AUTH-001 now resolves the target: reset must not issue a session, and both layers must use the exact frontend password checks. These are implementation gaps in the observed API, not unresolved product choices; see [accepted decisions](#adoption-questions).

Exact logout write excerpt, useful for preserving session-race semantics:

```python
await User.find_one(User.id == instance.id, User.auth_key == pk).set(
    {"auth_key": None, "auth_key_expires_at": None}
)
```

The key is checked again at write time: an older logout must not erase a newer session. This excerpt depends on the surrounding route's instance lookup and response handling. It is not a standalone endpoint.

### Authorization details that must not be flattened

`require` authenticates, checks `has_perms`, then active-organization status; `require_active` also checks active permissions. Current `User.has_perms` can consider assigned roles, while intended organization policy requires the active pairing. `require_action` composes guards and platform actions; `_enforce_action` currently falls back to a first role and allows absent permission documents/action keys. These observed compatibility paths MUST NOT be promoted as a universal fail-closed permission policy. Resolve the affected contract before reuse.

The request actor is placed in a ContextVar for response shaping. Do not assume that setting it proves every serializer redacts correctly; inspect/test each sensitive projection. Existing public-route exceptions and domain-specific role groups are not a generic public-access policy.

### Evidence and required verification

Sources: [auth endpoints](#evidence-023), [auth serializers](#evidence-017), [user serializers and email/reset issuance](#evidence-020), [registration route](#evidence-025), [registration serializer](#evidence-019), [user controller](#evidence-009), [throttle](#evidence-008), [UserAuth](#evidence-013), [User model](#evidence-014).

Preserve/adapt [auth endpoint tests](#evidence-036), their [fixtures](#evidence-035), and actor-isolation tests in existing resource suites. Required scenarios: rejected credentials, inactive user/org, OTP invalid/expired/reused, throttle exhaustion, reset expired/used, registration invalid/duplicate, revocation of copied interactive credential, session expiry, and logout racing a replacement session. Concurrency requirements need concurrency tests, not sequential assertions alone. Test names/source do not prove a passing run in this extraction.

Authentication examples MUST omit real credentials and raw credential-bearing logs. Some inspected source has sensitive logging patterns; they are recorded as non-reusable deviations, not copied as recommended code. This handbook does not certify the current auth implementation as production-safe.

<a id="backend-tooling-and-tests"></a>

## Tooling and test conventions

Authority: [BE-001](#backend-readme). Manifest versions describe the inspected source, not recommended upgrades or guaranteed installed versions.

### Runtime and dependencies — BE-008

**Accepted.** Keep runtime dependencies in `requirements.txt`, development dependencies in `requirements-dev.txt`, tool configuration in `pyproject.toml`, and Git checks in `.pre-commit-config.yaml`. Maintain requirements intentionally rather than freezing an arbitrary workstation environment. Preserve the selected FastAPI/MongoDB stack unless an architecture decision changes it.

| Responsibility | Observed dependency family / snapshot |
| --- | --- |
| Runtime | Python 3.12.x, Uvicorn 0.31.0, FastAPI 0.115.0 |
| Validation/settings | Pydantic 2.9.2 with email support, pydantic-settings 2.5.2 |
| Persistence | MongoDB 7.0 documentation baseline, Beanie 1.26.0, Motor 3.6.0, PyMongo 4.9.2 |
| Shared framework helpers | sapx 0.3.5, imported through `sap` |
| Auth-related | PyJWT, bcrypt; code also imports passlib via its dependency environment |
| HTTP/files/templates | httpx, requests, aiofiles, python-multipart, Jinja2 |
| Optional integrations | aioboto3 storage, Resend/SendGrid mail, Sentry, structlog audit, fpdf2, Pillow, XML handling |
| Dev quality | Black, isort, Pylint, mypy with Pydantic plugin/stubs, pydocstyle, pre-commit |
| Testing | pytest, pytest-asyncio, coverage/pytest-cov, async-asgi-testclient, httpx ASGITransport |

Optional capabilities require a project need. Package presence does not establish use (for example celery-related development packages do not prove a Celery-backed runtime). `sapx` is a real portability dependency: a plain FastAPI environment cannot run these serializers/models unchanged. Direct versus transitive dependencies, package availability and clean installation need verification before building a starter.

### Formatter, type and hook configuration

Selected exact configuration values:

```toml
[tool.black]
line-length = 120

[tool.isort]
profile = "black"
known_core = "core,coreapi,corelib,sap"
sections = "FUTURE,STDLIB,THIRDPARTY,CORE,FIRSTPARTY,LOCALFOLDER"
line_length = 120

[tool.mypy]
plugins = ['pydantic.mypy']
strict = true
disallow_untyped_calls = false

[tool.pytest.ini_options]
testpaths = "tests"
asyncio_mode = "auto"
```

Black/isort exclude migrations in their full configuration. Pylint includes selected extensions and documented disables; it does not enforce missing docstrings. pydocstyle uses pep257 and configured app directories. mypy strictness has exceptions; do not claim fully strict typing without exceptions.

Pre-commit runs file hygiene checks, forbids direct commits to `release`, `staging`, `main`, checks isort/Black, runs mypy/pydocstyle/Pylint, and invokes `scripts/pre-commit-pytest.sh` without filenames and with `always_run: true`. That script skips pytest on `draft/` branches. This is observed behavior, not evidence every commit ran tests. A draft hook skip does not waive BE-009 completion checks. Protected branch names are repository policy to configure explicitly in another project.

| Task | Command |
| --- | --- |
| Environment | `virtualenv .venv --python=python3.12` then `source .venv/bin/activate` |
| Development installation | `pip install -r requirements-dev.txt` |
| Hooks | `pre-commit install` |
| Dev entry | `python main.py` |
| Formatting | `black .` and `isort .` |
| Full hooks | `pre-commit run --all-files` |
| Lint/type/docs | `pylint AppMain app tests`, `mypy .`, `pydocstyle .` |
| Behavior suite | `pytest` |

Do not run `register.py`, `migrate.py`, deployment wrappers or notification scripts as ordinary verification; they can mutate data or contact services. Production topology, CI release gates and rollback policies were not established by this extraction.

Sources: [runtime requirements](#evidence-029), [dev requirements](#evidence-028), [pyproject](#evidence-027), [pre-commit](#evidence-002), [pytest hook](#evidence-030), [README](#evidence-006).

### Test organization and isolation — BE-009

**Accepted.** Endpoint tests belong in `tests/webapi/<resource>/test_*.py`, resource setup in its existing `conftest.py`, scenarios in `samples.py`, and shared fixtures/helpers in the established ancestors. Do not introduce parallel folders to avoid updating canonical fixtures. Use async pytest tests for async behavior and pure unit tests for useful isolated calculations. Test observable HTTP behavior, persisted changes and authorization, not only internal call sequences.

Shared infrastructure MUST select a disposable database and disable live integrations before application imports. Existing root conftest removes application/audit environment prefixes, disables dotenv loading with `/dev/null`, injects synthetic settings, disables email, and blocks external sockets except its loopback MongoDB endpoint. Do not copy `.env` or production data into fixtures.

Observed test databases are `ehadj_test` and `ehadj_reporting_test` on loopback port 27028. Legacy fixtures are often session/package scoped; reporting fixtures reset their isolated dataset, restore Beanie class bindings and cached campaign/preferences via monkeypatch, and close the client. These scopes coexist; do not claim all tests have fresh per-function databases. Keep setup/cleanup matched to the feature's existing fixture hierarchy.

Two HTTP harnesses coexist:

- Full app `async_asgi_testclient.TestClient(app)` for existing endpoint/auth tests.
- `httpx.AsyncClient(transport=ASGITransport(app=app), ...)` for isolated router tests with real database queries and controlled authentication.

Mocking authentication in a router test verifies downstream authorization/data logic only to the degree the real guards remain exercised; it does not prove credential parsing, middleware, mounted-prefix or lifespan behavior. Include full-app tests for those boundaries. Restore patches and global state on cleanup.

Adapted endpoint assertion pattern, depending on a resource `example_client` fixture that supplies an isolated HTTP client and synthetic records:

```python
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_listing_returns_public_fields(example_client: AsyncClient) -> None:
    """Expose the expected list contract without internal fields."""
    response = await example_client.get("/example/")
    assert response.status_code == 200
    body = response.json()
    assert body["object"] == "list"
    assert body["count"] == 1
    assert body["data"][0]["name"] == "Synthetic example"
    assert "internal_note" not in body["data"][0]
    assert body["next"] is None
    assert body["previous"] is None
```

Fixture contract: mount the real resource router or use the full app as appropriate, initialize its registered models against a disposable database, insert synthetic records, supply the approved actor, yield the client, then restore patches and clear only the test dataset. Resource data belongs in `samples.py` when shared across scenarios. The [complete example](#examples) supplies the fixture and resource. Its MongoDB tests have not been executed; they require the documented disposable database.

Existing `assert_rest_can_list/retrieve/create/update/destroy/stats` helpers exercise common CRUD expectations with valid/invalid payload variants and actor fixtures. Inspect their semantics before reuse: forbidden assertions accept several status codes, and helper role comments/logic are not a substitute for exact active-organization tests. Add explicit expected status, body and database assertions when permission distinctions matter.

### Feature verification

A resource slice SHOULD test valid create/read/update/delete as applicable, invalid fields, duplicate/conflicting data, unauthorized and wrong-organization actors, pagination/search, output redaction, and relevant side effects. Authentication needs the [flow scenarios](#backend-authentication), not just CRUD helpers. Use synthetic external service responses; do not send mail or payment requests during ordinary tests.

Backend code default is `pytest` with the documented disposable MongoDB prerequisites. Run relevant lint/type/hooks for the changed scope. Test selection such as `pytest -m dashboard` covers only that marker; it does not establish full-suite health. Coverage configuration exists, but the coverage threshold/addopts line is commented out; no enforced 95% threshold is established.

For documentation-only work: inspect diffs, links, source consistency and Git status. No application tests are needed unless code changed. Always report executed checks and remaining gaps; a test source file is not a passing test result.

Evidence: [root fixtures](#evidence-033), [API fixtures](#evidence-038), [REST helpers](#evidence-032), [category tests](#evidence-037), [auth tests](#evidence-036), [unit tests](#evidence-034).

<a id="backend-open-decisions"></a>

## Open decisions and evidence limits

Unresolved entries are **not accepted reusable defaults**; resolved rows link to accepted rules and any remaining migration work. Do not silently resolve conflicts while extracting or adopting the handbook. No application remediation is included in this documentation task.

| ID | Evidence / conflict | Required disposition |
| --- | --- | --- |
| BE-O01 | Model/serializer/pagination contracts depend on sapx; imported passlib is not directly listed in runtime requirements | Preserve dependency awareness. Verify availability, versions and direct/transitive requirements before a runnable starter; do not invent sap internals. |
| BE-O02 | Accepted active-organization policy versus `require`/`has_perms` assigned-role checks and `_enforce_action` first-role fallback/default allow | Keep intended policy and observed paths distinct. Decide/migrate guards explicitly with permission-matrix evidence and tests. Do not generalize default-allow behavior. |
| BE-O03 | Frontend reset policy differs from `ResetPasswordSerializer` (length/case rules) | Resolved by AUTH-001: use exact frontend password checks in both layers; backend alignment remains implementation work. |
| BE-O04 | API reset generates a session; frontend returns to login without installing it | Resolved by AUTH-001: reset returns to login and must not issue a session; backend alignment remains implementation work. |
| BE-O05 | OTP and reset nonce verification/consumption use separate operations; throttle counters use read/modify/save | Sequential tests do not prove concurrency guarantees. Require a design and concurrency checks before claiming atomic single-use or exact multi-worker limits. |
| BE-O06 | Registration route and serializer inspected do not establish CAPTCHA verification although UI sends CAPTCHA | Confirm the actual server boundary before claiming enforcement. Existing registration throttle is a separate mechanism. |
| BE-O07 | Client signing comments say enforced; `AppMain/asgi.py` has integrity middleware registration commented out | Do not copy the comment's guarantee or treat a client-supplied signature as proof of server enforcement. Resolve signing policy across repositories. |
| BE-O08 | `Organization` listing docstring says public, but endpoint has an auth dependency | Treat dependency/code as implemented behavior; do not copy public-access prose. Source cleanup is outside this documentation-only extraction. |
| BE-O09 | Shared query base contains campaign/invoice-specific search and limits | Preserve query ownership; do not copy domain predicates as a generic query engine. Search/pagination behavior must be specified per resource. |
| BE-O10 | Test helpers accept several denial statuses and use role convenience logic; session/package and isolated fixtures coexist | Preserve test layout, but assert exact sensitive contracts where needed. A single universal fixture scope/helper policy is not established. |
| BE-O11 | Serializer warning branch can include reset token; registration logs include submitted identity fields | MUST NOT reproduce those logging patterns as reusable examples. Existing no-secret/no-protected-data rules govern; any code correction is separate authorized work. |
| BE-O12 | Password hashing is inherited through `sap.beanie.mixins.PasswordMixin`; auth header parsing and error edge cases were not fully exercised | Do not claim a verified hashing cost/algorithm configuration or comprehensive malformed-header handling. Inspect dependency implementation and tests before certification. |
| BE-O13 | `draft/` hook skips pytest; comments describe a coverage threshold that is disabled | Keep completion checks explicit. Decide destination branch policy separately; do not claim every commit or run enforces coverage. |
| BE-O14 | Account storage/transport, OTP and session duration are existing choices, not generic FastAPI necessities | AUTH-001 settles email/password plus user-controlled email OTP enabled by default, and simple registration with email verification before first sign-in. Storage/transport, session duration and setting-change confirmation remain destination decisions. |

Sources: [auth guards](#evidence-013), [User model](#evidence-014), [auth serializers](#evidence-017), [auth routes](#evidence-023), [registration](#evidence-025), [registration serializer](#evidence-019), [app composition](#evidence-004), [Organization listing](#evidence-024), [query base](#evidence-015), [test helpers](#evidence-032), [requirements](#evidence-029), [pytest hook](#evidence-030), [pyproject](#evidence-027).

Cross-stack source inspected at UI commit `44228c0cb32a1f3028e8ec1122dd0ea1816b7605`: `src/pages/Register/index.jsx`, `src/pages/Login/index.jsx`, `src/pages/ResetPassword/index.jsx`, `src/helpers/RestClient/index.js`. These are provenance paths, not required dependencies on a sibling checkout.

### Evidence limits and resolution

Inspection did not execute application tests, contact services, prove deployment controls, audit dependency internals or extract every domain module. Source tests describe intended checks, not passing results. Runtime dependency security/currentness, clean installation, all error mappings supplied by sap, concurrent token consumption and production operations remain unverified. No real environment values or confidential operational data were used.

Resolve an item by recording the chosen rule, approval, rationale, affected contracts and verification in its owning topic, then linking the resolution here. An agent MUST NOT treat silence, an existing bug, or an example as approval for a policy change.

<a id="adoption-questions"></a>
## Accepted adoption decisions

**Accepted by the owner, 2026-11-18 — AUTH-001.** These requirements govern new and substantially modified authentication code. They describe the target contract; the observed source excerpts below are unchanged and may differ. Application implementation is separate from this documentation update.

- **Sign-in:** validate email and password first. If the account has OTP enabled, send the OTP by email only after credentials succeed, and issue a session only after OTP verification succeeds. If OTP is disabled, successful credentials complete sign-in. Users can enable or disable OTP in their own settings; the server owns and enforces this preference, rather than trusting a login-request flag. OTP MUST be enabled by default for new accounts. The confirmation needed to change this setting remains a destination implementation decision.
- **Registration:** keep generic account registration simple. Do not carry over Hajj membership, consent PDF, organization, passport or pilgrimage fields as universal requirements. The registration form collects email, password and password confirmation. Users MUST verify their email before their first sign-in; the server MUST prevent an unverified account from establishing a login session, even if OTP is disabled. Registration email verification and the subsequent login OTP are separate steps. After email verification, users follow the normal sign-in flow.
- **Password reset:** return to login after success. The reset API MUST NOT issue or return a new login session. The user then follows the normal sign-in flow, including OTP when enabled. Existing reset-token validation/consumption and retry behavior remain relevant. This decision does not select a new policy for revoking already active sessions.
- **Passwords:** use the current frontend checks in both UI and API for account creation, password setup/change and reset: JavaScript length greater than eight, at least one ASCII uppercase letter, one ASCII lowercase letter, one ASCII digit, and one character from the exact special-character set below. Confirmation must match. Login validates credentials, not new-password complexity, so existing accounts are not locked out merely by adopting this rule.

Exact frontend source (`src/pages/ResetPassword/index.jsx`, lines 92–98):

```js
  const validatePassword = (password) => {
    setPwdRuleSize(password.length > 8);
    setPwdRuleUppercase(/[A-Z]/.test(password));
    setPwdRuleLowercase(/[a-z]/.test(password));
    setPwdRuleNumber(/\d/.test(password));
    setPwdRuleSpecial(/[`!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~]/.test(password));
  };
```

This is a source fragment: the `setPwdRule*` names are React state setters, not imports. `isValidPwd` combines all five booleans; submission additionally requires matching confirmation and a valid reset token. JavaScript length counts UTF-16 code units; a Python validator must preserve this behavior or obtain approval for a different Unicode-length policy. Use ASCII `[0-9]` on Python rather than its broader Unicode `\d` semantics. No extra maximum length or whitespace restriction is established by these checks.

Synthetic shared test cases: `Example9!` passes; `Examp9!` fails length; `example9!` fails uppercase; `EXAMPLE9!` fails lowercase; `Example!!` fails digit; `Example99` fails special character. A different confirmation fails even when the password itself passes. These strings are test examples, not real credentials.

**Required verification:** new accounts have OTP enabled; unverified accounts cannot establish a session, including when OTP is disabled; after email verification, the default login still requires password success followed by email OTP success; invalid credentials do not send an OTP or issue a session; OTP-enabled login cannot issue a session before successful verification; OTP-disabled login can finish after successful credentials; changing one account's setting cannot change another's; reset success issues no session and returns to login; UI/API accept and reject the same password test cases. Verify the destination's selected confirmation flow when implementing changes to the OTP setting; these requirements do not claim that setting already exists in the source application.


<a id="examples"></a>
## Complete examples and dependency map

Files labelled **copied** retain source code; **adapted** files are educational implementations. All local imports in these complete modules resolve to definitions below. Third-party imports resolve to the packages named here and in the embedded manifests. Source evidence is separate and may contain partial bodies.

The example covers a GET endpoint, owner-scoped query, response projection and an API test. Its auth dependency denies access until integrated; tests override it. MongoDB tests require a disposable loopback database on port 27028 and were not executed. Python syntax and local imports were checked. This is not an integrated frontend/backend starter.

Python packages: `sap.*` comes from `sapx==0.3.5`; `beanie`, `motor`, `pymongo`/`bson`, `fastapi`, `httpx`, `pydantic`, `pytest`, and `pytest_asyncio` come from the embedded requirements. `typing`, `dataclasses`, `collections.abc`, `datetime`, `hashlib`, `hmac`, `os`, `json` and other standard-library imports come from Python. External library implementation is not replicated or asserted verified. The MongoDB example needs a deliberately disposable loopback server at port 27028; its fixture mutates only `engineering_documentation_example_test`.

- [backend/AppMain/__init__.py](#example-backend-appmain-init-py)
- [backend/AppMain/asgi.py](#example-backend-appmain-asgi-py)
- [backend/app/__init__.py](#example-backend-app-init-py)
- [backend/app/auth.py](#example-backend-app-auth-py)
- [backend/app/models/__init__.py](#example-backend-app-models-init-py)
- [backend/app/models/example/__init__.py](#example-backend-app-models-example-init-py)
- [backend/app/models/example/example.py](#example-backend-app-models-example-example-py)
- [backend/app/query/__init__.py](#example-backend-app-query-init-py)
- [backend/app/query/example.py](#example-backend-app-query-example-py)
- [backend/app/serializers/__init__.py](#example-backend-app-serializers-init-py)
- [backend/app/serializers/example/__init__.py](#example-backend-app-serializers-example-init-py)
- [backend/app/serializers/example/example.py](#example-backend-app-serializers-example-example-py)
- [backend/app/webapi/__init__.py](#example-backend-app-webapi-init-py)
- [backend/app/webapi/example.py](#example-backend-app-webapi-example-py)
- [backend/tests/__init__.py](#example-backend-tests-init-py)
- [backend/tests/webapi/__init__.py](#example-backend-tests-webapi-init-py)
- [backend/tests/webapi/example/__init__.py](#example-backend-tests-webapi-example-init-py)
- [backend/tests/webapi/example/conftest.py](#example-backend-tests-webapi-example-conftest-py)
- [backend/tests/webapi/example/samples.py](#example-backend-tests-webapi-example-samples-py)
- [backend/tests/webapi/example/test_example.py](#example-backend-tests-webapi-example-test-example-py)


<a id="example-backend-appmain-init-py"></a>

#### `backend/AppMain/__init__.py`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

Empty package marker file.


</details>


<a id="example-backend-appmain-asgi-py"></a>

#### `backend/AppMain/asgi.py`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

```python
from fastapi import FastAPI
from app.webapi import router_api

# Demonstration app. Tests initialize Beanie explicitly against a disposable DB.
app = FastAPI()
app.include_router(router_api)
```


</details>


<a id="example-backend-app-init-py"></a>

#### `backend/app/__init__.py`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

Empty package marker file.


</details>


<a id="example-backend-app-auth-py"></a>

#### `backend/app/auth.py`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

```python
from dataclasses import dataclass
from fastapi import HTTPException


@dataclass(frozen=True)
class Actor:
    """Identity supplied by the destination's verified auth dependency."""

    id: str


async def require_example_read() -> Actor:
    """Fail closed until real authentication is integrated; tests override this."""
    raise HTTPException(status_code=403, detail="Authentication integration required")
```


</details>


<a id="example-backend-app-models-init-py"></a>

#### `backend/app/models/__init__.py`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

```python
from .example import Example

__all__ = ["Example"]
```


</details>


<a id="example-backend-app-models-example-init-py"></a>

#### `backend/app/models/example/__init__.py`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

```python
from .example import Example

__all__ = ["Example"]
```


</details>


<a id="example-backend-app-models-example-example-py"></a>

#### `backend/app/models/example/example.py`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

```python
from sap.beanie import Document


class Example(Document):
    """Synthetic resource for the documentation example."""

    name: str
    owner_id: str
    internal_note: str = ""

    class Settings:
        """Persist in the dedicated example collection."""

        name = "example"
```


</details>


<a id="example-backend-app-query-init-py"></a>

#### `backend/app/query/__init__.py`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

Empty package marker file.


</details>


<a id="example-backend-app-query-example-py"></a>

#### `backend/app/query/example.py`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

```python
from beanie.odm.queries.find import FindMany
from app.auth import Actor
from app.models import Example


class ExampleQuery:
    """Restrict reads to the supplied actor."""

    def __init__(self, user: Actor, filters=None) -> None:
        self.user = user
        self.filters = filters

    async def get_qs(self) -> FindMany[Example]:
        return Example.find(Example.owner_id == self.user.id)
```


</details>


<a id="example-backend-app-serializers-init-py"></a>

#### `backend/app/serializers/__init__.py`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

Empty package marker file.


</details>


<a id="example-backend-app-serializers-example-init-py"></a>

#### `backend/app/serializers/example/__init__.py`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

```python
from .example import ExampleSerializer, WriteExampleSerializer
```


</details>


<a id="example-backend-app-serializers-example-example-py"></a>

#### `backend/app/serializers/example/example.py`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

```python
import typing
from pydantic import Field
from sap.fastapi.serializers import ObjectSerializer, WriteObjectSerializer
from app.models import Example


class ExampleSerializer(ObjectSerializer[Example]):
    """Public shape deliberately excludes internal_note and owner_id."""

    id: str
    name: str


class WriteExampleSerializer(WriteObjectSerializer[Example]):
    name: str = Field(min_length=1, max_length=120)

    async def create(self, **kwargs: typing.Any) -> Example:
        # Actor comes from a verified dependency, never client input.
        self.instance = await Example(name=self.name, owner_id=kwargs["request_user"].id).create()
        return self.instance
```


</details>


<a id="example-backend-app-webapi-init-py"></a>

#### `backend/app/webapi/__init__.py`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

```python
from fastapi import APIRouter
from .example import router

router_api = APIRouter()
router_api.include_router(router, prefix="/example", tags=["example"])
```


</details>


<a id="example-backend-app-webapi-example-py"></a>

#### `backend/app/webapi/example.py`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

```python
from fastapi import APIRouter, Depends, Request, status
from sap.fastapi.pagination import CursorInfo, PaginatedData
from app.auth import Actor, require_example_read
from app.query.example import ExampleQuery
from app.serializers.example import ExampleSerializer

router = APIRouter()


@router.get("/", status_code=status.HTTP_200_OK)
async def listing(
    request: Request, request_user: Actor = Depends(require_example_read)
) -> PaginatedData[ExampleSerializer]:
    cursor = CursorInfo(request=request)
    query = ExampleQuery(user=request_user, filters=request.query_params)
    qs = await query.get_qs()
    qs = qs.find(**cursor.get_beanie_query_params())
    rows = await qs.to_list()
    cursor.set_count(await qs.count())
    return ExampleSerializer.read_page(rows, request=request, cursor_info=cursor)
```


</details>


<a id="example-backend-tests-init-py"></a>

#### `backend/tests/__init__.py`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

Empty package marker file.


</details>


<a id="example-backend-tests-webapi-init-py"></a>

#### `backend/tests/webapi/__init__.py`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

Empty package marker file.


</details>


<a id="example-backend-tests-webapi-example-init-py"></a>

#### `backend/tests/webapi/example/__init__.py`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

Empty package marker file.


</details>


<a id="example-backend-tests-webapi-example-conftest-py"></a>

#### `backend/tests/webapi/example/conftest.py`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

```python
from collections.abc import AsyncGenerator
import pytest_asyncio
from beanie import init_beanie
from httpx import ASGITransport, AsyncClient
from motor.motor_asyncio import AsyncIOMotorClient
from app.auth import Actor, require_example_read
from app.models import Example
from AppMain.asgi import app
from .samples import sample_examples


@pytest_asyncio.fixture
async def example_client() -> AsyncGenerator[AsyncClient, None]:
    # Use only a deliberately disposable loopback MongoDB, never a deployed DB.
    mongo = AsyncIOMotorClient("mongodb://127.0.0.1:27028", serverSelectionTimeoutMS=2000)
    database = mongo["engineering_documentation_example_test"]
    await init_beanie(database=database, document_models=[Example])
    await Example.find_all().delete()
    for row in sample_examples:
        await Example(**row).create()
    async def actor() -> Actor:
        return Actor(id="reader")
    app.dependency_overrides[require_example_read] = actor
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            yield client
    finally:
        app.dependency_overrides.clear()
        await Example.find_all().delete()
        mongo.close()
```


</details>


<a id="example-backend-tests-webapi-example-samples-py"></a>

#### `backend/tests/webapi/example/samples.py`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

```python
sample_examples = [
    {"name": "Synthetic example", "owner_id": "reader", "internal_note": "Not public"},
    {"name": "Other actor", "owner_id": "other", "internal_note": "Not public"},
]
```


</details>


<a id="example-backend-tests-webapi-example-test-example-py"></a>

#### `backend/tests/webapi/example/test_example.py`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

```python
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_listing_returns_public_fields(example_client: AsyncClient) -> None:
    response = await example_client.get("/example/")
    assert response.status_code == 200
    body = response.json()
    assert body["object"] == "list"
    assert body["count"] == 1
    assert body["data"][0]["name"] == "Synthetic example"
    assert "internal_note" not in body["data"][0]
    assert "owner_id" not in body["data"][0]
    assert body["next"] is None
    assert body["previous"] is None
```


</details>


<a id="evidence"></a>
## Embedded source evidence

Inspected source snapshot: 2026-11-18. Paths and original line spans identify provenance; they are not dependencies on the original checkout. Expand an entry to read actual source. Partial excerpts are labelled `text` and are not standalone programs. Configuration snapshots record observed versions, not an instruction to retain unused packages or freeze versions. Contradictory comments and observed defects are not endorsed rules.

<a id="evidence-002"></a>

### evidence-002: `proj-ehadj-api/.pre-commit-config.yaml`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 1–53:

````text
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: check-added-large-files
      - id: check-yaml
      - id: check-toml
      - id: check-merge-conflict
      - id: debug-statements
      - id: mixed-line-ending
      - id: end-of-file-fixer
      - id: trailing-whitespace
      - id: no-commit-to-branch
        args: [--branch, release, --branch, staging, --branch, main]
  - repo: https://github.com/PyCQA/isort
    rev: 5.13.2
    hooks:
      - id: isort
        name: isort-check
        args: [--check]
  - repo: https://github.com/psf/black
    rev: 24.10.0
    hooks:
      - id: black
        name: black-check
        args: [--check]
  - repo: local
    hooks:
      - id: mypy-check
        args: []
        name: mypy-check
        entry: mypy
        types: [python]
        language: system
      - id: pydocstyle-check
        args: []
        name: pydocstyle-check
        entry: pydocstyle
        types: [python]
        language: system
      - id: pylint-check
        args: []
        name: pylint-check
        entry: pylint
        types: [python]
        language: system
      - id: pytest-check
        args: []
        name: pytest-check
        entry: scripts/pre-commit-pytest.sh
        language: script
        pass_filenames: false
        always_run: true
````

</details>

<a id="evidence-003"></a>

### evidence-003: `proj-ehadj-api/AGENTS.md`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 1–45:

````text
# eHadj API Agent Instructions

## Project overview

This repository is the canonical agent workspace for the eHadj FastAPI backend. It must be usable when opened without the parent workspace.

eHadj manages the Hajj pilgrimage process for Benin. The backend owns API routes, authorization, business rules, persistence, audit logging, notification handling, background work, external-service integrations, protected API docs, and backend documentation.

For full-stack work, inspect the frontend repository when it is available. If the frontend repository is not available and the task affects frontend consumption, route visibility, or user-facing contract behavior, stop at a documented contract gap instead of inventing frontend behavior.

## Start here

Read these files before changing backend code or backend documentation:

1. `AGENTS.md`
2. `CONTEXT.md`
3. `README.md`
4. relevant docs under `doc_utilisation/`, `features_docs/`, `planned_integration_docs/`, `doc_features_improvement/`, `audit_module/`, `notification_module/`, or `docs/security/references/`
5. the relevant workflow under `skills/`

## Important directories

- `AppMain/`: ASGI app, settings, middleware, app initialization.
- `app/webapi/`: API route modules.
- `app/models/`: Beanie document models and enums.
- `app/serializers/`: serializers and validation logic.
- `app/controllers/`: business operation helpers.
- `app/query/`: listing, filtering, and query logic.
- `app/tasks/`: background and external-service tasks.
- `audit_module/`: audit middleware, models, logging, and migration utilities.
- `notification_module/`: notification models, controllers, serializers, and WebSocket utilities.
- `docs/legacy-agent-notes/`: archived non-canonical backend skill notes.
- `skills/`: canonical backend agent workflows and review skills.
- `tasks/lessons.md`: durable backend lessons and pitfalls.

## Commands

- Create venv: `virtualenv .venv --python=python3.12`
- Activate venv: `source .venv/bin/activate`
- Install dev dependencies: `pip install -r requirements-dev.txt`
- Pre-commit setup: `pre-commit install`
- Dev server: `python main.py`
- Test: `pytest`
- Format: `black .`
- Sort imports: `isort .`
````

</details>

<a id="evidence-004"></a>

### evidence-004: `proj-ehadj-api/AppMain/asgi.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 56–91:

````text
async def lifespan(current_app: FastAPI) -> typing.AsyncGenerator[None, None]:
    """Initialize beanie for main and audit databases on startup."""
    assert current_app

    # Init main DB
    await initialize_beanie()
    # Init audit DB
    client = motor.motor_asyncio.AsyncIOMotorClient(audit_settings.get_mongodb_url())
    await init_beanie(database=client[audit_settings.get_mongodb_db_name()], document_models=[AuditEvent])

    # Start background tasks
    # quota_task = asyncio.create_task(run_periodic_quota_check(interval_second=20))
    #
    # The periodic workers poll the database and acquire shared locks. They must
    # not run inside the test suite, where they would race with deterministic
    # controller assertions and leak the queue lock on cancellation.
    tasks: list[tuple[asyncio.Task, str]] = []
    if AppSettings.TEST_ENV == "NONE":
        tasks = [
            # (asyncio.create_task(run_periodic_quota_check(interval_second=20)), "Quota checker"),
            (asyncio.create_task(run_periodic_bank_payment_queue()), "Bank payment queue"),
            (asyncio.create_task(run_periodic_ecobank_payment_queue()), "Ecobank payment queue"),
        ]

    yield

    # Stop tasks upon application shutdown
    for task, name in tasks:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            logger.info("%s task cancelled.", name)


# Initialize application
````

Original lines 180–253:

````text
app_api = FastAPI(
    docs_url=None, redoc_url=None, openapi_url=None, title=AppSettings.PROJ_NAME, description="eHadj project API"
)


@app_api.get("/doc", include_in_schema=False)
async def custom_swagger_ui_html(
    request: Request,
    request_user: User = Depends(
        user_auth.require([RoleEnum.BANK1, RoleEnum.AGLO1, RoleEnum.DSI1, RoleEnum.MAEC1, RoleEnum.ASIN1])
    ),
) -> HTMLResponse:
    """Protect swagger doc endpoint."""
    return get_swagger_ui_html(openapi_url="/api/v1/openapi.json", title=f"{AppSettings.PROJ_NAME} - Documentation")


@app_api.get("/docs", include_in_schema=False)
async def custom_redoc_html(
    request: Request,
    request_user: User = Depends(
        user_auth.require([RoleEnum.BANK1, RoleEnum.AGLO1, RoleEnum.DSI1, RoleEnum.MAEC1, RoleEnum.ASIN1])
    ),
) -> HTMLResponse:
    """Protect redoc doc endpoint."""
    return get_redoc_html(openapi_url="/api/v1/openapi.json", title=f"{AppSettings.PROJ_NAME} - Documentation")


@app_api.get("/openapi.json", include_in_schema=False)
async def custom_openapi(
    request: Request,
    request_user: User = Depends(
        user_auth.require([RoleEnum.BANK1, RoleEnum.AGLO1, RoleEnum.DSI1, RoleEnum.MAEC1, RoleEnum.ASIN1])
    ),
) -> JSONResponse:
    """Protect openapi doc endpoint."""
    return JSONResponse(app_api.openapi())


app_api.include_router(router_api)
app.routes.append(Mount(path="/api/v1", app=app_api, name="api"))

# Mount Web App
app_pages = FastAPI(
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    title=AppSettings.PROJ_NAME,
    description="eHadj web application",
)
app.routes.append(Mount(path="/pages", app=app_pages, name="pages"))

# Load sub-apps routes and documents
document_models = []

# Retrieve the lists of documents for beanie initialization
for model_name in models.__all__:
    document_models.append(getattr(models, model_name))


# Register middleware
app.add_middleware(InitBeanieMiddleware, mongo_params=AppSettings.MONGO, document_models=document_models)
app.add_middleware(InitGlobalParamsMiddleware)
app_pages.add_middleware(SessionMiddleware, session_cookie="starlette", secret_key=AppSettings.CRYPTO_SECRET)
app_pages.add_middleware(InitJinjaGlobalsMiddleware)

##########################################################################
# Add security middleware to avoid middle man attack for kkiapay payment #
##########################################################################


# This must match the secret in your React code exactly
async def verify_signature(request: Request, body: bytes) -> bool:
    """Verify the integrity of incoming requests using HMAC signature."""
    # 1. Extract headers
````

Original lines 316–327:

````text
# app.add_middleware(IntegrityMiddleware)

###################################################
#                    END                          #
###################################################


# Events to run on startups
async def initialize_beanie() -> None:
    """Initialize beanie on startup."""
    await BeanieClient.init(mongo_params=AppSettings.MONGO, document_models=document_models)
    try:
````

Original lines 329–338:

````text

        org_coll = Organization.get_motor_collection()
        indexes = await org_coll.index_information()
        if "unique_ecobank_user_id" in indexes:
            await org_coll.drop_index("unique_ecobank_user_id")
            logger.info("Dropped legacy unique_ecobank_user_id index on organization collection.")
    except Exception as exc:  # pylint: disable=broad-except
        logger.warning(f"Could not drop legacy unique_ecobank_user_id index: {exc}")

    try:
````

Original lines 340–359:

````text

        cat_coll = Category.get_motor_collection()
        indexes = await cat_coll.index_information()
        if "name_1" in indexes and indexes["name_1"].get("key") == [("name", 1)]:
            await cat_coll.drop_index("name_1")
            logger.info("Dropped legacy name_1 index on category collection.")
    except Exception as exc:  # pylint: disable=broad-except
        logger.warning(f"Could not drop legacy name_1 index on category: {exc}")


# Always log exception
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Log all request validation errors to a file."""
    logger.exception(exc.errors())
    return await request_validation_exception_handler(request=request, exc=exc)


async def update_uvicorn_logger() -> None:
    """Log all uvicorn errors."""
````

</details>

<a id="evidence-005"></a>

### evidence-005: `proj-ehadj-api/AppMain/settings.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 52–72:

````text
    model_config = pydantic_settings.SettingsConfigDict(
        env_file=os.getenv("APP_DOTENV", ".env"),
        env_file_encoding="utf-8",
        env_prefix="APP_SETTINGS_",
        env_nested_delimiter="__",
        extra="allow",
    )

    PROJ_NAME: str = "ehadj"

    # Envs
    APP_ENV: str = os.getenv("APP_ENV", "DEV")
    LOG_DIR: str = "/tmp/"
    APP_DIR: pathlib.Path = pathlib.Path(__file__).parent.parent
    THEME_COFFEE_CDN: str = "https://theme-coffee.vercel.app"
    FRONTEND_URL: str = "https://ui.ehadj.cactuce.com"

    # Databases
    MONGO: DatabaseParams

    # Tokens
````

Original lines 74–109:

````text
    TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours, password-reset/registration JWT
    SESSION_EXPIRE_MINUTES: int = 60 * 24  # 24 hours, login auth_key lifetime

    # Application-level attempt limiting for the credential endpoints.
    AUTH_MAX_ATTEMPTS: int = 5
    AUTH_ATTEMPT_WINDOW_SECONDS: int = 900  # 15 minutes
    AUTH_LOCK_SECONDS: int = 900  # 15 minutes

    # Email
    EMAIL_ENABLED: bool = True
    EMAIL_SENDER_NAME: str = "eHadj Bénin"
    EMAIL_SENDER_EMAIL: str = "daniel@emails.cactuce.com"
    RESEND_API_KEY: str
    SENDGRID_SECRET: str = ""

    # Payment
    KKIAPAY_PUBLIC_API_KEY: str = "77a779a0d53611f0a7d5b7ce12c1aea8"
    KKIAPAY_PRIVATE_API_KEY: str = "tpk_77a7c7c0d53611f0a7d5b7ce12c1aea8"
    KKIAPAY_SECRET: str = "tsk_77a7eed0d53611f0a7d5b7ce12c1aea8"
    # No default: the webhook must fail closed when the signing secret is not
    # supplied by the environment instead of trusting a value committed to git.
    KKIAPAY_SECRET_HASH: str = ""
    SIGNING_SECRET: str = "9b1d2c3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b977d1e2f3a4b5c6d7e8f9a0b1c"
    BANK_PAYMENT_ENDPOINT: str | None = None
    BANK_API_KEY: str | None = None
    BANK_API_TIMEOUT_SECONDS: float = 45.0
    BANK_API_SIMULATION_MODE: bool = False
    BANK_QUEUE_POLL_INTERVAL_SECONDS: int = 5
    BANK_QUEUE_LOCK_SECONDS: int = 60
    ECOBANK_MODE: typing.Literal["disabled", "simulated", "uat", "live"] = "uat"
    ECOBANK_AUTH_URL: str = "https://apimuat-gateway.ecobank.com/corp-auth/api/v2/integration/auth/app/token"
    ECOBANK_GATEWAY_URL: str = "https://apimuat-gateway.ecobank.com/corp-directdebit/api/v2/integration/directdebit"
    ECOBANK_CLIENT_ID: str | None = None
    ECOBANK_AFFILIATE_CODE: str = "EGH"
    ECOBANK_SOURCE_CODE: str = "CORP_CIB_MOBILE"
    ECOBANK_AUTH_TIMEOUT_SECONDS: pydantic.PositiveFloat = 10.0
````

</details>

<a id="evidence-006"></a>

### evidence-006: `proj-ehadj-api/README.md`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 23–30:

````text
This is the app project template structure using FastAPI.
This template is based on the following technologies:

- [FastAPI](https://fastapi.tiangolo.com/) as web framework
- [MongoDB](https://www.mongodb.com/docs/) as database
- [Beanie](https://roman-right.github.io/beanie/) as ODM
- [Pytest](https://docs.pytest.org/) as testing framework
- [Github Actions](https://docs.github.com/en/actions) for workflow automation
````

</details>

<a id="evidence-007"></a>

### evidence-007: `proj-ehadj-api/app`

Observed immediate directory entries (names only):

```text
__init__.py
__pycache__/
controllers/
middleware.py
models/
query/
serializers/
tasks/
views/
webapi/
xlib/
```

<a id="evidence-008"></a>

### evidence-008: `proj-ehadj-api/app/controllers/auth_throttle.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 26–73:

````text
async def assert_not_locked(scope: str, identifier: str) -> None:
    """Refuse the attempt when the identifier is currently locked."""
    record = await _get(scope, identifier)
    if record is None or record.locked_until is None:
        return
    if _now() < record.locked_until:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Trop de tentatives. Veuillez réessayer plus tard.",
        )


async def register_failure(scope: str, identifier: str) -> None:
    """Count a failed attempt and lock the identifier once the threshold is reached."""
    now = _now()
    max_attempts = AppSettings.AUTH_MAX_ATTEMPTS
    window = datetime.timedelta(seconds=AppSettings.AUTH_ATTEMPT_WINDOW_SECONDS)
    lock = datetime.timedelta(seconds=AppSettings.AUTH_LOCK_SECONDS)

    record = await _get(scope, identifier)
    if record is None:
        await AuthThrottle(
            scope=scope,
            identifier=identifier,
            attempts=1,
            window_started_at=now,
            locked_until=now + lock if max_attempts <= 1 else None,
        ).create()
        return

    if record.window_started_at + window < now:
        # The previous window elapsed: start a fresh one instead of cumulating.
        record.attempts = 1
        record.window_started_at = now
        record.locked_until = None
    else:
        record.attempts += 1
        if record.attempts >= max_attempts:
            record.locked_until = now + lock
    await record.save()


async def register_hit(scope: str, identifier: str) -> None:
    """Count a non-credential request (for example a reset-link request).

    Used for endpoints that must be rate limited but have no success/failure
    notion, so the counter is never cleared by a successful call.
    """
````

</details>

<a id="evidence-009"></a>

### evidence-009: `proj-ehadj-api/app/controllers/user.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 15–35:

````text
async def user_deactivate(user: User) -> bool:
    """Update activation status to False and drop the interactive session."""
    if not user.is_superuser:
        await user.set({"is_active": False, "auth_key": None, "auth_key_expires_at": None})
        return True
    return False


async def user_activate(user: User) -> bool:
    """Update activation status to True."""
    await user.set({"is_active": True})
    return True


async def issue_login_otp(user: User) -> dict[str, typing.Any]:
    """Send a login OTP to the user's email and refuse a second pending code.

    Shared by the staff login endpoint and the restricted pilgrim login
    endpoint so the second factor cannot drift between the two flows.
    """
    # Local import keeps the serializer <-> controller import graph acyclic.
````

Original lines 37–45:

````text

    if user.has_pending_otp():
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Un code de vérification a déjà été envoyé à votre email. Veuillez l'utiliser ou réessayer dans 3 minutes avant de demander un nouveau code.",
        )

    # Rate limit repeated OTP requests independently from the pending-code guard,
    # which only covers the three-minute lifetime of a single code.
````

Original lines 47–63:

````text

    identifier = str(user.email)
    await auth_throttle.assert_not_locked("otp_request", identifier)
    await auth_throttle.register_hit("otp_request", identifier)

    otp_code = passlib.pwd.genword(length=6, charset="ascii_62")
    await user.set_otp(otp_code, ttl_seconds=180)
    try:
        await send_otp_email(user=user, otp=otp_code, ttl_minutes=3)
    except Exception:
        await user.clear_otp()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Impossible d'envoyer l'OTP.")

    return {
        "result": True,
        "message": "Code de vérification envoyé à l'email associé. Vous devez valider le code pour terminer la connexion.",
    }
````

</details>

<a id="evidence-010"></a>

### evidence-010: `proj-ehadj-api/app/models/__init__.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 1–6:

````text
"""
# Models.

Models define logical structuring of the data in the database.
"""

````

Original lines 17–18:

````text

# Notification imports User; initialize the application models first.
````

Original lines 20–43:

````text

__all__ = [
    "BankPaymentAttempt",
    "AuthThrottle",
    "Campaign",
    "CartItem",
    "Deposit",
    "EcobankCustomerProfile",
    "Invoice",
    "Notification",
    "Organization",
    # "Agency",  # Excluded to avoid init by beanie as it is a proxy model
    "QuotaCounter",
    "QuotaReservation",
    "Trip",
    "Preference",
    "Product",
    "User",
    "Permissions",
    "Category",
    "CategoryLinked",
    "Group",
    "Pilgrim",
]
````

</details>

<a id="evidence-011"></a>

### evidence-011: `proj-ehadj-api/app/models/category/category.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 17–39:

````text
class Category(Document, extra="allow"):  # type: ignore
    """Represent a pligrim category."""

    name: str
    description: str
    price: Price
    max_seats: int = 0
    agency_ids: list[str] | None = None
    # Kept nullable only while the explicit legacy-data migration is rolled out.
    # Application writes and reads always require a campaign association.
    campaign: Link[Campaign] | None = None

    class Settings:
        """Settings for the database collection."""

        name = "category"
        indexes = [
            pymongo.IndexModel(
                [("name", pymongo.ASCENDING), ("campaign", pymongo.ASCENDING)],
                unique=True,
                name="name_1_campaign_1",
            )
        ]
````

</details>

<a id="evidence-012"></a>

### evidence-012: `proj-ehadj-api/app/models/enums.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 10–64:

````text
class OrgTypeEnum(str, enum.Enum):
    """The type of institution.

    Government institution have many types.
    This is because each institution plays a different role.
    """

    DSI = "DSI"  # DSI - Presidency Information Systems Department
    AGLO = "AGLO"  # Agency for Officials Logistics Management
    ASIN = "ASIN"  # Agency for Information Systems and Digital
    DEI = "DEI"  # Department of Emigration and Immigration
    MS = "MS"  # Ministry of Health
    MAEC = "MAEC"  # Ministry of Foreign Affairs and Cooperation
    BANK = "BANK"  # Banks
    SA = "SA"  # Licensed Company
    ANONYMOUS = "ANONYMOUS"  # Anonymous
    PILGRIM = "PILGRIM"  # Pilgrim using the platform


class ProductCategoryEnum(str, enum.Enum):
    """Category of the product."""

    REGISTRATION = "REGISTRATION"
    TRANSPORT = "TRANSPORT"
    ACCOMMODATION = "ACCOMMODATION"
    FOOD = "FOOD"
    EXTRA = "EXTRA"

    @classmethod
    def get_info(cls, choice: "ProductCategoryEnum") -> str:
        """Return human readable value of the enum."""
        return {
            cls.REGISTRATION: "Enregistrement",
            cls.TRANSPORT: "Transport",
            cls.ACCOMMODATION: "Hébergement",
            cls.FOOD: "Nourriture",
            cls.EXTRA: "Divers",
        }[choice]


class RoleEnum(str, enum.Enum):
    """List of roles available for users.

    Each role has different access and set of permissions.
    """

    DSI1 = "DSI1"  # DSI - Super administrator
    DSI2 = "DSI2"  # DSI - secondary user
    AGLO1 = "AGLO1"  # AGLO - Administrators
    AGLO2 = "AGLO2"  # AGLO - secondary user
    ASIN1 = "ASIN1"  # ASIN - Administrators
    ASIN2 = "ASIN2"  # ASIN - secondary user
    BANK1 = "BANK1"  # Banks - Primary user
    BANK2 = "BANK2"  # Bank - secondary user
    DEI1 = "DEI1"  # DEI - Primary user
````

</details>

<a id="evidence-013"></a>

### evidence-013: `proj-ehadj-api/app/models/user/auth.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 50–85:

````text
    async def authenticate(self, request: Request) -> User:
        """Provide the authenticated user to views that require it."""
        assert self.user_model and issubclass(self.user_model, Document)

        # Check if this is an anonymous route first
        if any(request.url.path.startswith(route) for route in self.public_routes):
            # Return an anonymous user without requiring auth headers
            anonymous = await self._get_anonymous_user()
            request_actor.set(anonymous)
            return anonymous

        header_auth: str | None = request.headers.get("Authorization") or request.headers.get("X-Beans-Authorization")

        if not header_auth:
            raise HTTPException(HTTP_401, detail="Authentication required")

        scheme, credentials = header_auth.split()
        if scheme.lower() != "basic":
            raise HTTPException(HTTP_401, detail="Only basic authorization is supported")

        try:
            decoded = base64.b64decode(credentials).decode("ascii")
        except (ValueError, UnicodeDecodeError, binascii.Error) as exc:
            raise HTTPException(HTTP_401, detail="Error while decoding basic auth credentials") from exc

        username, _, pwd = decoded.partition(":")
        user_key = username or pwd

        if auth_key_name := self.get_auth_key_attribute():
            auth_key = getattr(self.user_model, auth_key_name)
        else:
            auth_key = None

        if auth_key:
            try:
                user = await self.user_model.find_one_or_404(
````

Original lines 110–192:

````text
    def _assert_session_alive(user: User, presented_key: str) -> None:
        """Refuse an expired login credential.

        ``api_key`` is a long-lived machine credential and is not bound to the
        interactive session lifetime. A missing ``auth_key_expires_at`` is
        treated as expired so a legacy key cannot outlive the session policy.
        """
        if user.api_key and presented_key == user.api_key:
            return
        expires_at = getattr(user, "auth_key_expires_at", None)
        if expires_at is None:
            raise HTTPException(HTTP_401, detail="Session expirée. Veuillez vous reconnecter.")
        if expires_at.tzinfo is not None:
            expires_at = expires_at.replace(tzinfo=None)
        if _naive_utc_now() >= expires_at:
            raise HTTPException(HTTP_401, detail="Session expirée. Veuillez vous reconnecter.")

    @staticmethod
    async def _get_anonymous_user() -> User:
        """Return anonymous user."""
        anonymous_user = await User.find_one({"roles": RoleEnum.ANONYMOUS1})
        if not anonymous_user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Anonymous user not found in database")
        return anonymous_user

    def require(
        self, perms: typing.Union[list[str], list[RoleEnum]]
    ) -> typing.Callable[[Request], typing.Awaitable[User]]:
        """Authenticate the user and check that they have enough privilege to access resource."""

        async def auth_with_perms(request: Request) -> User:
            # Check if this is an anonymous route first
            if any(request.url.path.startswith(route) for route in self.public_routes):
                # For anonymous routes, skip the permission check
                anonymous = await self._get_anonymous_user()
                request_actor.set(anonymous)
                return anonymous

            # For non-anonymous routes, do the regular auth and permission check
            user: User = await self.authenticate(request=request)

            if not user.has_perms(perms):
                raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not enough permission to access resource")
            await self._assert_active_organization(user)
            return user

        return auth_with_perms

    def require_active(
        self, perms: typing.Union[list[str], list[RoleEnum]]
    ) -> typing.Callable[[Request], typing.Awaitable[User]]:
        """Require a role on the user's currently active organization.

        ``require`` remains suitable for platform-wide capabilities. Routes
        that read or mutate organization-scoped data must use this dependency
        so a role held for one organization cannot be used in another context.
        """

        async def auth_with_active_perms(request: Request) -> User:
            user: User = await self.authenticate(request=request)

            if not user.has_perms(perms):
                raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not enough permission to access resource")
            if not user.has_active_perms(perms):
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN,
                    detail="The active organization does not have permission to access this resource",
                )
            await self._assert_active_organization(user)
            return user

        return auth_with_active_perms

    @staticmethod
    async def _assert_active_organization(user: User) -> None:
        """Deny an organization-scoped request when its active organization is inactive.

        The login serializer checks organization status once, at authentication
        time. Deactivating an organization afterwards must also revoke the
        organization-scoped routes, otherwise a member keeps access with an
        already issued token.
        """
        # Local import avoids a models <-> auth import cycle.
````

Original lines 244–251:

````text
    async def _enforce_action(user: User, action: str) -> None:
        """Refuse an action disabled for the user's active role by the lock matrix.

        A missing permission document or a missing action key keeps the
        historical behaviour (allowed) so the matrix can be rolled out
        progressively without breaking roles that are not yet configured.
        """
        # Local import avoids a models <-> auth import cycle.
````

Original lines 253–270:

````text

        role = user.get_active_role() or (user.roles[0] if user.roles else None)
        if role is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No active role for this action")

        permission = await Permissions.find_one({"role": role})
        if permission is None:
            return
        if permission.actions.get(action, True):
            return

        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Cette action est verrouillée sur la plateforme.",
        )


user_auth = UserAuth(user_model=User)
````

</details>

<a id="evidence-014"></a>

### evidence-014: `proj-ehadj-api/app/models/user/user.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 180–229:

````text
    def has_perm(self, perm: typing.Union[str, RoleEnum]) -> bool:
        """Check if the user has access to a specific role permission."""
        if perm == "*":
            return self.is_active

        # Normalize comparisons so RoleEnum and raw string values both work.
        perm_value = self._normalize_role_value(perm)
        role_values = {self._normalize_role_value(role) for role in self.roles}
        return perm_value in role_values and self.is_active

    def has_perms(self, perms: typing.Union[list[str], list[RoleEnum]]) -> bool:
        """Check if the user has access to any of the provided permissions."""
        return any(self.has_perm(perm) for perm in perms)

    def has_active_perm(self, perm: typing.Union[str, RoleEnum]) -> bool:
        """Check a permission against the active organization membership only."""
        if perm == "*":
            return self.is_active and self.get_active_role() is not None

        active = self.get_active_role()
        if active is None:
            return False

        perm_value = self._normalize_role_value(perm)
        active_value = self._normalize_role_value(active)
        return self.is_active and active_value == perm_value

    def has_active_perms(self, perms: typing.Union[list[str], list[RoleEnum]]) -> bool:
        """Check whether the active organization has any requested role."""
        return any(self.has_active_perm(perm) for perm in perms)

    async def fetch_default(self) -> None:
        """Fetch default related data."""
        for org_link in self.organizations:
            # If the organization entry is a Link, fetch and attach the
            # resolved document to `doc`. If it's already a fetched
            # Document instance, do nothing (setting `doc` would raise).
            if hasattr(org_link, "fetch"):
                resolved = await org_link.fetch()
                # Only attach to links, not to already-resolved Document objects
                if hasattr(org_link, "doc") and not isinstance(org_link, Document):
                    org_link.doc = resolved

    @classmethod
    def filter_admin(cls, related_items: list["User"], item: "Organization") -> typing.Self | None:
        """Select the primary administrator explicitly linked to an organization."""
        return next(
            (
                user
                for user in related_items
````

Original lines 236–237:

````text
    async def generate_auth_key(self) -> None:
        """Generate a random string for auth token and stamp its lifetime."""
````

Original lines 239–271:

````text

        expires_at = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) + datetime.timedelta(
            minutes=AppSettings.SESSION_EXPIRE_MINUTES
        )
        await self.set(
            {
                "auth_key": passlib.pwd.genword(length=32, charset="ascii_62"),
                "auth_key_expires_at": expires_at,
            }
        )

    async def generate_api_key(self) -> None:
        """Generate a random string for api token."""
        await self.set({"api_key": passlib.pwd.genword(length=32, charset="ascii_62")})

    async def set_otp(self, code: str, ttl_seconds: int = 180) -> None:
        """Set OTP code with expiration (UTC).

        :param code: otp string
        :param ttl_seconds: ttl in seconds (default 3 minutes)
        """
        expires_at = datetime.datetime.now() + datetime.timedelta(seconds=ttl_seconds)
        await self.set({"otp_code": code, "otp_expires_at": expires_at, "otp_requested_at": datetime.datetime.now()})

    async def clear_otp(self) -> None:
        """Clear OTP fields."""
        await self.set({"otp_code": None, "otp_expires_at": None, "otp_requested_at": None})

    def verify_otp(self, code: str) -> bool:
        """Verify an OTP against stored value and expiration.

        Note: this method does not persist changes; use `clear_otp` to remove used OTP.
        """
````

Original lines 273–302:

````text

        if not self.otp_code or not self.otp_expires_at:
            return False
        # Compare code and ensure not expired
        try:
            now = datetime.datetime.now()
            if now > self.otp_expires_at:
                return False
        except Exception:
            return False
        # Constant-time comparison prevents timing side-channel attacks.
        return hmac.compare_digest(self.otp_code, code)

    def has_pending_otp(self) -> bool:
        """Check if user has a valid (non-expired) OTP pending.

        Returns True if OTP exists and has not expired.
        """
        if not self.otp_code or not self.otp_expires_at:
            return False
        try:
            now = datetime.datetime.now()
            return now <= self.otp_expires_at
        except Exception:
            return False

    @classmethod
    async def find_current(cls, email: str) -> typing.Self | None:
        """Retrieve user valid according to campaign."""
        return await User.find_one(
````

</details>

<a id="evidence-015"></a>

### evidence-015: `proj-ehadj-api/app/query/_base.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 17–77:

````text
class Query(typing.Generic[DocT]):
    """Fetch some key statistics to display in the interface."""

    user: User  # The user that performed the query
    filters: dict[str, str | None]
    preference: Preference
    campaign: Campaign
    total: int = 0

    def __init__(
        self,
        user: User,
        filters: typing.Union[dict[str, str | None], QueryParams, None] = None,
        campaign: typing.Optional[Campaign] = None,
    ) -> None:
        """Init with context."""
        self.user = user
        self.filters = extract_filter_params(filters or {})
        self.preference = Preference.get_default()
        self.campaign = campaign or Campaign.get_default()

    async def get_qs(self) -> FindMany[DocT]:
        """Instantiate a new query object to avoid cache pollution."""
        raise NotImplementedError

    async def get_search(self, search_text: str) -> FindMany[DocT]:
        """Apply a partial search for the initial queryset.

        Supports full-name searches across first_name + last_name fields, e.g.
        searching "Ahmadou Fatai Thierno" will match documents where the tokens
        are split across first_name and last_name in any combination.
        """
        # Escape special characters in search
        escaped_text = re.escape(search_text)
        # Preparing the search pattern
        search_pattern = prepare_search_string(escaped_text)

        # Pre-fetch matching invoice IDs
        matching_invoices = await Invoice.find(
            Invoice.campaign.id == self.campaign.id,
            {"code": {"$regex": search_pattern, "$options": "i"}},
        ).to_list()
        invoice_ids = [inv.id for inv in matching_invoices]

        qs = await self.get_qs()
        return qs.find(
            {
                "$or": [
                    {"ifu": {"$regex": search_pattern, "$options": "i"}},
                    {"code": {"$regex": search_pattern, "$options": "i"}},
                    {"name": {"$regex": search_pattern, "$options": "i"}},
                    {"email": {"$regex": search_pattern, "$options": "i"}},
                    {"first_name": {"$regex": search_pattern, "$options": "i"}},
                    {"last_name": {"$regex": search_pattern, "$options": "i"}},
                    {"invoice.$id": {"$in": invoice_ids}},
                ]
            },
            limit=50,
        )

    def get_qs_agency(self) -> FindMany[Agency]:
````

Original lines 82–95:

````text
    async def retrieve(self, id_str: str) -> DocT:
        """Retrieve a specific object by id that also match the query."""
        qs = await self.get_qs()
        qs = qs.find({"_id": beanie.PydanticObjectId(id_str)})
        result = await qs.to_list()
        if not result:
            raise Object404Error
        return result[0]


class StatsCollection(typing.TypedDict):
    """Return a list of statistics."""

    data: list[StatSerializer]
````

</details>

<a id="evidence-016"></a>

### evidence-016: `proj-ehadj-api/app/query/organization.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 16–37:

````text
class OrganizationQuery(Query[Organization]):
    """Fetch some key statistics to display in the interface."""

    async def get_qs(self) -> FindMany[Organization]:
        """Instantiate a new query object to avoid cache pollution."""
        qs: FindMany[Organization] = Organization.find()
        if not self.user.active_organization_id:
            logger.warning("User %s has no active organization selected", self.user.id)
            # return an empty find
            return Organization.find({"_id": None})
        user_organization = await Organization.get_or_404(self.user.active_organization_id)

        if self.user.has_active_perms([RoleEnum.DSI1, RoleEnum.ASIN1]):
            qs = qs.find(
                Organization.type != OrgTypeEnum.SA,
                Organization.type != OrgTypeEnum.ANONYMOUS,
                Organization.type != OrgTypeEnum.PILGRIM,
            )
        else:
            qs = qs.find(Organization.type == user_organization.type)

        return qs
````

</details>

<a id="evidence-017"></a>

### evidence-017: `proj-ehadj-api/app/serializers/auth.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 49–84:

````text
class ResetPasswordSerializer(WriteObjectSerializer[User]):
    """
    Password reset validation.

    Allow the user to set a new password.
    """

    token: str
    password: str = Field(min_length=8)
    password2: str = Field(min_length=8)

    @pydantic.field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        """Verify that the password fit security criteria."""
        if not re.findall(r"[a-zA-Z]+", value):
            raise AssertionError("Votre mot de passe doit contenir au moins une lettre.")
        if not re.findall(r"[0-9]+", value):
            raise AssertionError("Votre mot de passe doit contenir au moins 1 chiffre.")
        if re.match(r"^\w+$", value):
            raise AssertionError("Votre mot de passe doit contenir au moins 1 caractère spécial.")
        return value

    @pydantic.model_validator(mode="after")
    def validate_passwords_equals(self) -> typing.Self:
        """Verify that both password are equals."""
        assert self.password == self.password2, "Le mot de passe de confirmation ne corresponds pas."
        return self

    async def run_async_validators(self, **kwargs: typing.Any) -> None:
        """Check that data pass DB validation."""
        await self.verify_jwt_token()

        # Ensure that verify_jwt_token actually set the instance. If not,
        # raise an HTTP 401 rather than letting `update()` assert and cause a 500.
        if not self.instance:
````

Original lines 96–102:

````text
    async def verify_jwt_token(self) -> bool:
        """Check that the token is valid, unused, and bound to its user.

        The token carries a random ``nonce``; the SHA-256 of that nonce is
        stored on the user. A token whose nonce does not match the stored hash
        (already consumed, or forged) is refused, so the link is single-use.
        """
````

Original lines 105–131:

````text

        try:
            jwt_data = jwt.decode(self.token, key=AppSettings.CRYPTO_SECRET, algorithms=["HS256"])
        except jwt.exceptions.InvalidTokenError:
            logger.warning("JWT token invalid for password reset")
            _invalid_reset_link()

        user_id = jwt_data.get("user_id")
        nonce = jwt_data.get("nonce")
        user: User | None = None
        if user_id:
            try:
                user = await User.get(user_id)
            except Exception:  # pylint: disable=broad-except
                user = None

        if not user_id or not nonce or user is None or not user.password_reset_token_hash:
            logger.warning("Reset token unusable for user_id=%s", user_id)
            _invalid_reset_link()

        expected = hashlib.sha256(nonce.encode()).hexdigest()
        if not hmac.compare_digest(expected, user.password_reset_token_hash):
            logger.warning("Reset token already used or tampered for user_id=%s", user_id)
            _invalid_reset_link()

        self.instance = user
        return True
````

Original lines 133–180:

````text
    async def update(self, **kwargs: typing.Any) -> User:
        """Reset the password and verify the user."""
        assert self.instance
        self.instance.set_password(self.password)
        self.instance.is_verified = True
        # Consume the single-use reset/registration token.
        self.instance.password_reset_token_hash = None
        await self.instance.save()

        return self.instance


class LoginAuthSerializer(WriteObjectSerializer[User]):
    """
    Login form.

    Allow the user who have authenticate to the web app using email and password.
    """

    email: pydantic.EmailStr
    password: str

    async def run_async_validators(self, **kwargs: typing.Any) -> None:
        """Check that data pass DB validation."""
        await self.verify_email_password()

    async def verify_email_password(self) -> bool:
        """Check that the email exists in the DB."""
        self.instance: User | None = await User.find_current(email=self.email)

        if self.instance:
            if not self.instance.is_active:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Votre compte est inactif. Veuillez procéder à l'activation de votre compte.",
                )

            # In a multi-org context, we check if the active organization (or the first one) is active
            await self.instance.fetch_all_links()

            organization_docs = [org.doc for org in self.instance.organizations if org.doc]
            if organization_docs:
                active_org = next(
                    (o for o in organization_docs if str(o.id) == self.instance.active_organization_id),
                    organization_docs[0],
                )
                if not active_org.is_active:
                    raise HTTPException(
````

Original lines 198–233:

````text
class ForgotPasswordSerializer(WriteObjectSerializer[User]):
    """
    Password forgotten form.

    Allow the user who have forgotten their password to request a reset link.
    """

    email: pydantic.EmailStr

    # This code is commented because, at the moment, we don't want to provide
    # feedback on the email existing. This allows higher security as hackers don't know which
    # emails are registered in the system

    # async def run_async_validators(self, request: Request) -> None:
    #     """Check that data pass DB validation."""
    #     await self.validate_email_exists()

    # async def validate_email_exists(self) -> None:
    #     """Check that the email exists in the DB."""
    #     is_existing = await User.find_current(email=self.email).exists()
    #     if not is_existing:
    #         raise AssertionError("This email does not correspond to any known user.")

    async def run_async_validators(self, **kwargs: typing.Any) -> None:
        """Check that data pass DB validation."""
        await self.verify_email_exists()

    async def verify_email_exists(self, **kwargs: typing.Any) -> bool:
        """Check that the email exists in the DB."""
        user = await User.find_current(email=self.email)
        if user:
            self.instance = user
            return True
        return False

    async def update(self, **kwargs: typing.Any) -> User:
````

</details>

<a id="evidence-018"></a>

### evidence-018: `proj-ehadj-api/app/serializers/category/category.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 20–55:

````text
class CategorySerializer(ObjectSerializer[Category]):
    """Serialize the `category` object for retrieve and listing."""

    id: str
    name: str
    description: str
    price: Price
    max_seats: int = 0
    occupied_seats: int = 0
    agency_ids: list[str] | None = None
    campaign_year: int | None = None
    created: datetime.datetime

    @classmethod
    def get_campaign_year(cls, instance: Category) -> int | None:
        """Return the campaign year of the category."""
        if instance.campaign:
            if hasattr(instance.campaign, "year"):
                return getattr(instance.campaign, "year", None)
            doc = getattr(instance.campaign, "doc", None)
            if doc is not None and hasattr(doc, "year"):
                return getattr(doc, "year", None)
            ref_id = getattr(getattr(instance.campaign, "ref", None), "id", None)
            default_campaign = getattr(Campaign, "_default", None)
            if default_campaign and (ref_id is None or ref_id == default_campaign.id):
                return getattr(default_campaign, "year", None)
        return None

    @classmethod
    async def count_occupied_seats(cls, instance: Category) -> None:
        """Calculate the number of occupied seats for the category."""
        category_id = PydanticObjectId(instance.id)

        campaign_id = None
        if instance.campaign:
            if getattr(instance.campaign, "id", None) is not None:
````

Original lines 85–120:

````text
class WriteCategorySerializer(WriteObjectSerializer[Category]):
    """Serialize the `category` object for create and update."""

    name: str
    description: str
    price: Price
    max_seats: int = 0
    agency_ids: list[str] | None = None
    campaign_year: int | None = Field(default=None, exclude=True)

    async def create(self, **kwargs: typing.Any) -> Category:
        """Create the category in the database."""
        campaign: Campaign | None = kwargs.get("campaign")
        if campaign is None:
            if self.campaign_year:
                campaign = await Campaign.find_one(Campaign.year == self.campaign_year)
            if campaign is None:
                campaign = Campaign.get_default()

        category = Category(
            name=self.name,
            description=self.description,
            price=self.price,
            max_seats=self.max_seats,
            agency_ids=self.agency_ids,
            campaign=campaign,
        )
        await category.create()
        self.instance = category
        return category

    async def update(self, **kwargs: typing.Any) -> Category:
        """Update the category in the database."""
        assert self.instance
        self.instance.name = self.name
        self.instance.description = self.description
````

</details>

<a id="evidence-019"></a>

### evidence-019: `proj-ehadj-api/app/serializers/organization/pilgrim_org.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 92–161:

````text
class WritePilgrimOrgSerializer(WriteObjectSerializer[PilgrimOrg]):
    """Serialize the `agency` object for create and update."""

    name: str | None = None
    ifu: str | None = None
    address: str | None = None
    phone: str = Field(min_length=6)
    admin_first_name: str | None = Field(None, exclude=True)
    admin_last_name: str | None = Field(None, exclude=True)
    admin_email: pydantic.EmailStr | None = Field(None, exclude=True)

    license: License = License()
    merger: Merger = Merger()

    # category_ids: list[str] | None = None , only for SAs

    @pydantic.field_validator("admin_first_name", "admin_last_name", "admin_email", mode="before")
    @classmethod
    def validate_admin_info(cls, value: str, values: pydantic.ValidationInfo, **kwargs: typing.Any) -> str | None:
        """Replace blank string values with `None`."""

        # No validation if update
        if values.data.get("instance"):
            return None

        if not value:
            raise Validation422Error("Ce champ est obligatoire.")

        return value

    async def run_async_validators(self, **kwargs: typing.Any) -> None:
        """Check that data pass DB validation."""
        await self.validate_email_uniqueness()

    async def validate_email_uniqueness(self) -> None:
        """Check that email does not exist in the DB."""
        if self.instance:
            return

        assert self.admin_email

        is_duplicate = await User.find_current(email=self.admin_email)
        if is_duplicate:
            raise Validation422Error("Cette adresse email est déjà rattachée à un compte existant.")

    async def create(self, **kwargs: typing.Any) -> PilgrimOrg:
        """Create the object in the database using the data extracted by the serializer."""
        assert self.admin_first_name and self.admin_last_name and self.admin_email

        logger.info(
            "Creating PilgrimOrg with admin: %s %s (%s)",
            self.admin_first_name,
            self.admin_last_name,
            self.admin_email,
        )

        # Create the pilgrim_org
        logger.debug("Creating PilgrimOrg document in database...")

        # Exclude None values from dump
        org_data = self.model_dump(exclude_none=True)
        logger.debug("Organization data: %s", org_data)

        # Generate a random 10-digit IFU if absent to avoid uniqueness violation
        if not org_data.get("ifu"):
            campaign = Campaign.get_default()
            for _ in range(100):
                candidate_ifu = "".join(secrets.choice("0123456789") for _ in range(10))
                exists = await PilgrimOrg.find_one(
                    PilgrimOrg.ifu == candidate_ifu, PilgrimOrg.campaign.id == campaign.id
````

Original lines 181–214:

````text
        user_serializer = WriteUserSerializer(
            first_name=self.admin_first_name,
            last_name=self.admin_last_name,
            email=self.admin_email,
            organization_id=str(pilgrim_org.id),
            organization=pilgrim_org,
            role=RoleEnum.PILGRIM1,
            is_primary=True,
            is_onboard=False,  # Add this line
        )

        await user_serializer.run_async_validators(request=kwargs["request"])
        logger.debug("User validators passed for email=%s", self.admin_email)

        admin = await user_serializer.create_pilgrim_user(**kwargs, is_primary=True)
        logger.info(
            "Primary admin created successfully. User ID=%s, email=%s, organization_id=%s",
            admin.id,
            admin.email,
            pilgrim_org.id,
        )

        setattr(pilgrim_org, "admin", admin)
        logger.info("PilgrimOrg creation process completed. ID=%s", pilgrim_org.id)

        return pilgrim_org

    async def update(self, **kwargs: typing.Any) -> PilgrimOrg:
        """Update the object in the database using the data extracted by the serializer."""
        assert self.instance
        instance: PilgrimOrg = self.instance.model_copy(update=self.model_dump())
        await instance.replace()  # because the data is corrupted in the base
        self.instance = instance
        return instance
````

</details>

<a id="evidence-020"></a>

### evidence-020: `proj-ehadj-api/app/serializers/user/user.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 427–471:

````text
async def create_password_reset_token(user: User) -> str:
    """Issue a single-use password-reset/registration token.

    The token is a JWT carrying a random ``nonce``; only the SHA-256 of that
    nonce is stored on the user. Consuming the token clears the stored hash, so
    a captured link cannot be replayed until its expiration.
    """
    nonce = secrets.token_urlsafe(32)
    await user.set({"password_reset_token_hash": hashlib.sha256(nonce.encode()).hexdigest()})
    expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        minutes=AppSettings.TOKEN_EXPIRE_MINUTES
    )
    payload = {"exp": int(expires_at.timestamp()), "user_id": str(user.id), "nonce": nonce}
    return jwt.encode(payload, AppSettings.CRYPTO_SECRET, algorithm="HS256")


async def send_activation_email(user: User, is_pilgrim: bool = False) -> None:
    """Send the user a link via email to reset their password."""
    token: str = await create_password_reset_token(user)
    params = {"token": token, "action": "register", "email": user.email}
    encoded_params = urlencode(params)
    register_url = f"{get_frontend_url('/reset-password')}?{encoded_params}"

    await send_emails(
        mail_name="emails/invitation",
        recipients=[user.email],
        context={
            "user": user,
            "register_url": register_url,
            "is_pilgrim": is_pilgrim,
        },
    )


async def send_otp_email(user: User, otp: str, ttl_minutes: int = 3) -> None:
    """Send a one-time password (OTP) to the user's email using the existing send_emails helper."""
    await send_emails(
        mail_name="emails/otp",
        recipients=[user.email],
        context={
            "user": user,
            "otp": otp,
            "ttl_minutes": ttl_minutes,
        },
    )
````

</details>

<a id="evidence-021"></a>

### evidence-021: `proj-ehadj-api/app/tasks`

Observed immediate directory entries (names only):

```text
__init__.py
__pycache__/
bank_payment_queue.py
ecobank_payment_queue.py
quota_checker.py
trip.py
```

<a id="evidence-022"></a>

### evidence-022: `proj-ehadj-api/app/webapi/__init__.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 29–47:

````text
router_api = APIRouter(redirect_slashes=True)

router_api.include_router(router_agency, prefix="/agency", tags=["agency"])
router_api.include_router(router_auth, prefix="/auth/user_token", tags=["auth"])
router_api.include_router(router_deposit, prefix="/deposit", tags=["deposit"])
router_api.include_router(router_invoice, prefix="/invoice", tags=["invoice"])
router_api.include_router(router_notification, prefix="/notification", tags=["notification"])
router_api.include_router(router_organization, prefix="/organization", tags=["organization"])
router_api.include_router(router_preference, prefix="/preference", tags=["preference"])
router_api.include_router(router_trip, prefix="/trip", tags=["trip"])
router_api.include_router(router_user, prefix="/user", tags=["user"])
router_api.include_router(router_permission, prefix="/permission", tags=["permission"])
router_api.include_router(router_category, prefix="/category", tags=["category"])
router_api.include_router(audit_router, prefix="/audit", tags=["audit"])
router_api.include_router(router_pilgrim, prefix="/pilgrim", tags=["pilgrim"])
router_api.include_router(router_pilgrim_org, prefix="/pilgrim_org", tags=["pilgrim_org"])
router_api.include_router(router_ws_notifications, prefix="/notification", tags=["notification_ws"])
router_api.include_router(router_campaign, prefix="/campaign", tags=["campaign"])
router_api.include_router(router_admin_quota, prefix="/admin/quota", tags=["admin_quota"])
````

</details>

<a id="evidence-023"></a>

### evidence-023: `proj-ehadj-api/app/webapi/auth.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 36–142:

````text
async def create(
    request: Request, serializer_write: LoginAuthSerializer
) -> AuthTokenSerializer | dict[str, typing.Any]:
    """Create an authentication token."""
    identifier = str(serializer_write.email)
    await controllers.auth_throttle.assert_not_locked("login", identifier)
    try:
        await serializer_write.run_async_validators(request=request)
    except HTTPException:
        await controllers.auth_throttle.register_failure("login", identifier)
        raise
    await controllers.auth_throttle.clear("login", identifier)
    assert (user := serializer_write.instance)

    # Issue and email an OTP; the client must call verify_otp to complete login.
    return await controllers.user.issue_login_otp(user)


@router.post("/verify_otp/", status_code=status.HTTP_201_CREATED)
@audit_action("login", "auth_token creation via OTP")
async def verify_otp(request: Request, body: VerifyOTPRequest) -> AuthTokenSerializer:
    """Verify an OTP and issue auth token if valid."""

    if not body.email or not body.otp:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Email et OTP requis.")

    identifier = str(body.email)
    await controllers.auth_throttle.assert_not_locked("otp_verify", identifier)

    user = await User.find_current(email=body.email)
    if not user:
        await controllers.auth_throttle.register_failure("otp_verify", identifier)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Identifiants invalides.")

    if not user.verify_otp(body.otp):
        await controllers.auth_throttle.register_failure("otp_verify", identifier)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="OTP invalide ou expiré.")

    await controllers.auth_throttle.clear("otp_verify", identifier)
    # valid OTP: clear it, generate auth key and return token
    await user.clear_otp()
    await user.generate_auth_key()
    assert user.auth_key
    # Fetch all linked documents (including organizations)
    await user.fetch_all_links()
    request.state.user_id = str(user.id)
    return AuthTokenSerializer(
        id=user.auth_key, auth_key=user.auth_key, email=user.email, user=UserSerializer.read(user)
    )


@router.post("/reset_password/", status_code=status.HTTP_202_ACCEPTED)
@audit_action("reset password", "auth_token")
async def reset_password(request: Request, serializer_write: ResetPasswordSerializer) -> AuthTokenSerializer:
    """Let users to set a new password.

    This is also used to confirm registration of new users.
    Since registration is confirmed by updating the password.
    """
    identifier = request.client.host if request.client else "unknown"
    await controllers.auth_throttle.assert_not_locked("reset_password", identifier)
    try:
        await serializer_write.run_async_validators(request=request)
    except HTTPException:
        await controllers.auth_throttle.register_failure("reset_password", identifier)
        raise
    await controllers.auth_throttle.clear("reset_password", identifier)
    user = await serializer_write.update()
    await user.generate_auth_key()
    assert user.auth_key
    # Fetch all linked documents (including organizations)
    await user.fetch_all_links()
    request.state.user_id = str(user.id)
    return AuthTokenSerializer(
        id=user.auth_key, auth_key=user.auth_key, email=user.email, user=UserSerializer.read(user)
    )


@router.post("/forgot_password/", status_code=status.HTTP_202_ACCEPTED)
@audit_action("forgot password", "auth_token")
async def forgot_password(request: Request, serializer_write: ForgotPasswordSerializer) -> dict[str, bool]:
    """Let the user request for a link to reset their password."""
    identifier = str(serializer_write.email)
    await controllers.auth_throttle.assert_not_locked("forgot_password", identifier)
    await controllers.auth_throttle.register_hit("forgot_password", identifier)

    email_exists = await serializer_write.verify_email_exists(request=request)

    if email_exists:
        await serializer_write.update()
    if serializer_write.instance is not None:
        request.state.user_id = str(serializer_write.instance.id)
    return {"result": True}


@router.delete("/{pk}/", status_code=status.HTTP_204_NO_CONTENT)
@audit_action("delete authentication token", "auth_token")
async def destroy(request: Request, pk: str) -> None:
    """Delete the authentication token used by the user."""
    instance = await User.find_one_or_404(User.auth_key == pk)
    request.state.user_id = str(instance.id)
    # Match the credential again at write time.  A delayed logout for an old
    # session must be a no-op if a concurrent login has already issued a new
    # auth key for the same account.
    await User.find_one(User.id == instance.id, User.auth_key == pk).set(
        {"auth_key": None, "auth_key_expires_at": None}
    )
````

</details>

<a id="evidence-024"></a>

### evidence-024: `proj-ehadj-api/app/webapi/organization.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 31–62:

````text
@router.get("/", status_code=status.HTTP_200_OK)
@audit_action("list organizations", "organization")
async def listing(
    request: Request,
    request_user: User = Depends(user_auth.require_active(RoleEnum.get_authenticated_and_pilgrim())),
) -> PaginatedData[OrganizationSerializer]:
    """Retrieve all agencies.
    This is a public endpoint. Anyone to list info about all agency.
    """
    cursor = CursorInfo(request=request)
    query = OrganizationQuery(user=request_user, filters=request.query_params)
    search_text: typing.Optional[str] = request.query_params.get("q")

    if search_text:
        qs = await query.get_search(search_text)
    else:
        qs = await query.get_qs()
        cursor_params = cursor.get_beanie_query_params()
        qs = qs.find(**cursor_params)

    instance_list = await qs.to_list()

    count = await qs.count()
    cursor.set_count(count)
    request.state.user_id = str(request_user.id)
    result: PaginatedData[OrganizationSerializer] = OrganizationSerializer.read_page(
        instance_list,
        request=request,
        cursor_info=cursor,
    )

    return result
````

</details>

<a id="evidence-025"></a>

### evidence-025: `proj-ehadj-api/app/webapi/pilgrim_org.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 38–73:

````text
async def _enforce_register_throttle(request: Request) -> None:
    """Count and lock public registration attempts before body validation."""
    identifier = request.client.host if request.client else "unknown"
    await controllers.auth_throttle.assert_not_locked("register", identifier)
    await controllers.auth_throttle.register_hit("register", identifier)


@router.get("/stats/default/", status_code=status.HTTP_200_OK)
@audit_action("get individual account stats default", "individual account organization")
async def stats_default(
    request: Request,
    request_user: User = Depends(
        user_auth.require_active(
            [RoleEnum.DSI1, RoleEnum.AGLO1, RoleEnum.ASIN1, RoleEnum.DSI2, RoleEnum.AGLO2, RoleEnum.ASIN2]
        )
    ),
) -> StatsCollection:
    """Provide statistics about the list of items."""
    campaign = await get_campaign_for_view(request)
    query = PilgrimOrgQuery(user=request_user, filters=request.query_params, campaign=campaign)
    request.state.user_id = str(request_user.id)
    return {"data": await query.get_stats()}


@router.get("/{pk}/", status_code=status.HTTP_200_OK)
@audit_action("retrieve an individual account", "individual account organization")
async def retrieve(
    request: Request,
    pk: str,
    request_user: User = Depends(user_auth.require_active([RoleEnum.PILGRIM1, RoleEnum.AGLO1, RoleEnum.AGLO2])),
) -> PilgrimOrgSerializer:
    """Retrieve an agency by id.

    This is a public endpoint. Anyone to retrieve info about an agency.
    """
    instance = await PilgrimOrgQuery(user=request_user).retrieve(pk)
````

Original lines 122–157:

````text
@router.post("/", status_code=status.HTTP_201_CREATED)
@audit_action("create individual account", "individual account organization")
async def create(
    request: Request,
    serializer_write: WritePilgrimOrgSerializer,
    _throttle: None = Depends(_enforce_register_throttle),
) -> PilgrimOrgSerializer:
    """Create an PilgrimOrg."""
    logger.info(
        "Starting PilgrimOrg creation process. Data received: name=%s, ifu=%s, email=%s",
        serializer_write.name,
        serializer_write.ifu,
        serializer_write.admin_email,
    )

    try:
        logger.debug("Running async validators...")
        await serializer_write.run_async_validators(request=request)
        logger.info("Async validators passed successfully")

        logger.debug("Creating PilgrimOrg instance...")
        instance: PilgrimOrg = await serializer_write.create(request=request)
        admin = typing.cast(User | None, getattr(instance, "admin", None))
        logger.info(
            "PilgrimOrg created successfully. ID=%s, name=%s, admin_email=%s",
            instance.id,
            instance.name,
            admin.email if admin is not None else "N/A",
        )

        logger.debug("Serializing response...")
        response = PilgrimOrgSerializer.read(instance)
        logger.info("PilgrimOrg creation completed successfully. ID=%s", instance.id)
        request.state.user_id = str(admin.id) if admin is not None else None
        return response

````

</details>

<a id="evidence-026"></a>

### evidence-026: `proj-ehadj-api/app/xlib`

Observed immediate directory entries (names only):

```text
__pycache__/
anip/
bank.py
ecobank/
mae/
prefetch.py
resend.py
s3.py
sendgrid.py
utils.py
```

<a id="evidence-027"></a>

### evidence-027: `proj-ehadj-api/pyproject.toml`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 1–144:

````text
# pyproject.toml
# --------------
# This is the project metadata file that instructs
# pip and the various tools on which configurations should
# be used for this project.
#
# ⚠️ You probably do not want to edit this file.
# To edit the app settings check: AppMain/settings.py

[tool.black]
line-length = 120
extend-exclude = '''
/(
    \.git
  | migrations
)
'''

[tool.isort]
profile = "black"
known_core = "core,coreapi,corelib,sap"
sections = "FUTURE,STDLIB,THIRDPARTY,CORE,FIRSTPARTY,LOCALFOLDER"
extend_skip = "migrations"
skip_gitignore = true
line_length = 120

[tool.pylint.master]
ignore = []
extension-pkg-whitelist = ['pydantic']
load-plugins = [
    'pylint.extensions.mccabe',
    'pylint.extensions.private_import',
    'pylint.extensions.redefined_variable_type',
    'pylint.extensions.comparison_placement',
    'pylint.extensions.no_self_use',
    'pylint.extensions.broad_try_clause',
    'pylint.extensions.confusing_elif',
    'pylint.extensions.for_any_all',
    'pylint.extensions.while_used',
    'pylint.extensions.redefined_loop_name',
    'pylint.extensions.bad_builtin',
    'pylint.extensions.docparams',
]
enable = 'all'

[tool.pylint.format]
max-line-length = "125"  # black will enfore 120, but sometimes it may decides to not do if it is more readable

[tool.pylint.messages_control]
disable = [
    "locally-disabled",
    "suppressed-message",
    "duplicate-code",
    "missing-module-docstring",
    "missing-class-docstring",
    "missing-function-docstring",
    "too-few-public-methods",
    "singleton-comparison",  # Make it impossible to use the `field == None` feature of beanie ODM
    "use-implicit-booleaness-not-comparison-to-zero",  # Make it possible to do `number == 0` comparison
    "use-implicit-booleaness-not-comparison-to-string",  # Make it possible to do `str == ''` comparison
    "line-too-long",  # Line formatting is already handled by Black
]

[tool.pylint.design]
min-public-methods = 1
max-parents = 12
max-complexity = 10

[tool.pylint.variables]
ignored-argument-names = "args|kwargs|request"

[tool.pylint.basic]
good-names = [
    "_", "i", "e", "k", "v", "x", "id", "pk", "qs", "setUp", "tearDown", "maxDiff", "AppMain"
]

[tool.pylint.similarities]
ignore-comments = true
ignore-docstrings = true
ignore-imports = true
ignore-signatures = true
min-similarity-lines = 5

[tool.pylint.miscellaneous]
notes = ['FIXME']

[tool.mypy]
exclude = ['.venv/', 'venv/', '_local/']
plugins = ['pydantic.mypy']
show_error_codes = true
strict = true
# no_strict_optional = true
# packages
namespace_packages = true
explicit_package_bases = true
# functions
warn_no_return = true
warn_unreachable = true
disallow_untyped_calls = false  # TODO: remove after beanie fix

[tool.pydantic-mypy]
init_forbid_extra = true
init_typed = true
warn_required_dynamic_aliases = true
warn_untyped_fields = true

[[tool.mypy.overrides]]
module = [
    "motor",
    "uvicorn",
    "async_asgi_testclient",
    "pyairtable",
    "klaviyo_api",
    "openapi_client",
    "motor.motor_asyncio",
    "sendgrid.helpers.mail",
    "aioboto3",
]
ignore_missing_imports = true
implicit_reexport = true

[tool.pydocstyle]
inherit = false
convention = 'pep257'
match-dir = 'AppMain|app'
add-ignore = ['D202']

[tool.pytest.ini_options]
testpaths = "tests"
asyncio_mode = "auto"
markers = ["dashboard: campaign dashboard endpoint regression tests using synthetic MongoDB data"]
# addopts = '--cov=app --cov-fail-under=95 --no-cov-on-fail'

[tool.coverage.run]
branch = true

[tool.coverage.report]
exclude_lines = [
    'pragma: no cover',
    'def __repr__',
    'def __str__',
    'if typing\.TYPE_CHECKING',
    'NotImplementedError'
]
````

</details>

<a id="evidence-028"></a>

### evidence-028: `proj-ehadj-api/requirements-dev.txt`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 1–52:

````text
# DEV dependencies
# ----------------
# This file list additional dependencies that are needed in a dev environment.
# The dev dependencies are not needed to run the app.
# There are only useful to perform extra actions such as formatting, linting, and testing.
# Any dependency listed here will not be installed in production.
# Installing this file will also install all default requirements available in: requirements.txt
#
# To install, run:
# pip install -r requirements-dev.txt
#
# To list outdated packages, run:
# pip list --outdated

# Default requirements
-r requirements.txt

# Formatting
black~=24.8
isort~=5.13
rich~=13.9

# Linting
pylint~=3.3
mypy~=1.11.2
pydocstyle~=6.3

# Linting: Stubs
types-PyYAML~=6.0
celery-types~=0.22
motor-stubs~=1.7
boto3-stubs~=1.35
types-oauthlib~=3.2
types-redis~=4.6
types-requests~=2.32
types-passlib~=1.7
types-xmltodict~=0.13

# Testing
pytest~=8.3
pytest-asyncio~=0.21.0
coverage~=7.6
pytest-cov~=5.0
async-asgi-testclient~=1.4
pytest-celery~=0.0

# CI/CD
pre-commit~=3.8
PyYAML~=6.0

# Debug
icecream==2.1.8
````

</details>

<a id="evidence-029"></a>

### evidence-029: `proj-ehadj-api/requirements.txt`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 1–58:

````text
# Dependencies
# ------------
# Add here the list of packages that need to be install to run the app.
# This list is to be updated manually as new packages are added to the project.
# Do not use an automated to freeze local dependencies.
# For convenience dev dependencies are in the file: requirements-dev.txt

# Package installer
pip==24.2

# Async packages
httpx==0.27.2
# aiodns==3.2.0
aiofiles==24.1.0

# Databases: MongoDB
beanie==1.26.0
motor==3.6.0
pymongo==4.9.2

# Web Framework: FastAPI
pydantic[email]==2.9.2
pydantic-settings==2.5.2
python-multipart==0.0.12
uvicorn==0.31.0
fastapi==0.115.0
jinja2==3.1.4
PyJWT==2.9.0
itsdangerous==2.2.0
bcrypt==4.2.0
setuptools==79.0.1

# Utils
requests==2.32.3
sapx==0.3.5
aioboto3==13.1.1
Pillow==10.4.0
xmltodict==0.13.0

# Third Party Services
sendgrid==6.11.0
sentry-sdk[fastapi]==2.15.0

# deployment
supervisor==4.2.5

# PDF generation
fpdf2==2.8.2
types-fpdf2==2.8.2.20241223

# seed db
faker==37.8.0

# audit logs
structlog==25.4.0

# Email validation
resend==2.17.0
````

</details>

<a id="evidence-030"></a>

### evidence-030: `proj-ehadj-api/scripts/pre-commit-pytest.sh`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 1–7:

````text
#!/bin/bash

if [[ $(git branch --show-current) =~ ^draft/ ]]; then
  echo "Skipping pytest due to draft branch detected."
else
  pytest
fi
````

</details>

<a id="evidence-031"></a>

### evidence-031: `proj-ehadj-api/tests`

Observed immediate directory entries (names only):

```text
__init__.py
__pycache__/
_helpers/
conftest.py
reporting/
samples.py
tasks/
unit/
utils/
webapi/
```

<a id="evidence-032"></a>

### evidence-032: `proj-ehadj-api/tests/_helpers/utils.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 31–66:

````text
async def assert_response_forbidden(response: Response) -> bool:
    """Check that a request was rejected to due to lack sufficient authorization."""

    assert response.status_code in [
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
        # status.HTTP_404_NOT_FOUND,
        status.HTTP_405_METHOD_NOT_ALLOWED,
    ], response.content

    return True


async def get_headers(user: User) -> Headers:
    """Get default headers for api authentication."""

    if not user.auth_key:
        await user.generate_auth_key()
    else:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        expires_at = user.auth_key_expires_at
        if expires_at is not None and getattr(expires_at, "tzinfo", None) is not None:
            expires_at = expires_at.replace(tzinfo=None)
        if expires_at is None or expires_at <= now:
            await user.set({"auth_key_expires_at": now + timedelta(minutes=AppSettings.SESSION_EXPIRE_MINUTES)})

    basic_auth = b64encode((f"{user.auth_key}:").encode("utf-8")).decode("ascii")
    headers: Headers = {"Authorization": f"Basic {basic_auth}"}

    return headers


async def assert_rest_can_list(
    base_url: str,
    sample: typing.Optional[dict[str, typing.Any]] = None,
    user: typing.Optional[User] = None,
````

Original lines 144–179:

````text
async def assert_rest_can_create(
    base_url: str,
    sample: dict[str, typing.Any],
    variant_good: typing.Optional[dict[str, typing.Any]] = None,
    variant_bad: typing.Optional[dict[str, typing.Any]] = None,
    user: typing.Optional[User] = None,
    roles: typing.Optional[list[RoleEnum]] = None,
) -> bool:
    """Update an item using its ID."""
    headers = await get_headers(user) if user else {}

    variant_good = variant_good or {}
    variant_bad = variant_bad or {}

    async with TestClient(app, headers=headers) as client:
        response_good = await client.post(base_url, json=merge_dict_deep(copy.deepcopy(sample), variant_good))
        response_bad = await client.post(base_url, json=merge_dict_deep(copy.deepcopy(sample), variant_bad))

    async def assert_response_authorized() -> bool:
        """Verify that the action was successfully performed."""
        assert variant_good
        assert variant_bad

        assert response_good.status_code == status.HTTP_201_CREATED, response_good.content
        assert response_bad.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY, response_bad.content

        def verify_attribute(key: str, expected: typing.Any, received: typing.Any) -> None:
            assert expected == received, f"Updating data failed {key=} {expected=} {received=}"

        # Ensure that the response data has the right format
        response_good_data: dict[str, typing.Any] = response_good.json()
        for key, value in variant_good.items():
            # some case are only accepted at creation for example admin_email when creating agency
            if key in response_good_data:
                if isinstance(value, dict):
                    for key_1, value_1 in value.items():
````

</details>

<a id="evidence-033"></a>

### evidence-033: `proj-ehadj-api/tests/conftest.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 15–40:

````text
# Set before importing any application module. Never use deployed configuration.
for key in list(os.environ):
    if key.startswith(("APP_SETTINGS_", "AUDIT_")):
        del os.environ[key]
os.environ.update(
    {
        "APP_ENV": "DEV",
        "TEST_ENV": "TEST",
        "APP_DOTENV": "/dev/null",
        "AUDIT_DOTENV": "/dev/null",
        "AUDIT_ENABLE_AUDIT_LOGGING": "false",
        "APP_SETTINGS_MONGO": '{"protocol":"mongodb","host":"127.0.0.1","port":"27028","db":"ehadj_test","username":"","password":"","params":""}',
        "AUDIT_MONGO__HOST": "127.0.0.1",
        "AUDIT_MONGO__PORT": "27028",
        "APP_SETTINGS_CRYPTO_SECRET": "synthetic-test-only",
        "APP_SETTINGS_RESEND_API_KEY": "synthetic-test-only",
        "APP_SETTINGS_EMAIL_ENABLED": "false",
        "APP_SETTINGS_AWS_ENDPOINT": "http://127.0.0.1:9",
        "APP_SETTINGS_AWS_ACCESS_KEY_ID": "synthetic-test-only",
        "APP_SETTINGS_AWS_ACCESS_KEY_SECRET": "synthetic-test-only",
        "APP_SETTINGS_AWS_REGION": "test",
    }
)

# isort: on

````

Original lines 67–102:

````text
def _isolated_test_connect(current_socket: socket.socket, address: str | tuple[str, int]) -> typing.Any:
    """Permit only Unix sockets and the disposable loopback MongoDB endpoint."""
    if isinstance(address, str):
        return _original_socket_connect(current_socket, address)
    if isinstance(address, tuple) and len(address) >= 2:
        host, port = address[0], address[1]
        if host in {"127.0.0.1", "::1", "localhost"} and port == 27028:
            return _original_socket_connect(current_socket, address)
    raise RuntimeError("External network access is disabled in the backend test environment.")


def pytest_configure(config: pytest.Config) -> None:
    """Deny external sockets before test-module collection starts."""
    del config
    socket.socket.connect = _isolated_test_connect


def pytest_unconfigure(config: pytest.Config) -> None:
    """Restore normal socket behavior after collection and execution finish."""
    del config
    socket.socket.connect = _original_socket_connect


@pytest.fixture(scope="session")
def event_loop() -> typing.Generator[asyncio.events.AbstractEventLoop, None, None]:
    """Force pytest fixtures to use async loop."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def initialise_db() -> typing.AsyncGenerator[bool, None]:
    """Initialize DB connection for all tests."""
    print("Connecting to MongoDB")
    print("Initializing Beanie")
````

Original lines 294–318:

````text
async def db(monkeypatch):
    """Reset only the disposable synthetic database for endpoint statistics."""
    monkeypatch.setattr(Campaign, "_default", None)
    monkeypatch.setattr(Preference, "_default", None)
    document_models = [getattr(models, name) for name in models.__all__]
    # Beanie stores its database binding on each document class. Restore any
    # existing session fixture bindings when this independent dataset ends.
    for model in {base for model in document_models for base in model.__mro__ if hasattr(base, "_document_settings")}:
        monkeypatch.setattr(model, "_document_settings", model._document_settings)
    client = AsyncIOMotorClient("mongodb://127.0.0.1:27028", serverSelectionTimeoutMS=10000)
    database = client.ehadj_reporting_test
    try:
        for col in await database.list_collection_names():
            if not col.startswith("system."):
                await database[col].delete_many({})
        await init_beanie(database=database, document_models=document_models)
        cat_indexes = await database.category.index_information()
        if "name_1" in cat_indexes and cat_indexes["name_1"].get("key") == [("name", 1)]:
            await database.category.drop_index("name_1")
        yield database
    finally:
        for col in await database.list_collection_names():
            if not col.startswith("system."):
                await database[col].delete_many({})
        client.close()
````

</details>

<a id="evidence-034"></a>

### evidence-034: `proj-ehadj-api/tests/unit/test_quota_reservation_rules.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 45–99:

````text
def _make_reservation(
    status: QuotaReservationStatusEnum = QuotaReservationStatusEnum.ACTIVE,
    expires_at: datetime | None = None,
    attempt_status: EcobankAttemptStatusEnum | None = EcobankAttemptStatusEnum.UNKNOWN,
    attempt_fetch_error: Exception | None = None,
) -> tuple[QuotaReservation, MagicMock]:
    """Build an in-memory QuotaReservation with mock links (no DB)."""
    now = datetime.now(UTC)
    attempt_oid = PydanticObjectId("64b0f81d9f1a2b3c4d5e6f01")
    invoice_oid = PydanticObjectId("64b0f81d9f1a2b3c4d5e6f02")

    attempt = MagicMock()
    attempt.id = attempt_oid
    attempt.status = attempt_status

    attempt_link = MagicMock()
    attempt_link.id = attempt_oid
    if attempt_fetch_error is not None:
        attempt_link.fetch = AsyncMock(side_effect=attempt_fetch_error)
    else:
        attempt_link.fetch = AsyncMock(return_value=attempt)

    invoice_link = MagicMock()
    invoice_link.id = invoice_oid

    reservation = QuotaReservation.model_construct(
        id=PydanticObjectId("64b0f81d9f1a2b3c4d5e6f04"),
        attempt=attempt_link,
        invoice=invoice_link,
        agency=MagicMock(),
        campaign=MagicMock(),
        pilgrim_count=1,
        status=status,
        # Default: expired one minute ago (the sweep's target).
        expires_at=expires_at or (now - timedelta(minutes=1)),
    )
    return reservation, attempt


# ---------------------------------------------------------------------------
# B8 — surpayment policy
# ---------------------------------------------------------------------------


def test_surpayment_policy_uses_ge_and_never_consumes_unknown_total():
    """`>=` semantics: equality and surpayment are fully paid; None total never consumes."""
    trip = MagicMock()
    trip.cart_total = 1_200_000
    trip.deposit_transferred = 700_000

    assert is_pilgrim_fully_paid_after(trip, 500_000) is True  # exact equality
    assert is_pilgrim_fully_paid_after(trip, 300_000) is False  # acompte only

    # Surpayment: the seat stays consumed, it is never released (decision B8).
    trip.deposit_transferred = 1_500_000
````

</details>

<a id="evidence-035"></a>

### evidence-035: `proj-ehadj-api/tests/webapi/auth/conftest.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 19–25:

````text
@pytest_asyncio.fixture(name="item", scope="package", autouse=True)
async def fixture_item(load_users) -> typing.AsyncGenerator[AuthTokenSerializer, None]:
    """Populate auth key in the database for testing."""
    user = await User.find_one_or_404(User.email == sample_create["email"])
    item = AuthTokenSerializer(**sample_create, user=UserSerializer.read(user))

    yield item
````

</details>

<a id="evidence-036"></a>

### evidence-036: `proj-ehadj-api/tests/webapi/auth/test_auth.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 82–83:

````text
async def test_reset_password_token_is_single_use(load_users) -> None:
    """A reset/registration link must not be reusable after it is consumed."""
````

Original lines 85–106:

````text

    user = await User.find_one_or_404(User.email == sample_users[RoleEnum.DSI1]["email"])
    original_hash = user.password_reset_token_hash
    token = await create_password_reset_token(user)
    payload = {"token": token, "password": "Nouveau1!", "password2": "Nouveau1!"}

    try:
        async with TestClient(app) as client:
            first = await client.post(f"{BASE_URL}reset_password/", json=payload)
            second = await client.post(f"{BASE_URL}reset_password/", json=payload)
        assert first.status_code == status.HTTP_202_ACCEPTED, first.content
        assert second.status_code == status.HTTP_401_UNAUTHORIZED, second.content
    finally:
        fresh = await User.get_or_404(user.id)
        fresh.set_password(sample_users[RoleEnum.DSI1]["password"])
        fresh.password_reset_token_hash = original_hash
        await fresh.save()


@pytest.mark.asyncio
async def test_reset_password_rejects_expired_token(load_users) -> None:
    """An expired reset token must be refused even when the nonce is stored."""
````

Original lines 109–117:

````text

    user = await User.find_one_or_404(User.email == sample_users[RoleEnum.SA1]["email"])
    nonce = "expired-nonce"
    await user.set({"password_reset_token_hash": hashlib.sha256(nonce.encode()).hexdigest()})
    expired = jwt.encode(
        {"exp": int(time.time()) - 60, "user_id": str(user.id), "nonce": nonce},
        AppSettings.CRYPTO_SECRET,
        algorithm="HS256",
    )
````

Original lines 197–198:

````text
async def test_expired_session_is_rejected(load_users) -> None:
    """An auth_key past its lifetime must not authenticate, even if still stored."""
````

Original lines 200–232:

````text

    user = await User.find_one_or_404(User.email == sample_users[RoleEnum.AGLO1]["email"])
    await user.generate_auth_key()
    headers = await get_headers(user)
    expired = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(minutes=1)
    await user.set({"auth_key_expires_at": expired})

    try:
        async with TestClient(app, headers=headers) as client:
            response = await client.get("/api/v1/user/current/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED, response.content
    finally:
        await user.generate_auth_key()


@pytest.mark.asyncio
async def test_public_registration_locks_after_repeated_attempts(load_users) -> None:
    """Unauthenticated pilgrim-org creation must lock after the attempt threshold."""
    await AuthThrottle.find(AuthThrottle.scope == "register").delete()

    try:
        async with TestClient(app) as client:
            payload = {
                "phone": "21000000",
                "admin_first_name": "Lock",
                "admin_last_name": "Test",
                "admin_email": sample_users[RoleEnum.DSI1]["email"],
            }
            last_unlocked = None
            for _ in range(AppSettings.AUTH_MAX_ATTEMPTS):
                last_unlocked = await client.post("/api/v1/pilgrim_org/", json=payload)
                assert last_unlocked.status_code != status.HTTP_429_TOO_MANY_REQUESTS, last_unlocked.content
            locked = await client.post("/api/v1/pilgrim_org/", json=payload)
````

</details>

<a id="evidence-037"></a>

### evidence-037: `proj-ehadj-api/tests/webapi/category/test_category.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 43–78:

````text
async def test_quota_is_complete_on_every_category_page(
    public_categories: tuple[AsyncClient, AsyncIOMotorDatabase]
) -> None:
    """A small page preserves links and exposes the same complete capacities."""
    client, _ = public_categories
    complete = (await client.get("/category/")).json()
    page = (await client.get("/category/?limit=1&sort=name")).json()
    assert len(page["data"]) == 1
    assert page["count"] == 5
    assert page["quota"]["national"] == complete["quota"]["national"]
    assert page["quota"]["linked"] == complete["quota"]["linked"]
    names = [page["data"][0]["name"]]
    for _ in range(4):
        assert page["next"] is not None
        page = (await client.get(page["next"])).json()
        assert page["previous"] is not None
        assert page["quota"]["national"] == complete["quota"]["national"]
        names.extend(category["name"] for category in page["data"])
    assert page["next"] is None
    assert len(set(names)) == 5


@pytest.mark.asyncio
async def test_empty_campaign_returns_valid_zero_occupancy(
    public_categories: tuple[AsyncClient, AsyncIOMotorDatabase]
) -> None:
    """Zero is data, including an empty shared non-resident pool."""
    client, db = public_categories
    await db.trip.delete_many({})
    body = (await client.get("/category/")).json()
    assert body["quota"]["national"] == {"total": 12, "occupied": 0, "available": 12}
    assert all(category["occupied_seats"] == 0 for category in body["data"])
    diaspora = next(capacity for capacity in body["quota"]["linked"] if capacity["is_linked"])
    assert diaspora["available"] == 5


````

</details>

<a id="evidence-038"></a>

### evidence-038: `proj-ehadj-api/tests/webapi/conftest.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 24–59:

````text
@pytest_asyncio.fixture(name="user_auth", scope="package", params=[RoleEnum.AGLO1, RoleEnum.SA1, RoleEnum.BANK1])
async def fixture_user_auth(request: pytest.FixtureRequest, load_users) -> typing.AsyncGenerator[User, None]:
    """Get default headers for api authentication."""

    role: RoleEnum = request.param

    user = await User.find_one_or_404(
        {"roles": role},
        User.is_active == True,
        User.is_verified == True,
    )

    if not user.auth_key:
        await user.generate_auth_key()

    yield user


@pytest_asyncio.fixture
async def national(db, monkeypatch):
    campaign_id, category_id, agency_id, empty_id, national_id = [PydanticObjectId() for _ in range(5)]
    Campaign._default = Campaign.model_construct(id=campaign_id, year=2026)
    Preference._default = Preference.model_construct(
        registration_deposit=100, total_pilgrim_quota=2, campaign_year=2026
    )
    await db.campaign.insert_one({"_id": campaign_id, "year": 2026})
    await db.organization.insert_one({"_id": national_id, "name": "National", "type": "AGLO", "is_active": True})
    for oid, name in [(agency_id, "Agency A"), (empty_id, "Agency B")]:
        await db.organization.insert_one(
            {"_id": oid, "name": name, "type": "SA", "campaign": DBRef("campaign", campaign_id), "is_active": True}
        )
    await db.category.insert_one(
        {
            "_id": category_id,
            "name": "Category A",
            "description": "Synthetic",
````

Original lines 92–99:

````text
    async def authenticate(request):
        return user

    monkeypatch.setattr(user_auth, "authenticate", authenticate)
    app = FastAPI()
    app.include_router(router, prefix="/trip")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client, user, db, category_id, agency_id, empty_id
````

</details>

<a id="evidence-071"></a>

### evidence-071: `proj-ehadj-ui/src/helpers/RestClient/index.js`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 13–31:

````text
const handleListData = ({ data }) => {
  if (data.object === 'list') {
    const arrayData = data.data;
    arrayData.object = data.object;
    arrayData.count = data.count;
    arrayData.next = data.next;
    arrayData.previous = data.previous;
    return Promise.resolve(arrayData);
  }
  return Promise.resolve({ data });
};

export default class RestClient {
  #baseUrl = '';

  #authToken = '';

  #onLogout = null;

````

Original lines 33–48:

````text

  /**
   * Cache the request params before making the call.
   * Used to build the storageKey
   */
  requestParams = null;

  constructor(baseUrl, token, onLogout) {
    this.#baseUrl = baseUrl;
    this.#authToken = token;
    this.#onLogout = onLogout;
  }

  /**
   * Config for REST method call
   *
````

Original lines 88–158:

````text
    if (this.#authToken) {
      updatedAxiosConfig.auth = { username: this.#authToken, password: '' };
    }

    try {
      return await axios.request(updatedAxiosConfig);
    } catch (err) {
      if (err.response?.status === 401 && this.#authToken) {
        this.#onLogout({
          requestToken: this.#authToken,
          sessionExpired: [
            'Session expirée. Veuillez vous reconnecter.',
            'Session has expired',
            'Invalid or expired authentication credentials',
          ].includes(err.response?.data?.detail),
        });
      } else if (includeErrorStatus && err.response) {
        // Session recovery needs the status, but not Axios request credentials or headers.
        return Promise.reject({ status: err.response.status, detail: err.response.data?.detail });
      } else if (err.response?.data?.detail) {
        return raiseAPIError(err.response);
      }
      return Promise.reject(err);
    }
  }

  /** REST API methods */

  /**
   * Rest: Get
   *
   * @param {string} url Request URL or path
   * @param {object} config Additional axios config
   * @returns {Promise} Response of the request
   */
  async get(url, config) {
    const conf = { ...(config || {}), ...{ url, method: 'get' } };
    return this.#request(conf);
  }

  /**
   * Rest: Delete
   *
   * @param {string} url Request URL or path
   * @param {object} config Additional axios config
   * @returns {Promise} Response of the request
   */
  async delete(url, config) {
    const conf = { ...(config || {}), ...{ url, method: 'delete' } };
    return this.#request(conf);
  }

  /**
   * Rest: Post
   *
   * @param {string} url Request URL or path
   * @param {object} data data to POST
   * @param {object} config Additional axios config
   * @returns {Promise} Response of the request
   */
  async post(url, data, config) {
    const conf = { ...(config || {}), ...{ url, data, method: 'post' } };
    return this.#request(conf);
  }

  /**
   * Rest: Put
   *
   * @param {string} url Request URL or path
   * @param {object} data data to PUT
   * @param {object} config Additional axios config
````

Original lines 212–247:

````text
  async create(objectURI, data) {
    const url = `${objectURI}`;
    return this.post(url, data);
  }

  /**
   * Call to update a resource
   *
   * @param {string} objectURI API object relative URI or path
   * @param {object} data object to update
   * @param {string} id resource id
   * @returns {Promise} Response of the request
   */
  async update(objectURI, data, id = 'current') {
    const url = `${objectURI}/${id}/`;
    return this.put(url, data);
  }

  /**
   * Call to update an existing file
   *
   * @param {string} objectURI API object relative URI or path
   * @param {string} field object key
   * @param {Array} files an array of Files
   * @param {string} id resource id
   * @param {boolean} useRessourceId whether or not to use path to ressource id
   * @returns {Promise} Response of the request
   */
  async updateFile(objectURI, field, files, id = 'current', useRessourceId = true) {
    const url = useRessourceId ? `${objectURI}/${id}/file` : objectURI;
    const formData = new FormData();
    Object.values(files).forEach((file) => {
      if (file instanceof File) {
        formData.append(field, file);
      }
    });
````

Original lines 259–284:

````text
  retrieve(objectURI, id = 'current', params = {}) {
    if (!id) return Promise.resolve({ data: null });
    const path = `${objectURI}/${id}`;
    this.requestParams = { method: 'GET', params, path };
    return async () => {
      const { data } = await this.get(path, { params });
      return data;
    };
  }

  /**
   * Prepare a call to list resources
   *
   * @param {string} objectURI API object relative URI or path
   * @param {object} params Query parameters
   * @returns {Promise} a promise
   */
  list(objectURI, params = {}) {
    const paramsWithDefaults = { ...{ limit: 60 }, ...params };
    this.requestParams = { method: 'GET', params: paramsWithDefaults, path: objectURI };
    return async () => {
      const response = await this.get(objectURI, { params: paramsWithDefaults });
      return handleListData(response);
    };
  }
}
````

</details>

<a id="evidence-093"></a>

### evidence-093: `proj-ehadj-ui/src/pages/Login/index.jsx`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 75–139:

````text
  // 1. First Step: Login Mutation
  const { mutate: logUser, isLoading: isLoggingIn } = useMutation({
    mutationFn: () => api.post('auth/user_token/', { email, password: pwd }, { headers }),
    onSuccess: ({ data }) => {
      toast.success(data.message);
      setError('');
      setStep(CONST_OTP); // Switch to OTP UI
      startTimer();
    },
    onError: (error) => {
      setError(error || Locales.auth.errors.invalid_identifiers);
    },
  });

  // 2. Second Step: OTP Validation
  const { mutate: verifyOTP, isLoading: isVerifyingOTP } = useMutation({
    mutationFn: () => api.post('auth/user_token/verify_otp/', { email, otp: otpValue }, { headers }),
    onSuccess: ({ data }) => {
      // Finalize login
      storage.set(CONST_USER_TOKEN, data.auth_key);
      downloadConsentReceipt();
      window.location = Urls.base;
    },
    onError: () => {
      setError('Code OTP invalide ou expiré.');
      setOtpValue('');
    },
  });

  // Resend OTP Mutation
  const { mutate: resendOTP, isLoading: isResending } = useMutation({
    mutationFn: () => api.post('auth/user_token/', { email, password: pwd }, { headers }),
    onSuccess: () => {
      toast.success('Un nouveau code a été envoyé.');
      startTimer();
    },
    onError: () => setError('Erreur lors du renvoi du code. Veuillez réessayer.'),
  });

  const startTimer = () => setResendTimer(RESEND_OTP_TIMER_SECONDS);

  const handleLogin = (event) => {
    event.preventDefault();

    if (!validateEmail(email)) {
      setError(Locales.auth.errors.invalid_email);
      setPwd('');
      setEmail('');
      return;
    }

    setError('');
    logUser();
  };

  const toggleDisplayPassword = () => setDisplayPwd((val) => !val);

  const toggleLegalNoticeOpen = () => setLegalNoticeOpen((val) => !val);

  const acceptCgu = () => {
    storage.set(CONST_LEGAL_ACCEPTED, true);
    const acceptanceDateTime = formatDate(new Date(), "EEEE d MMMM yyyy 'à' HH:mm:ss");
    storage.set(CONST_LEGAL_ACCEPTANCE_DATE, acceptanceDateTime);
    toggleLegalNoticeOpen();
  };
````

</details>

<a id="evidence-094"></a>

### evidence-094: `proj-ehadj-ui/src/pages/Register/index.jsx`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 33–86:

````text
  const { mutate: registerPilgrim } = useMutation({
    mutationFn: () => {
      const payload = {
        admin_last_name: lastName.trim(),
        admin_first_name: firstName.trim(),
        phone: phoneNumber,
        admin_email: email.trim(),
        captcha,
      };
      return api.post('pilgrim_org/', payload);
    },
    onSuccess: () => {
      setError('');
      setSuccessMessage('Inscription réussie !');
      setShowSuccessCard(true);
    },
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!validateName(lastName)) {
      setError('Le nom est requis.');
      return;
    }
    if (!validateName(firstName)) {
      setError('Le prénom est requis.');
      return;
    }
    if (!validatePhoneNumber(phoneNumber)) {
      setError('Le numéro de téléphone doit commencer par 01 et contenir 10 chiffres (01 XX XX XX XX).');
      return;
    }
    if (email && !validateEmail(email)) {
      setError("L'email fourni n'est pas valide.");
      return;
    }
    if (!captcha) {
      setError('Veuillez compléter le CAPTCHA.');
      return;
    }

    registerPilgrim();
  };

  const isDisabled = isMutating || !lastName || !firstName || !email || !phoneNumber || !captcha;

  return (
    <AuthPageLayout>
      {showSuccessCard && (
        <AuthCard className="max-w-[488px]">
          <div className="mb-[26px]">
````

</details>

<a id="evidence-095"></a>

### evidence-095: `proj-ehadj-ui/src/pages/ResetPassword/index.jsx`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 39–89:

````text
  const { token, email } = credentials;
  useLayoutEffect(() => {
    if (searchParams.has('token') || searchParams.has('email')) {
      const next = readPasswordResetSession(searchParams.toString());
      savePasswordResetSession(next);
      setCredentials(next);
      const clean = new URLSearchParams(searchParams);
      clean.delete('token');
      clean.delete('email');
      setSearchParams(clean, { replace: true });
    } else if (!credentials.token) {
      clearPasswordResetSession();
    }
  }, [searchParams, setSearchParams, credentials.token]);

  const { mutate: resetPassword, isLoading: isMutating } = useMutation({
    mutationFn: () => {
      if (!token || credentials.expiresAt <= Date.now()) {
        clearPasswordResetSession();
        setCredentials({ token: '', email: '', expiresAt: 0 });
        throw new Error('Veuillez rouvrir votre lien de réinitialisation.');
      }
      return api.post('auth/user_token/reset_password/', { token, password: pwd, password2: confirmPwd });
    },
    onSuccess: () => {
      clearPasswordResetSession();
      toast.success(Locales.auth.password_reset_with_success);
      navigate({ resetScroll: false, to: Urls.front.login, replace: true });
    },
    onError: (error) => {
      if (
        [
          "Ce lien n'est plus valide. Veuillez accéder à la page 'Mot de passe oublié' pour en générer un nouveau.",
          'This reset link has already been used. Please request a new one.',
        ].includes(error)
      ) {
        clearPasswordResetSession();
        setCredentials({ token: '', email, expiresAt: 0 });
        setInvalidLinkMessage(error);
      } else {
        toast.error(typeof error === 'string' ? error : 'Oups ! Une erreur est survenue.');
      }
    },
    onSettled: () => {
      submitting.current = false;
    },
  });

  const isValidPwd = pwdRuleSize && pwdRuleUppercase && pwdRuleLowercase && pwdRuleNumber && pwdRuleSpecial;

  const toggleDisplayPassword = () => setDisplayPwd((val) => !val);
````

Original lines 92–127:

````text
  const validatePassword = (password) => {
    setPwdRuleSize(password.length > 8);
    setPwdRuleUppercase(/[A-Z]/.test(password));
    setPwdRuleLowercase(/[a-z]/.test(password));
    setPwdRuleNumber(/\d/.test(password));
    setPwdRuleSpecial(/[`!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~]/.test(password));
  };

  const handlePasswordChange = (value) => {
    const newPassword = value;
    setPwd(newPassword);
    validatePassword(newPassword);
  };

  const enableSubmitButton = Boolean(token) && isValidPwd && pwd === confirmPwd;

  return (
    <AuthPageLayout>
      <AuthCard className="max-w-[480px]">
        <div className="space-y-6">
          <div className="mb-[25px] text-left">
            <h1 className="text-2xl font-semibold leading-[1.3] tracking-[-0.55px] text-[#21312a] max-[520px]:text-[22px]">
              {Locales.auth.reset_password_title}
            </h1>
            <p className="mt-2 text-sm leading-[1.6] text-[#62736a]">{Locales.auth.reset_password_message}</p>
          </div>

          <form className="space-y-6">
            {!token && (
              <div role="alert" className="text-sm text-destructive">
                {invalidLinkMessage || 'Ce lien est absent ou n’est plus disponible.'}{' '}
                <Button
                  type="button"
                  variant="link"
                  onClick={() => navigate({ resetScroll: false, to: Urls.front.password.forgot })}
                >
````

</details>

