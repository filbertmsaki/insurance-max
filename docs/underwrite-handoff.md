# Underwrite module — handoff

Branch: `feat/underwrite-module` (branched from `fix/optional-prev-cover-note-reference`).
Status date: 2026-09-29. Nothing is committed yet unless the commit log says otherwise.

## Goal

Split underwriting into **Motor | Fleet | Non-Motor** — separate menus, routes, CRUD,
wizards and permissions — while reusing the existing quotation / pricing / TIRA /
policy-transaction engines. It is a presentation and permission layer, not a rewrite.

## Hard rules

1. **Do not modify, remove, rename or redirect the legacy `/underwriting/*` routes,
   pages or behaviour.** The new module lives at `/underwrite/*` alongside them.
   Deprecating the old module (Phase 10) needs explicit approval from the owner.
2. **Shared backend code may only get additive changes** (optional filters, extra
   columns written) that leave existing callers' behaviour identical.
3. **No destructive migrations.** New columns nullable; `IF NOT EXISTS`; backfill.
4. **Do not touch the uncommitted edits under `apps/tiramis/`** — they are the
   owner's separate work in progress (they currently make 2 tests in
   `tiramis-retry-scheduler.service.spec.ts` fail; that is not ours to fix).
5. Backend authorization is the final enforcement; the UI only hides what the
   user cannot do.

## Architecture (decided — do not re-litigate)

- **Line = `quotations.quotation_flow`**: `MOTOR_SINGLE`→Motor, `MOTOR_FLEET`→Fleet,
  `NON_MOTOR`→Non-Motor. Shared definitions: `libs/contracts/src/underwrite/`
  (`UnderwriteLine` is a const object, not a TS enum — see gotchas).
- **Policies** got a nullable `business_line` column (migration `1790800000000`),
  written by issuance; reads use `policyBusinessLineSql()`
  (`apps/insurance-portal-service/src/modules/tenant/policies/utils/policy-business-line.sql.ts`),
  which falls back to the source quotation / product for old rows.
- **Permissions**: `underwrite.dashboard.view` + `underwrite.{motor|fleet|non_motor}.{view,create,edit,delete,approve,policies.view,policies.edit,renewals.view,renewals.manage,endorsements.view,endorsements.manage,cancellations.view,cancellations.manage,tira.retry}`.
  They are a **line gate on top of** the existing permissions: every new route
  requires the gate AND the legacy permission (e.g. `quotations:complete`).
  Granted by migration to every role/user holding the mapped legacy permission,
  and by the seed via `withUnderwritePermissionAliases`.
- **Backend** (`apps/insurance-portal-service/src/modules/tenant/underwrite/`):
  controllers on `tenant/underwrite/:line/...` guarded by `UnderwriteLineGuard`
  (resolves `:line`, checks the gate declared with `@UnderwriteLineAccess`,
  fails closed). Services delegate to the existing `QuotationsService`,
  `PoliciesService`, `CustomersService`. A record from another line → **404**.
- **Frontend** (`apps/insurance-portal-web/src/modules/tenant/underwrite/`):
  routes in `routes.tsx` (rendered by `renderUnderwriteRoutes()` in `App.tsx`),
  menu in `nav.ts` (inserted into `components/layout/nav-config.ts` as an
  "Underwrite" section), lazy pages in `lazy-pages.tsx`.
- **Wizards** share `wizard/useUnderwriteQuotationWizard.ts` + `UnderwriteWizardShell.tsx`.
  They reuse the legacy form contract (`QuotationFormSchemaValues`, payload
  builders, step components) and call the line endpoints. The hook's cross-step
  effects are a deliberate copy of `quotations/pages/QuotationWizardPage.tsx`
  (legacy page left untouched) — keep them in sync until Phase 10.

## Done

### Phase 3 — foundation
- Migration `1790800000000-UnderwriteLinesAndPermissions.ts` (policy `business_line` + backfill + index; 43 permissions + grants). Its permission list is a frozen snapshot, checked against the contract by `libs/contracts/src/underwrite/underwrite-permissions.spec.ts`.
- Seed `001-initial-rbac.seed.ts` includes the new permissions.
- API: `GET tenant/underwrite/dashboard`, `GET tenant/underwrite/:line/{dashboard,quotations,quotations/:id,policies,policies/:id,customers}`.
- Additive filters: `FilterPolicyDto.business_line`, `FilterCustomerDto.business_line`.
- UI: Underwrite menu section, dashboards, quotation/policy lists, detail routes behind `UnderwriteRecordGate` (reuses legacy detail screens).

### Phase 4 — Motor
- Line-scoped writes: `POST :line/quotations/drafts`, `GET :line/quotations/:id/edit`, `PUT :line/quotations/:id/draft`, `POST :line/quotations/:id/finalize`, `DELETE :line/quotations/:id/draft` (`underwrite-quotations.controller.ts`, `common/underwrite-quotation-command.service.ts`; replicates the legacy product/category access check).
- Motor wizard `motor/MotorQuotationWizardPage.tsx`: Customer → Vehicle → Product & Cover → Premium → Business Source → Review.
- New shared steps: `wizard/steps/ProductCoverStep.tsx`, `wizard/steps/BusinessSourceStep.tsx` (respects `quotations:select-insurance-channel`).
- Motor > Customers (line-filtered central customers), Motor > Vehicles (reuses existing register page).

### Phase 5 — Fleet
- `fleet/fleet-register.service.ts`: on fleet finalize, projects the quotation into `motor_fleets` / `motor_fleet_items` (idempotent; never re-homes another customer's fleet number; retires removed vehicles). Failure never fails finalize. Manual re-run: `POST :line/quotations/:id/fleet-register`.
- `fleet/fleet-vehicles.service.ts`: per-vehicle read model (cover, premium, cover note / TIRA ref, sticker, policy-risk status). `GET :line/{quotations,policies}/:id/vehicles`.
- Dashboard: active fleets, covered vehicles.
- Fleet wizard `fleet/FleetQuotationWizardPage.tsx`: Customer → Fleet Details → Product & Cover → Vehicles → Premium → Business Source → Review. (Product before Vehicles on purpose: each vehicle is priced as it is captured.)
- `FleetPremiumStep`, `FleetVehiclesPanel`, fleet detail pages; Fleet > Fleets / Vehicles.

### Phase 6 — Non-Motor (built; verification unfinished)
- Migration `1790900000000-NonMotorRiskSchemas.ts`: `product_risk_fields` (per product, optional sub-class) and `quotation_non_motor_details` (one row per quotation: `risk_data`, `schema_snapshot`, `risk_location`, `limit_of_liability`).
- `non-motor/risk-field.types.ts` `validateRiskData()` (draft: types only; finalize: required enforced). Frontend mirror: `non-motor/riskFields.ts` — keep both in step.
- `non-motor/non-motor-risk.service.ts` + `underwrite-non-motor.controller.ts`: risk-schema CRUD (needs `insurance-products:update` + non_motor edit gate), `GET/PUT :line/quotations/:id/risk-details`, `GET :line/quotations/:id/documents`, `GET :line/policies/:id/risk-details`.
- Finalize gate: a Non-Motor finalize through Underwrite fails with `NON_MOTOR_RISK_DETAILS_INCOMPLETE` if required fields are missing.
- Dashboard: policies by insurance class.
- Wizard `non-motor/NonMotorQuotationWizardPage.tsx`: Customer → Insurance Class → Risk Details (dynamic) → Sum Insured & Limits → Add-ons → Premium & Taxes → Business Source → Documents → Review. Risk details are saved through the wizard hooks `afterDraftSaved` / `beforeFinalize`.
- Documents step uploads via the existing document upload sessions (`resource_type: 'QUOTATION'`). Mandatory documents currently **warn only** on Review (open decision below).
- `RiskSchemasPage` (admin with live preview), Non-Motor detail pages, Non-Motor > Risks (reuses subject-matter register), Risk Schemas menu item.

### Phase 7 - Work queues and transaction controls
- Backend line-scoped renewals, endorsements, cancellations, TIRA Failed, and
  TIRA Pending lists.
- Backend line-scoped transaction action endpoints delegate to existing
  policy-transaction services and require both the underwrite line gate and the
  legacy action permission.
- Frontend per-line Renewals, Endorsements, Cancellations, TIRA Failed, and
  TIRA Pending pages.
- TIRA failed rows can retry quotation, endorsement, and cancellation work from
  the line queue.

### Phase 8 - Dashboard and authorization refresh
- Dashboards include renewal, endorsement, cancellation, and TIRA-pending
  counts, scoped to the same data and permissions as the lists.
- The frontend refreshes `/auth/authorization-context` on load, focus,
  visibility return, and a periodic interval so sidebar grants appear without a
  fresh login.
- Focused backend specs cover the endpoint permission matrix, wrong-line 404
  assertions, and branch-scoped dashboard filtering.

### Phase 9 - Regression checklist
- `docs/portal-completion-qa.md` includes Underwrite migration, seed,
  mock-TIRA, wizard, work queue, legacy parity, and portal compatibility
  checks for staging sign-off.

## Remaining phase

1. **Phase 10** - deprecation *plan only* (per-company switch, redirects after sign-off, retire the legacy wizard and the duplicated wizard logic; legacy APIs stay for portals). Needs owner approval before any behavior change.

## Historical pending notes

1. **Finish Phase 6 verification**
   - Run `apps/insurance-portal-web/src/modules/tenant/underwrite/__tests__/nonMotorRisk.test.tsx` and the updated `underwrite.test.ts` (the last run was interrupted; results unknown). Fix what fails.
   - Full suites (run sequentially — see gotchas): backend `npx jest --runInBand` from repo root; web `npx vitest run` in `apps/insurance-portal-web`. Expected: only the 2 known `apps/tiramis` failures.
2. **Phase 7 — separated policies, renewals, endorsements, cancellations, TIRA failures**
   - Backend: line-filtered lists of policy transactions by source-policy line; line-scoped action endpoints delegating to the existing `policy-transactions` services (endorsement create/change/recalculate/complete/approve/payment/submit/retry; cancellation create/complete/approve/submit; renewal offer/send/accept/decline) — gate + legacy permission on each.
   - TIRA Failed / Pending per line: quotations with TIRA FAILED/REJECTED/in progress, policy transactions with submission FAILED/RETRYABLE; retry via existing services (`tira.retry` gate).
   - Issuance follow-ups (additive): set `motor_fleets.policy_id` / `motor_fleet_items.policy_risk_id` for fleet policies; copy Non-Motor risk data into `non_motor_policy_details` / `subject_matter_factor_values`.
   - UI: per line Renewals, Endorsements, Cancellations, TIRA Failed/Pending menu items and pages; reuse legacy `PolicyEndorsementPage` / `PolicyCancellationPage` / `PolicyRenewalPage` behind record gates; fleet per-vehicle endorsements (engine supports `entries.N.motor.*`).
3. **Phase 8** — dashboards gain endorsement/cancellation/renewal/TIRA-pending counts; refresh the sidebar's permissions from `/auth/authorization-context` so new grants show without re-login; permission-matrix tests per endpoint (missing gate → 403, wrong line → 404, branch-scoped user sees only own scope).
4. **Phase 9** — regression: migrations + seed on a staging copy; legacy flows end to end with `mock-tira`; each new wizard draft → issued policy; write a QA checklist like `docs/portal-completion-qa.md`.
5. **Phase 10** — deprecation *plan only* (per-company switch, redirects after sign-off, retire the legacy wizard and the duplicated wizard logic; legacy APIs stay for portals). Needs owner approval before any change.

## Open decisions (ask the owner)

- Should missing mandatory Non-Motor documents block finalize (server-side), or stay a warning?
- Should users holding the new permissions still see the legacy "Underwriting" menu?
- Endorsement listing: legacy uses `endorsements:create` for reads; new screens will use `underwrite.<line>.endorsements.view`.

## Known pre-existing bugs (separate PRs, not in scope)

1. Endorsed/cancelled policies set `regulatory_sync_status='SUCCESS'` but renewal requires `'IN_SYNC'` (`policy-transaction-apply.service.ts:264,707` vs `renewal-eligibility.service.ts:90`).
2. Fleet TIRA callback returns one cover note only; vehicles 2..n get no reference/sticker (`apps/tiramis/.../tiramis-callback.service.ts` ~1008). The Fleet vehicles panel shows them as "Not issued".
3. `QuotationsService.persistMotorVehicle` writes `usage_type = fuel_used`.
4. Unguarded route rendering `TiramisSubmissionDetailPage` (web `App.tsx`, `underwritingPaths.submissionDetail`).
5. Analytics `branch_id` filter not checked against allowed branches.
6. Policy number generation is max+1 (race-prone), in two places.
7. Quotation-level `requires_approval` is hard-coded false.

## Verify commands

```bash
# backend (repo root)
npx tsc --noEmit -p apps/insurance-portal-service/tsconfig.app.json
node --max-old-space-size=4096 ./node_modules/eslint/bin/eslint.js apps/insurance-portal-service/src/modules/tenant/underwrite libs/contracts/src/underwrite
npx jest apps/insurance-portal-service/src/modules/tenant/underwrite libs/contracts/src/underwrite
npx jest --runInBand          # full

# web (apps/insurance-portal-web)
npx tsc -b --noEmit
node --max-old-space-size=4096 ./node_modules/eslint/bin/eslint.js src/modules/tenant/underwrite src/components/layout src/App.tsx
npx vitest run src/modules/tenant/underwrite
npx vitest run                # full

# format
npx prettier --write <changed paths>
```

## Gotchas learned

- **Web compiles with `erasableSyntaxOnly`**: no TS `enum` in anything the web imports (including `libs/contracts`). Use `const` objects + type unions.
- **Vitest forks share one localStorage file**: a test that imports the persisted auth store (`useAuthStore`) — directly or via the wizard hook — corrupts other test files. Keep testable logic in store-free modules (e.g. `wizard/defaults.ts`).
- **Run backend and web suites sequentially**; running them together makes timing-sensitive legacy UI tests fail.
- **`react-refresh/only-export-components`**: a `.tsx` file may export components only; put hooks/constants in `.ts` files (`useNonMotorDocuments.ts`, `lazy-pages.tsx` vs `routes.tsx`).
- **Migrations must be self-contained** (don't import app constants into them, except the exported snapshot pattern already used). TypeORM only loads function exports from migration files, so exporting a constant array is safe.
- **Seed `syncRoles` replaces system-role permissions** — any new permission must be in the seed too, or the next seed run removes it.
- **`DataTable` requires pagination props** — paginate client-side for small in-memory lists.
- **The sidebar reads permissions cached at login**; users must re-login to see new menu items until Phase 8 fixes that.
- On Windows Git Bash, avoid `node -e` with template literals in the command (shell expands `` ` `` / `${}`); edit files directly instead.
