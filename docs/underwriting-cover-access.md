# Underwriting cover access

Access to quotations and policies can be limited by **cover**, which combines quotation flow, product, risk and cover period.

| Cover | Granted by | Records |
| --- | --- | --- |
| MOTOR / FLEET / NON_MOTOR | `underwrite.<line>.<action>` (existing) | Everything in the line, **including** its Short-Term cover |
| SHORT_TERM_SINGLE | `underwrite.short_term.<action>` | MOTOR_SINGLE, product `SP014001000000`, every risk `SP014001000007`, period ≤ 30 days |
| SHORT_TERM_FLEET | `underwrite.short_term_fleet.<action>` | Same rules on MOTOR_FLEET |

Cover actions: `view`, `create`, `edit`, `delete`, `submit` (approval request, payment request, TIRA), `approve`, `policies.view`, `tira.retry`. Endorsements, cancellations and renewals stay with the line grant.

## How grants combine

- Role grants and direct grants are merged into one permission set; role exclusions apply first. Grants are additive.
- A line grant includes the Short-Term cover in that line. A Short-Term grant never includes Motor or Fleet.
- The base action permission (`quotations:create`, `policies:read`, …) is still required. The user, branch, department and company data scope applies on top of the cover restriction.
- Administrators assign grants on the Roles screen (Underwriting access matrix) or as direct user grants. The user screen shows the effective matrix and where each grant comes from (line or cover). No deployment is needed.
- The Short-Term definition (codes, 30 days) is in `libs/contracts/src/underwrite/cover-access.ts`, shared by the API and the web app.

## Enforcement (server)

- `quotations.underwrite_cover` is classified on every write, inside the write transaction, from stored state: flow, product code, every stored and draft risk, and the cover-note period. If the user lacks the grant for the resulting cover (or edit rights on the previous cover), the write is rolled back.
- A client-stated cover (`underwrite_cover` on draft DTOs) is used only while a draft has no risk yet, and must match the flow and product. An unlabelled empty draft is treated as its whole line.
- Mixed risks, a transit risk on another product, or a period over 30 days classify as the whole line, so only line holders can access them.
- `DataAccessScopeService` adds the cover filter to quotation and policy read and write scopes, which applies to lists, search, detail views, documents, payment, submission, approval, dashboards and the Underwrite and general routes. A scope resolved for a quotation or policy permission that the user holds is strict. In other contexts (claims, reports, portal and internal calls), only users holding a restricted-cover grant are narrowed.
- Underwrite `:line` routes accept Short-Term grants only where they opt in with `@UnderwriteLineAccess(action, { covers: true })` (quotation and policy reads and quotation writes).

## Migration `1796000000000-UnderwriteCoverAccess`

- Classifies existing quotations conservatively. Anything ambiguous gets its whole line, so no restricted grant ever gains historical records.
- Adds `underwrite.<line>.submit` and the Short-Term permissions. Short-Term permissions are granted to nobody.
- Gate backfill: a role or direct grant that holds a quotation or policy permission but no gate for that action receives the gate on the lines it already uses (every line if it had none), which restates its previous access.
- Revocation: role and permission edits bump `authorization_version`; tokens carrying the old version are rejected on the next request.

## Known limitations

- Invoice and receipt PDFs (finance routes) are not cover-filtered.
- The TIRA queue lists and the line customer register remain line-only.
- Adding a new restricted cover type requires a code change. Assigning existing covers does not.
