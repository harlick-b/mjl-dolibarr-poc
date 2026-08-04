# v3 Component Inventory

| Surface | v3 behavior |
| --- | --- |
| Authentication shell | Inter fallback stack, strong 10px controls, 44px primary action, explicit focus and disabled states. |
| Workspace shell | Scoped typography and responsive navigation without native Dolibarr restyling. |
| Page header | One page heading, 24px/32px type role, optional context, and authorized actions. |
| Section heading | 20px/24px type role with compact supporting text. |
| KPI card | 32px/40px KPI value, definition and freshness context, and a guarded destination. |
| Form control | 40px standard height, strong border, 10px radius, visible focus and error state. |
| Important action | 44px minimum height with two-color focus on accent surfaces. |
| Compact action menu | 32px summary on fine pointers and 44px on coarse pointers. |
| Data table | 40px data rows and 44px explicitly interactive rows through cell padding and line-height. |
| Status badge | 6px radius, 20px minimum height, visible text, and canonical status pairs. |
| True chip or pill | 999px radius only when the shape represents a chip or pill. |
| Timeline and audit | Persistent actor, action, date, status, and comment evidence, including print. |
| Report view | Screen filters and export actions, with report evidence preserved when printed. |

Existing markup selectors may remain for compatibility when their rendered
semantics match this inventory. No component may weaken route, role, entity,
scope, workflow, document, or export guards.
