# MJL Clarity System - E2E Testing Strategy

MJL product decisions come from `docs/mjl-authoritative-decisions.md`; this
file covers UI/E2E strategy only.

## Purpose

Define E2E tests as the main validation method for the MJL Clarity System.

## Baseline Constraints

- Dolibarr core files must not be modified.
- MJL-specific implementation must remain inside safe custom module/theme boundaries.
- The production access model assigns one global MJL role per user: three business roles (AGENT_SAISIE, AGENT_VERIFICATEUR, VALIDATEUR_DEFINITIF) and one administration role (ADMIN_PLATEFORME).
- Access is invitation-only.
- Only Admin can send invitations for now.
- There is no public register page.
- The design system covers app UI, auth pages, system emails, official outputs, and E2E tests.
- E2E tests are the main validation method.

## Main Rule

End-to-end tests are the primary validation method. Micro/unit tests are allowed only when useful for business rules or security-critical logic, but they must not replace full feature E2E tests.

## Disposable Execution

Run browser coverage through the repository runner. It provisions one isolated
tenant with named volumes, creates only the minimal test-scoped records needed
for the selected journey, verifies the resolved Compose configuration before
startup, and removes project-scoped containers, networks, and volumes after
the run. Legacy POC seed data is prohibited as target evidence. A failed run
may be retained only through the explicit `MJL_TEST_RETAIN=1` diagnostic option.

Run artifacts live below a run-specific `test-results/runs/` directory. They
are diagnostics, not source evidence, and must not be committed unless a
reviewed compliance record explicitly requires them.

## Required Scenarios

### Scenario 1 - Invitation And First Access

Admin logs in, sends invitation, invitation status becomes sent, user opens link, defines password, logs in, account becomes active, and audit records lifecycle.

### Scenario 2 - Forgotten Password

User requests reset, neutral confirmation appears, user opens reset link, sets new password, and logs in.

### Scenario 3 - Activity Lifecycle

AGENT_SAISIE creates and submits an activity, AGENT_VERIFICATEUR prevalidates or returns it, timeline updates, audit updates, dashboard updates, and export reflects the result where applicable.

### Scenario 4 - Return For Correction

Reviewer returns an activity with comment, AGENT_SAISIE corrects it, resubmits it, and previous decision remains visible.

### Scenario 5 - Alerts

Create an approaching or overdue Activity inside the isolated test tenant; the
appropriate production role sees the alert, the alert links to the object,
user acts, and alert state updates if applicable.

### Scenario 6 - Export

User applies filters, exports, export respects filters, file is Excel-readable, filename is stable, and export is logged if applicable.

### Scenario 7 - Role Visibility

AGENT_SAISIE sees operational workspace, AGENT_VERIFICATEUR sees prevalidation
workspace, VALIDATEUR_DEFINITIF sees business supervision, ADMIN_PLATEFORME
sees platform administration, and unauthorized pages are blocked.

### Scenario 8 - Finance Feedback And Recovery

Convention, budget-line, and fund-receipt required-field failures preserve
only registered values and link only exact field errors. Composite failures
remain form-level. Duplicate references, database failures, timeline failures,
and unrecognized class failures show canonical non-technical messages. Tests
must cover the closed feedback envelope, tamper rejection, all nine
list/detail/timeline source pairs through an injected database adapter, exact
route wiring to the closed presentation helpers, opaque one-use recovery, and
absence of raw SQL, paths, tokens, filenames, and class errors in rendered or
browser/session feedback.
