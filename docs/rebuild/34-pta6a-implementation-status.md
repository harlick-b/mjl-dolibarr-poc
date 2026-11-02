# PTA-6A implementation status

Status: `PTA_6A_COMPLETE` on 2026-11-02.

## Implemented boundary

PTA-6A adds optional, append-only PDF/JPEG/PNG evidence to an Activity for the
isolated synthetic environment. Agents and Validators can upload; Agents,
Supervisors and Validators can list and download after fresh server-side
authorization. Admin is denied. Upload and successful download are audited.

Migration `0017_pta6a` adds one Activity-document table. The API adds cursor
list, bounded binary upload and attachment download responsibilities. The
existing Activity screen adds a compact French attachment panel. Preview,
replacement, withdrawal, categories, Partner access, broader parent contexts,
production storage/scanning/retention and real accounts remain excluded.

## Candidate evidence

- Disposable PostgreSQL: thirteen focused document/API/migration checks pass,
  including role and parent scope, CSRF, content/name/type/size rejection,
  streaming bounds, all three formats, cursor behavior, lifecycle races,
  fail-closed schema provenance, atomic audit rollback, append-only enforcement
  and downgrade safety.
- Adjacent migration-repeatability and Activity Fiche regressions were run on
  the same source candidate.
- React/Vitest covers upload, Query invalidation and guarded download
  composition; a focused Playwright journey covers the browser interaction.
- Ruff, strict mypy, ESLint, Stylelint, Prettier and the production Vite build
  are final-candidate gates.

## Independent review

Separate engineering and security/specification reviewers initially rejected
the candidate. Their findings covered offline replay, unbounded request
accumulation, parser and database work on the async event loop or under the
lifecycle lock, missing lifecycle/audit/schema/format evidence, pagination and
response contracts. The implementation corrected those findings and reran the
affected checks. Both same reviewers then returned `PASS` with no remaining high
or medium finding.
