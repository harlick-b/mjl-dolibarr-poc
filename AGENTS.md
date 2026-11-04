# Agent Instructions

The user's latest explicit request takes precedence. Read docs/business-rules.md
first, then only current guides relevant to the task: docs/engineering.md,
docs/security.md, docs/design.md and docs/project-status.md. README.md owns setup.
Requirements govern behavior; code and passing tests are implementation evidence,
never user acceptance or production readiness. Ask only about unresolved business
choices, contradictory requirements or missing external inputs.

## Communication

When asked to explain a concept, always use layman's terms. Explain the effect
for the person using the app first, with familiar words and a concrete example;
define necessary technical terms.

## Scope and implementation

Implement only the authorized task. A short authorization is sufficient for a
concrete slice: derive the smallest complete plan from approved rules and actual
code, implement, verify and stop. No external execution prompt or repeated
approval for routine fixes. Do not infer permission for the next slice.

Before edits map each mechanism to a requirement or concrete security/integrity
risk. Prefer existing seams; remove speculative abstractions. Reassess if scope
grows and after an hour of active implementation. No generic workflow engine,
event bus, repository framework, microservices, offline database or mutation queue.
Describe invariants before prescribing table/endpoint counts. Preserve exact XOF,
immutable approvals, no-self-validation and server-side role/resource isolation.

Keep one concise contract per new slice when useful: outcome/exclusions, changed
API/data/UI seams, decisions/dependencies, focused checks and independent review.
Extend existing guides when sufficient; do not require separate execution prompts,
closure/recheck documents or approval for routine technical correction. Link
settled standards rather than duplicating them. Update project status at completion
when capabilities or unresolved boundaries change; avoid accumulating spent plans.

## Engineering and design

Use React/Vite JavaScript/JSX, Router/Query, Tailwind/shadcn/Lucide, FastAPI,
PostgreSQL, SQLAlchemy 2 and Alembic. Router owns navigation, Query server state,
React temporary forms. Routes validate/authorize; use cases own transactions and
atomic audit; persistence helpers never commit. Apply the complete engineering
guide's UI/API/shared-helper contracts for touched pages and APIs, including
cursor lists (default 60/max 100, invalid 422), RestClient/useAPI, localization,
Sonner, Helmet and cookie/CSRF protections. Reuse helpers, not copied examples.

Read docs/design.md before visual changes. Use approved tokens and applicable
supplied inspiration; missing inspiration blocks that screen only. Product claims
in visual examples cannot override business rules. No persistent sample/demo
data, hard-coded credentials or committed secrets. Tests use minimal disposable
isolated data with teardown, never a shared tenant. Local real-account Resend use
is authorized; production, provider/region and external acceptance remain gated.

## Verification and independent review

Choose checks for changed behavior and risks; include interactions with adjacent
workflows. Use focused checks while iterating; broaden when shared changes or
unresolved risks justify it. After fixes rerun affected checks, not unrelated
suites. Never waive a mandatory gate or present older evidence as a final run.
Record tested source/artifact with actual commands/results; bind migration
compatibility to that candidate. Measure slow setup before optimizing fixtures;
retain real disposable PostgreSQL for constraints, transactions and concurrency.

Documentation-only work uses status, diff/stat, diff --check, reference checks and
direct new-file review. Skip runtime suites when no behavior changed and report
why. Do not run broad benchmarks or production audits without an explicit request.

Every implementation plan ends with a separate review-only agent that did not
implement it. The reviewer independently inspects requirements, actual diff,
surrounding code and evidence, treating explanations/test claims as unverified;
it must not edit implementation or fix its own findings. Report severity,
file/line, impact and smallest correction, including verification gaps. The
implementer fixes accepted findings and returns the candidate to the same reviewer.
Do not declare completion until blocking findings/gaps are resolved; if no separate
reviewer is available, report the gate blocked. Review is not acceptance,
production readiness or authorization for more work.

## Skills, memory and Git

Prefer repository skills in skills/<name>/SKILL.md; global skills are read-only.
Route architecture to codebase-design, unclear product choices to grill-with-docs,
domain changes to domain-modeling, bugs to diagnosing-bugs, behavioral work to tdd,
exploration to prototype, skill maintenance to writing-great-skills and substantial
reviews to code-review. Use local design-system-guardian, security-baseline-review
and confidence-review-loop for their concerns. Procedures cannot expand scope or
require runtime work for a documentation audit. Do not create per-library skills.

Use subagents only when explicitly requested or for independent audits. Consolidate
findings before edits. Evaluate tasks/lessons.md after meaningful work; add only
repeated corrections or durable discoveries, and read only relevant lessons.
Preserve unrelated worktree changes and backend/.venv. No destructive Git/filesystem
operations without authorization, deployment or production configuration changes.
Stop after the authorized scope.
