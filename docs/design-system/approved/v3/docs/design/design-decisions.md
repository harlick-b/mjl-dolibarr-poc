# v3 Design Decisions

| ID | Decision | Consequence |
| --- | --- | --- |
| DS3-001 | Inter is the primary browser font. | Load 400, 500, 600, and 700 with the mandatory fallback stack. |
| DS3-002 | Font loading is MJL-document scoped. | Use one header hook with strict path and authentication checks. |
| DS3-003 | The external source is the exact approved Google CSS2 URL. | No import, JavaScript injection, invented SRI, or broad CSP change. |
| DS3-004 | Compact density remains deliberate. | Use 32px, 40px, and 44px control roles plus 40px and 44px row roles. |
| DS3-005 | Controls are clearly bounded. | Use strong borders and a 10px radius without changing card and panel shapes. |
| DS3-006 | Workflow states are badges, not pills. | Use a 6px radius and reserve 999px for true chips and pills. |
| DS3-007 | `#caface` is success-badge-only. | General success feedback retains the established lighter surface. |
| DS3-008 | Accessibility states are explicit. | Cover focus, hover capability, active, disabled, reduced motion, forced colors, and print. |
| DS3-009 | v2 is retired only after validated promotion. | Recover historical v2 from Git rather than keeping a stale in-tree archive. |
