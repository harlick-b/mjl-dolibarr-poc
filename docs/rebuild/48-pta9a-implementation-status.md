# PTA-9A implementation status

**PTA_9A_COMPLETE** on 2026-11-03.

Admins can invite synthetic `PARTENAIRE` accounts bound to one active Partner;
several accounts may share the binding. Existing invitation, password, OTP and
session security remain in use. Partner accounts may be deactivated individually,
while role changes and rebinding are rejected.

The separate read-only portal follows `docs/inspiration/partner-portal` while
reusing the regular MJL Project/PTA visual system. It exposes only the bound
Partner's Projects, annual PTAs, whole-PTA metrics and effective approved Activity
baselines. Cross-Partner resources return not found. Drafts, pending amendment
content, withdrawn/source placement, internal routes, files, Fiches, audit,
administration and exports remain unavailable.

Migration `0020_pta9a` adds the exclusive Partner role/binding and its immutable
update trigger to `auth_user`, with no table. The exact isolated-schema guard was
updated from the migrated PostgreSQL manifest.

## Final-candidate verification

- Final backend image
  `sha256:3522c0204880c5f3b72d35c2c222db996c43892aee8c8b433bbcc801b98f3a95`:
  the focused Partner PostgreSQL suite passed **5/5** in **32.19s**. It covers
  permanent database binding, actual next/previous cursor traversal and scope,
  approved baseline projection, hidden draft/source placements, cross-Partner
  denial, deterministic login/deactivation, recovery and transactional rollback.
- The broad authentication, access, policy, security and lifecycle run completed
  with **162 passed** and one randomized six-digit substring assertion failure;
  that exact test passed immediately on the unchanged candidate. The separately
  exposed CLI bootstrap regression was corrected and its deterministic
  concurrency test passed on the final code.
- Migration `0019_pta7b -> 0020_pta9a -> 0019_pta7b -> 0020_pta9a` passed on an
  empty disposable database; the final revision was `0020_pta9a`.
- Backend Ruff formatting/lint and strict mypy passed.
- Frontend Vitest — **77 passed**; ESLint, Stylelint, Prettier and production/PWA
  build passed with the existing chunk-size warning.
- Focused Chromium Partner journey — **1 passed** in **5.6s**, covering the
  read-only desktop and mobile portal.
- `git diff --check` passed. Runtime checks used synthetic identities, test mail
  and disposable `mjl-pta9a` PostgreSQL resources.

Independent engineering and product/security reviewers first rejected the
candidate for binding, projection, cache invalidation, pagination and evidence
gaps. The implementation was corrected and returned to the same reviewers. The
product/security reviewer passed the corrected candidate. The engineering
reviewer then passed the final candidate after independently checking the actual
API pagination oracle. No blocking finding remains.

Partner final-decision detail, Fiches, completed-finance detail, exports,
attachment visibility, Partner-entity lifecycle, real identities and production
remain deferred.
