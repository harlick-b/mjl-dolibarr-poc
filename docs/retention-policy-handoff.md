# Retention policy — decision handoff

Restored 2026-11-07 from the conversation after the temporary handoff disappeared.
This file concerns the deferred retention decision only. Application changes and
verification are recorded separately in [project status](project-status.md) and
the [implemented contract](history-logging-implementation-plan.md).

## Confirmed context

The team intends to pay a hosting provider; provider, plan and region are not yet
selected. The user will supply the retention decision later. No final duration
has been approved. Application implementation does not establish production log
persistence, protection or automatic expiration.

Business audit records and internal document/export evidence are distinct from
routine security logs. Do not apply a security-log expiration setting to business
audit records or delete historical evidence as part of this decision.

## Proposals awaiting a decision

The conversation considered these security-log retention options:

| Option | Discussion basis |
| --- | --- |
| 90 days | Shorter investigation window and lower retained volume. |
| Six months | Proposed starting preference for discussion, not an approved default. |
| One year | Longer investigation window with greater storage and privacy exposure. |

Fourteen days was also proposed for ordinary technical diagnostics, separately
from security logs. None of these numbers is asserted here as a legal minimum,
universal standard, provider capability or approved production configuration.

## Inputs needed

- Data owner/RSSI requirements, applicable contractual/legal obligations and who
  approves the duration. Use the existing [security baseline](security.md) for
  external dependencies; obtain current authoritative evidence before making
  compliance claims.
- How far back investigations must reach, how quickly incidents are usually
  discovered, and any incident-preservation exception to normal expiration.
- Provider, plan, region and responsibility for collection, storage, deletion and
  operator access. Confirm logs survive application deployment and replacement.
- Expected event volume, worker count and storage budget. Application rate caps
  limit output per worker; they do not implement retention.
- Whether searchable storage and any archive have different durations; include
  backups, exported copies and provider-managed copies in deletion arrangements.
- Authorized readers, monitoring owner, incident contact and a review date.

## Decision to return

Record the selected security-log duration, diagnostics duration, provider/region,
responsible owner, authorized readers, incident-preservation rule and approval
source. Keep business-audit retention a separately governed question.

After approval, configure the selected host's existing logging facilities where
sufficient. Verify persistence through redeployment, restricted access, automatic
rotation/expiration, storage limits and visibility of dropped/suppressed output.
Do not introduce new infrastructure without a demonstrated hosting gap. Production
configuration and deployment still require their own authorized scope.

## Suggested skills for the next session

Use `grill-with-docs` only if business choices remain unresolved, and the local
`security-baseline-review` skill for the selected hosting/retention evidence.
Consult current official provider documentation once a provider is selected.
