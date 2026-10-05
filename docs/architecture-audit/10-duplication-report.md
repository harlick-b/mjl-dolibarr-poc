# Duplication report

| Candidate | Type/status | Important difference/risk | Future disposition |
| --- | --- | --- | --- |
| UI eligibility vs route vs command vs DB invariants | D4 / SECURITY_DUPLICATION | different trust boundaries and lock timing | preserve |
| Activity/Operation/request positive-ID and decimal parsing | D2 / SAFE_CANDIDATE after characterization | accepted inputs and error text differ | compare before any helper |
| business-role code lists in auth/scope/SQL/trigger installers | D3 / NEEDS_RECONCILIATION | drift could weaken access or activation | establish one authoritative behavior while preserving DB checks |
| predecessor and current list/audit/report paths | D3 / LEGACY_COMPATIBILITY | selected by schema readiness | retire only with explicit compatibility decision |
| dialog movers | D2 / INTENTIONAL | exception reasons persist; access forms reset/protect dirtiness; reference lifecycle differs | share mechanics only |
| client/server financial validation | D4 / INTENTIONAL | usability vs authoritative enforcement | preserve both |
| CSV/XLSX output helpers and newer renderer/export object | D2 / UNRESOLVED | older direct output functions may be unused | prove reachability before removal |
| repeated historical and VUI E2E assertions | D2 / NEEDS_RECONCILIATION | suite modes and schemas differ | map actual assertions before pruning |
| auth/application CSS token copies | D3 / MAINTAINABILITY | visual drift already visible in unit expectations | reconcile with v3 authority later |

No duplication was consolidated during the audit.
