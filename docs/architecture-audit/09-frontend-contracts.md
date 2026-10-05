# Frontend contracts

All 14 production frontend/template/language files (3,856 lines) were read end-to-end.

| Producer/consumer | Contract to preserve |
| --- | --- |
| Activity operation list -> `activities.js` | row template, stable existing IDs/version fields, 50-row cap, indexed names, `data-partner-id`, amount/date fields and submit action |
| Activity amounts -> `MjlFinance.summary` | BigInt-safe XOF arithmetic; null distinct from zero; malformed/negative/overflow rejection; French display |
| Date/select controls -> `MjlUi` | named hidden ISO value, visible French control identity/label, strict date parsing, optional jQuery UI/Select2, dialog-aware dropdown and teardown |
| Shell -> `mjl_components.js` | navigation IDs/backdrop/main content, 980px breakpoint, owned `inert`, focus trap/restore and Escape |
| Forms -> shared validation/submission | HTML validity, French summaries, `aria-invalid/describedby`, clicked submitter name/value, duplicate-submit guard, dirty navigation event |
| Tabs/action menus | ordinary anchor fallback, ARIA enhancement, keyboard/focus/viewport behavior |
| Exception forms -> dialog | reparent existing form rather than clone; preserve CSRF/version/nonce and user-entered reason on close |
| Access/reference forms -> dialog | shared movement mechanics with intentionally different dirty/reset policy |
| Operation drawer | read-only escaped server text/data; no mutation interface |
| Auth templates -> `mjl_auth.js` | reveal, six-digit logical OTP, visual slots, Unicode password rules and busy state |
| Invitation/reset -> `auth_fragment.js` | fragment verifier copied into hidden POST then fragment cleared |

No production fetch/XHR or browser-storage contract was found. Transport is server-rendered GET/POST and links. JavaScript enhancement is not authorization.

## Findings

- Current design-system unit checks contain formatting-sensitive and semantic expectations that contradict minified auth CSS/current forgot-password markup.
- Shared test login helpers expect `Connexion` while the current template renders `Se connecter`.
- `.mjl-document-*` and `.mjl-roadmap-list` selectors have no discovered producer; classify as unresolved dormant CSS, not confirmed dead.
- Invitation/reset fragment redemption requires JavaScript; qualify broad no-JavaScript claims.
