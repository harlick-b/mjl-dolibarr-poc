# ADR 0002: Freeze document rules and lifecycle as append-only records

MJL product decisions come from `../mjl-authoritative-decisions.md`.

## Status

Accepted

## Context

Phase 4 reviews must preserve the exact document requirement and evidence state
that reviewers assessed, even after category changes, replacement, or
withdrawal. Mutable category and version-state fields would rewrite that
historical meaning and make concurrent outcomes ambiguous.

## Decision

Record category changes as immutable Category Rule Revisions and document
state changes as sequenced lifecycle events. Submitted business revisions
freeze the complete selected rule payload and qualifying document identifiers.

## Alternatives considered

- Mutate the category catalog and copy only its identifier into submissions:
  rejected because later edits could reinterpret historical reviews.
- Store current/withdrawn state on Document Version: rejected because it mixes
  immutable uploaded evidence with mutable lifecycle history.

## Consequences

The model needs additional records, per-series ordering, immutable snapshots,
and rebuildable current-state projections. It gains durable historical truth,
detectable concurrency conflicts, and audit-aligned lifecycle evidence.

## Verification

Canonical contract tests must require complete frozen rule payloads,
append-only lifecycle fields, atomic replacement, irreversible withdrawal,
one derived current version per series, and retryable concurrency conflicts.
