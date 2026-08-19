---
status: accepted
---

# Phase 4 owns document policy outside native ECM delivery

The approved Phase 4 document module owns categories, authorization, series,
versions, revision snapshots, quotas, lifecycle, and audit behind one
contextual interface. Native ECM is only an entity-matched metadata/storage
adapter, not an authorization or delivery interface, because its generic
routes cannot express the MJL parent, revision-contributor, and workflow-lock
invariants without leaking policy across callers.

Accepted bytes are immutable extensionless ciphertext outside the web root.
Normal download is guarded by the MJL module, while browser preview runs on a
separate registrable HTTPS origin. This trades operational complexity and the
explicit one-minute preview-staleness risk for locality of authorization,
containment of browser-rendered originals, and a rollback path that always
returns to RST-010A denial rather than native or legacy delivery.
