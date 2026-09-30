# Underwrite Legacy Deprecation Plan

Status date: 2026-09-29

This is a plan only. Do not remove, redirect, or hide legacy
`/underwriting/*` behavior until the owner signs off after Phase 9 QA evidence
is complete.

## Goals

- Move back-office users from legacy `/underwriting/*` screens to the new
  `/underwrite/{motor|fleet|non-motor}` module.
- Preserve legacy APIs needed by customer and intermediary portals.
- Retire duplicated wizard code only after production traffic confirms the new
  line-scoped module is stable.
- Keep rollback simple: disabling the company switch should restore the legacy
  menu and route entry points immediately.

## Preconditions

- Phase 9 staging checklist is complete with evidence in the release ticket.
- Migrations and seed have run successfully on a staging database copy.
- Legacy quotation, endorsement, cancellation, renewal, TIRA, policy, and portal
  journeys have passed with `mock-tira`.
- Each new wizard can produce an issued policy:
  - Motor single
  - Fleet
  - Non-Motor
- Support, operations, and underwriting leads have approved the cutover date.

## Company Switch

Add a per-company feature setting before changing production navigation:

- Suggested key: `underwrite_new_module_default`
- Scope: company
- Default: `false`
- Effect when `true`:
  - Show the new Underwrite section as the primary underwriting navigation.
  - Optionally keep the legacy Underwriting menu visible to admin/support roles
    during the grace period.
  - New internal documentation and saved links point to `/underwrite/*`.
- Effect when `false`:
  - Current legacy menu and routes remain unchanged.
  - New module may still be reachable by direct URL for users with permissions,
    unless the owner asks for a stricter gate.

## Redirect Strategy

Do not redirect immediately. Use three stages:

1. Parallel run:
   - Both legacy `/underwriting/*` and new `/underwrite/*` routes remain active.
   - No automatic redirects.
   - Collect support issues and compare issued policy/TIRA outcomes.
2. Soft redirect:
   - For companies with the switch enabled, legacy entry pages show a visible
     move-forward link to the matching Underwrite line.
   - Deep legacy detail URLs continue to work.
   - Admin/support roles can bypass the prompt.
3. Hard redirect:
   - Only after owner sign-off.
   - Legacy creation/edit entry points redirect to the new line-specific wizard.
   - Legacy read/detail URLs remain available until portal dependencies and
     audit workflows no longer need them.

## Route Mapping

- Legacy motor single quotation creation -> `/underwrite/motor/quotations/new`
- Legacy fleet quotation creation -> `/underwrite/fleet/quotations/new`
- Legacy non-motor quotation creation -> `/underwrite/non-motor/quotations/new`
- Legacy quotation list -> `/underwrite/{line}/quotations` when the line is
  known; otherwise keep the legacy mixed list until all links carry a line.
- Legacy policy list -> `/underwrite/{line}/policies` when the line is known.
- Legacy TIRA failed/pending queues -> `/underwrite/{line}/tira-failed` and
  `/underwrite/{line}/tira-pending` when the line is known.
- Legacy endorsements/cancellations/renewals -> line-scoped work queues when
  the source policy line is known.

## Code Retirement Order

1. Stop adding new features to legacy wizard pages.
2. Move any shared wizard-only utilities still duplicated between legacy and
   underwrite into neutral shared modules.
3. Replace legacy menu entry points with switch-aware links.
4. After hard redirect sign-off, remove legacy creation/edit pages that are no
   longer reachable.
5. Keep legacy read APIs until customer/intermediary portals and audit reports
   have explicit replacement paths.
6. Remove duplicate wizard logic only after a release cycle with no rollback.

## Rollback

- Disable `underwrite_new_module_default` for affected companies.
- Leave all legacy routes deployed until the rollback window closes.
- Re-run the authorization-context refresh check to make sure menu visibility
  updates without user re-login.
- Keep migration rollback separate from navigation rollback; the additive
  columns and permissions are safe to leave in place.

## Monitoring

Track these during parallel and soft-redirect periods:

- New quotations by line and source route.
- Draft abandon rate by wizard and line.
- Finalize failures by validation code.
- TIRA submission failures and retry success rate.
- Issued policy counts by `business_line`.
- Support tickets mentioning missing menu access or wrong-line records.
- Portal document/policy load errors for policies issued through Underwrite.

## Owner Sign-Off Checklist

- Phase 9 evidence reviewed.
- Company switch behavior approved.
- Redirect stage and date approved.
- Rollback owner assigned.
- Support notes prepared.
- Legacy API retention list approved.
