# Access-control review — local development

Generated 5 October 2026 against the local `insurance_portal_db` database using the read-only repeatable-read review script. Full row-level output is in [access-control-review-2026-10-05.csv](../reports/access-control-review-2026-10-05.csv).

| Finding | Count | Review |
|---|---:|---|
| Permission assignment rows | 2,519 | Includes active memberships in test and development companies. |
| Potential broadenings | 0 | No direct or role scope differs from the legacy membership scope by widening. |
| Incomparable scope changes | 0 | No branch/department scope conflicts were present. |
| Invalid or cross-company scope targets | 0 | No out-of-company or unassigned targets were present. |
| Explicit role permission scopes | 0 | Existing roles continue to use membership scope until an administrator configures per-permission scopes. |
| Legacy role-scope fallbacks | 2,516 | Review role bundles with company owners before enabling new assignments. |
| Explicit direct scopes | 3 | All were USER scope and unchanged from legacy behavior. |

This is a local dry run. It does not approve activation in production and does not replace the staging acceptance matrix.
