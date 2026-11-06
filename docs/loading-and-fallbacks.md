# Loading and recovery screens

This contract describes what a person sees while MJL waits for data and when a
read or screen cannot continue. A failed refresh must never imply that a
successful invitation, approval or payment declaration failed.

## Loading today

| Surface                                 | Current behaviour                                                                                                                                                                                           |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login, password definition and recovery | The form stays visible. The submitted button shows a spinner and is disabled; fields are locked until the result arrives. No loading sentence appears beneath the button.                                   |
| OTP                                     | Six digits trigger verification automatically. Only the action being submitted spins, including resend or cancellation. Duplicate submission is guarded.                                                    |
| Logout                                  | One centered indicator says “Déconnexion”; protected content stays hidden until the ready login page replaces it.                                                                                           |
| Initial session check                   | The two-column authentication frame shows “Vérification de votre accès”; protected content and identity stay hidden. A check is not an extra confirmation step.                                             |
| Authenticated page wait                 | The verified shell remains visible and one centered loader says “Chargement des données…”. It does not draw fake cards or tables.                                                                           |
| Admin users                             | The verified sidebar remains visible around the minimal page loader. The unified accounts/invitations table uses local placeholders while its query refreshes.                                              |
| Admin background session check          | The access gate removes protected content and identity and returns to the two-column verification frame. Protected forms unmount; ordinary page-data refreshes remain distinct and may retain local drafts. |
| History and profile                     | Access checks hide identity in the authentication frame. Ordinary page waits use the minimal loader; background refreshes retain the verified workspace.                                                    |
| Planning                                | Initial page waits use the minimal loader. Dependent lists, metrics, tables and document previews keep local indicators or subtle placeholders. Dirty forms remain mounted during refresh.                  |
| Execution                               | Initial list/detail waits use the minimal loader. Execution and financial sections keep local indicators; background refresh uses a compact progress indicator.                                             |
| Partner portal                          | Portfolio, PTA, activity and shared-document sections load separately. Authorization is checked before private data is displayed.                                                                           |
| Notifications and service status        | Dedicated page placeholders, then data or a distinct empty/error result.                                                                                                                                    |
| Document preview and exports            | Preview waits inside its dialog. Export controls indicate preparation; a failed download remains distinct from an empty list.                                                                               |
| Other business mutations                | BusinessForm shares its saving state with submit Buttons, which lock and show a spinner. Standalone actions use the Button loading contract or explicit busy feedback.                                      |

The shared `PageLoading` component owns the minimal page indicator;
`LoadingPlaceholder` is limited to local table, form and preview shapes.
Screen-reader labels and `aria-busy` describe waiting. Reduced-motion support is
a design requirement, not established by the current spinner implementation.
Router owns navigation waits; Query owns server requests;
form drafts remain local React state. Auth errors and feedback are scoped to their
route and do not follow navigation to a different form. Switching tabs alone does
not clear drafts or start session recovery. See [design](design.md) and
[engineering](engineering.md).

## Write success versus refresh failure

An invitation can return `201 Created`, then refreshing the accounts list can
return `503 Service Unavailable`. The write succeeded; the read failed. Refresh
the list before considering another invitation. Delivery status comes from the
server's recorded provider result, not from whether the list refresh succeeds.

Concurrent session, account, history and planning reads share identity locks;
account changes still require exclusive locks. This avoids serializing independent
reads without weakening revocation checks. Network or database outages can still
cause a 503; the UI must remain useful when they do.

The users page keeps confirmed invitation feedback separate from list-refresh
errors. A failed list now has a bounded panel, explanation and refresh button.
Refreshing reads does not resend an invitation. Actual mail rejection has its own
message: the invitation exists, but delivery failed and needs a deliberate resend.
An interrupted write has an unknown result and must be reconciled before retrying.

## Fallback cases

| Case                                                      | Why it appears                                                      | Current handling                                                                                                                                                                                                                                             |
| --------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Session unavailable                                       | Identity request fails, including database or network failure       | Network/service/timeout failures mask data and show login with an unavailable message. A refresh-safe local hold requires confirmed server logout before fresh sign-in; ordinary page-data errors remain local.                                                                                                  |
| Offline or identity invalidated                           | Lost connection, expiry or account change from another tab          | Access-revalidation screens mask protected data. Keep a stable non-sensitive shell and offer reconnect/check access; never replay a write.                                                                                                                   |
| Access refused                                            | The verified role cannot open the route                             | The framed denial returns to the role's own workspace. Retrying cannot grant permission and unauthorized navigation remains absent.                                                                                                                          |
| Invalid invitation or password-reset link                 | Proof is missing, expired, consumed, revoked or invalid             | The auth card explains the problem; reset offers a new recovery request and invitation directs the user to the administrator. The invitation API intentionally returns one invalid-or-expired outcome, so the UI does not claim to distinguish those causes. |
| Accounts list unavailable                                 | A list request fails after initial load or a successful action      | The unified list's retry panel retains navigation and successful-action feedback. Do not label this an invitation failure.                                                                                                                                   |
| History, planning, execution or notifications unavailable | A data request fails                                                | Shared RetryableError panels provide local alerts and read-retry actions. Some specialized failures still use individual alerts. Improve section-specific copy while preserving confirmed writes.                                                            |
| Partner portfolio or file unavailable                     | Failed request, inaccessible resource or stopped sharing            | Local error/retry where supported. Keep Partner scope private; do not reveal whether another Partner owns an inaccessible ID.                                                                                                                                |
| Document preview or export failure                        | Offline, delivery failure, revoked permission or generation failure | Dialog/section error remains near its action. Use a consistent retry/close layout; distinguish retryable failure from withdrawn access.                                                                                                                      |
| Stale or conflicting mutation                             | Another change invalidated the displayed version                    | Explain that data changed and reload the affected record. Do not silently overwrite a draft or resubmit an approval.                                                                                                                                         |
| Empty result                                              | Successful request contains no matching items                       | Show a purposeful empty state. This is neither loading nor an error.                                                                                                                                                                                         |
| Unknown URL                                               | No application route matches                                        | Verified users retain their authorized shell and can return to their role workspace; anonymous visitors return through the normal entry flow.                                                                                                                |
| Unexpected rendering failure                              | A client-side exception prevents the page rendering                 | The router provides a sanitized “Une erreur est survenue” screen and deliberate page reload without framework diagnostics.                                                                                                                                   |

## Shared fallback pattern

Use one visual pattern with distinct meanings, rather than making every failure
a “not found” page: keep the appropriate shell, show a short title, explain what
the person can do, and offer one primary recovery action. A missing URL returns
to the workspace; temporary service failure retries a read; forbidden access
returns to an allowed page; an invalid proof offers the relevant recovery route.

Never use a 404 to conceal an ordinary temporary outage. Conversely, private
resource authorization may deliberately return 404 without revealing existence.
Loading placeholders must end in content, an empty state or an actionable error.
The shared presentation component implements this pattern without changing the
owning recovery handler.

## Response privacy

Responses use explicit projections. Session data retains the identity and CSRF
context needed by the app, but not the unused Partner binding. Invitation responses
omit unused account/Partner identifiers. Activity lists send explicit display
projections rather than full activity details. Financial responses omit stored internal
reviewer-exclusion sets and unused snapshots; funding retains the two displayed
budget amounts. Stored audit and approval evidence remains unchanged.

Database diagnostics log only exception type, database error code, an allowlisted
relation label and request reference. SQL, parameters, cookies, connection URLs,
passwords and proof values do not belong in API errors or application logs.
