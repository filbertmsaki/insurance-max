# Motor & Fleet Consolidation — Design Report (Phase MF-0)

Status: **APPROVED, in progress** on branch `feat/unified-motor-mf1`.

| Phase | State |
|---|---|
| MF-1 Shell, navigation, combined registers | Built. The feature flag was removed at the user's request; the pilot permission alone gates the module. |
| MF-2 Unified wizard, fleet minimum 2 vehicles (D1, D4) | Built |
| MF-3 Quotation detail in module, Duplicate (D2), premium-change approval reset and invoice void/reissue (D3, D3a) | Built. The tab restructure (separate Approval, Documents and Policy tabs) is deferred; the existing tabs are reused. |
| MF-4 Policy detail in module (stored line decides Single vs Fleet) | Built |
| MF-5 Endorsements, cancellations, renewals in module; Transactions page; fleet "remove vehicles vs cancel policy"; fleet renewal with 1 vehicle becomes Single Motor (D4a) | Built |
| MF-6 Regression | Automated part done: e2e spec `test/underwrite/motor-insurance.e2e-spec.ts` (line gates, pilot gate, company and branch scope, stored-line resolution, multi-line SQL). It found and fixed existing bugs: quotation list search and Customer/Reg No. sorting failed on a real database. User acceptance testing with underwriters is still to do. |
| MF-7 Cutover | Done behind `MOTOR_INSURANCE_CUTOVER` (contracts). Old Motor/Fleet menus are hidden; old quotation, policy and transaction URLs redirect into `/apps/motor`; the pilot permission is no longer required. Rollback: set the switch to `false`. The old code is kept for one release. |
Date: 2026-11-07 · Branch at analysis: `fix/phase0-critical-controls`

Legend used throughout: **[V]** existing and verified · **[P]** partially implemented · **[M]** missing · **[PR]** proposed · **[BC]** requires business confirmation.

Path shorthands: `WEB` = `apps/insurance-portal-web/src`, `UW` = `WEB/modules/tenant/underwrite`, `Q` = `WEB/modules/tenant/quotations`, `SVC` = `apps/insurance-portal-service/src/modules/tenant`, `TIRA` = `apps/tiramis/src/modules`.

---

## 1. Executive summary

The most important finding is that **Motor and Fleet are already one module in everything except navigation and two wizard pages.**

- **Backend [V].** "Line" is only a view over `quotations.quotation_flow` (`MOTOR_SINGLE` / `MOTOR_FLEET`). All Underwrite routes are parameterised `tenant/underwrite/:line/...` (`libs/contracts/src/underwrite/underwrite-line.ts:9-59`). Drafts, finalize, pricing, approval, payment, TIRAMIS submission, issuance, endorsements, cancellations and renewals run through the same services. Fleet-specific code is limited to `SVC/underwrite/fleet/underwrite-fleet.controller.ts`, fleet branches in pricing and TIRAMIS payload builders, and the fleet add/remove-vehicle endorsement services.
- **Frontend [V].** Both lines already share:
  - the route tree `/apps/underwrite/:line/...` (`UW/routes.tsx`);
  - the wizard controller `useUnderwriteQuotationWizard` and the shell `UnderwriteWizardShell`;
  - the quotation detail page (`Q/pages/QuotationDetailPage.tsx`);
  - the policy detail and transaction pages, through `PolicyTransactionScope`.

  The user-visible split comes from three places:
  1. two identical sidebar groups (`UW/nav.ts:60-176`);
  2. two wizard pages, `UW/motor/MotorQuotationWizardPage.tsx` (2 steps) and `UW/fleet/FleetQuotationWizardPage.tsx` (5 steps);
  3. fleet wrappers that inject the vehicles panel (`UW/fleet/FleetDetailPages.tsx`, `UW/transaction-scope.ts:91-93`).

**Recommendation.** Build "Motor Insurance (New)" as a thin **frontend orchestration layer**. It resolves each record's line from `quotation_flow` or `business_line` and then delegates to the existing line-scoped APIs and shared pages.

- Add one new wizard page that hosts both modes, built from the existing step components.
- Make one small, additive, read-only backend change: a combined list endpoint for the registers.
- No entity merges, no pricing, TIRAMIS or issuance rewrites, and no data migration.
- Old menus and routes stay untouched until cutover is explicitly approved.

---

## 2. Existing Motor architecture [V]

| Area | Frontend | Backend / API |
|---|---|---|
| Nav | `UW/nav.ts` MOTOR group: Dashboard, Quotations, Policies, Customers, Renewals, Endorsements, Cancellations, TIRA pending/exceptions, **Vehicles** | — |
| Create/Edit | `UW/motor/MotorQuotationWizardPage.tsx`. Two steps, `details` (one screen: Policyholder, `MotorVehicleSection`, ProductCover, `RiskPremiumStep flow="MOTOR_SINGLE"`, AddOns, BusinessSource) and `review`. `deferDraftUntilStepId:'details'`; `LEGACY_MOTOR_STEP_MAP` L69-79 | `POST/PUT/GET/DELETE tenant/underwrite/motor/quotations/drafts \| :id/draft \| :id/edit`, `POST :id/finalize` (`SVC/underwrite/underwrite-quotations.controller.ts:60-120`) |
| Pricing | `useRiskPremiumCalculation` → `POST /premium-calculation/single` (preview only) | `premium-calculation.service.ts:47`. Authoritative repricing at finalize: `quotations.service.ts:4720` `refreshPricingBeforeSave`, then `assertAuthoritativePricing` :5347 |
| List | `UW/pages/UnderwriteQuotationsPage.tsx` ("Reg No." column, CompanySwitcher header L233) | `GET :line/quotations` (`underwrite.controller.ts:86`), filtered by flow in `underwrite-query.service.ts:49-112` |
| Detail | `Q/pages/QuotationDetailPage.tsx` with tabs Details / Payment / TIRAMIS / History; actions from `GET /tenant/quotations/:id/workflow` `availableCommands` | Legacy `tenant/quotations/*` commands: submit-approval :379, request-payment :399, submit :415, retry :438, cancel :480 |
| Policy | `policies/pages/PolicyDetailPage.tsx` (tab "vehicle") | `:line/policies/:id` |
| Register | `/apps/underwrite/motor/vehicles` | `SVC/motor/motor.controller.ts` |

## 3. Existing Fleet architecture [V]

| Area | Frontend | Backend / API |
|---|---|---|
| Nav | Same children as Motor, plus **Fleets / Vehicles** (`/apps/underwrite/fleet/fleets`) | — |
| Create/Edit | `UW/fleet/FleetQuotationWizardPage.tsx`. Five steps: customer (+ Fleet Type New/Addition, `FleetRiskField`, `FleetAdjustmentsFields`), vehicles (`Q/wizard/steps/MotorFleetDetailsStep.tsx` with CSV import `fleetCsvImport.ts`), premium (`FleetPremiumStep`), source, review. `deferDraftUntilStepId:'premium'`, `allowEarlyManualDraft`; `useFleetVehicleActions` L101-193 | Same draft/finalize endpoints with `:line=fleet`. Finalize also calls `FleetRegisterService.syncFromQuotation`; failures are only logged (`underwrite-quotation-command.service.ts:154-165`) |
| Pricing | `useFleetPremiumCalculation` → `POST /premium-calculation/fleet` | `calculateFleet` :269-337, `buildFleetPremiumTotals` :539. Finalize loops `fleet_dtls[i].risks_covered` (`quotations.service.ts:4796-4830`) |
| Detail | `FleetQuotationDetailPage` = shared page + `FleetVehiclesPanel` + Vehicles tab (`FLEET_DETAIL_TABS`) | `GET fleet/quotations/:id/vehicles` |
| Policy | `FleetPolicyDetailPage` = `FleetVehiclesPanel` + shared page | `GET fleet/policies/:id/vehicles` |
| Endorsement | `PolicyEndorsementPage` offers `FLEET_ADD_VEHICLE` / `FLEET_REMOVE_VEHICLE` only when the scope supplies a `FleetVehiclePanel` (L221-235) | `POST/DELETE fleet/endorsements/:id/vehicles[/:entry[/revert]]` → `fleet-vehicle-endorsement.service.ts` |
| Register | `/apps/underwrite/fleet/fleets` | `motor.controller.ts:141-237` (`motor_fleets`, items, memberships) |

## 4. Motor vs Fleet functional comparison

| Concern | Single Motor | Fleet | Evidence |
|---|---|---|---|
| Identity | `quotation_flow=MOTOR_SINGLE`, `is_fleet=false` | `MOTOR_FLEET`, `is_fleet=true`, `cover_note.fleet_id/fleet_type/fleet_size` | `quotation.entity.ts:150-166`, `quotation-cover-note.entity.ts:107-132` |
| Line immutability | Stored flow must match route line | Same | `assertStoredFlow` :185 (404 on mismatch) |
| Entries | 1 cover-note entry | Entries 1..N, each with `fleet_entry` and its own motor detail | `quotation-cover-note-entry.entity.ts:49,58` |
| FleetId | n/a | Unique for new business only (partial index) | migration `1791100000006` |
| TIRAMIS | `MOTOR_COVER_NOTE_NON_FLEET`, `isFleet 0` | `MOTOR_COVER_NOTE_FLEET`, `FleetHdr` + `FleetDtl[]`, `assertFleetSubmittable` | `TIRA/motor/services/tiramis-motor.service.ts:77-109`, `tiramis-motor-payload.service.ts:83-244` |
| Issuance | 1 policy ↔ 1 cover note | 1 policy ↔ N cover notes (`policy_cover_notes`), per-vehicle stickers on `MotorPolicyDetail` | `issuance.service.ts:284-631` |
| Pricing | Single risk | Per vehicle + fleet totals (TIRA083/084) | see §3 |
| Endorsement | Generic changes | Plus add/remove vehicle (min 2 active, max entry 999), revert, removal refund | `fleet-vehicle-endorsement.constants.ts:2-30` |
| Cancellation | Whole policy | Whole policy (resyncs FleetSize); a single vehicle is removed via the FLEET_REMOVE_VEHICLE endorsement | `policy-transaction-tiramis-payload.service.ts:388-412` |
| Renewal | One quotation | One fleet quotation; off-cover entries dropped | `policy-transaction-context.service.ts:8,189-231` |
| Permissions | `underwrite.motor.*` | `underwrite.fleet.*`; action permissions (`quotations:*`, …) shared | `underwrite-permissions.ts:16-54` |
| Approval/payment gates | Same code path, flow-agnostic | Same | `quotations.service.ts:3250-3275, 4685-4710` |

**Do not infer Fleet from vehicle count.** TIRAMIS accepts a one-vehicle fleet (`tiramis-motor-payload.service.ts:192-194`), and a fleet stays a fleet after removals.

> **Defect found [V]:** `PolicyDetailPage.tsx:124-138` derives `MOTOR_FLEET` from "live vehicle count > 1". A fleet policy shrunk to one vehicle would render as single motor and hide the fleet tab. The unified module must use `policy.business_line` instead (with the fallback in `policy-business-line.sql.ts`).

## 5. Shared vs specialised business logic

- **Shared, reused as-is:** draft lifecycle, finalize, authoritative repricing, approval, payment and invoice, TIRAMIS submit and retry, issuance, the PolicyTransaction framework, data scopes.
- **Specialised, kept intact behind adapters:**
  - fleet header (FleetId, FleetType, adjustments);
  - the fleet vehicle grid and CSV import;
  - fleet pricing aggregation;
  - the fleet register sync;
  - the fleet vehicles panel;
  - fleet add/remove/revert endorsements;
  - the fleet TIRAMIS payload builders.

## 6. Proposed unified architecture [PR]

Options compared:

| Option | Verdict |
|---|---|
| A. New backend "vehicle" line merging MOTOR+FLEET | **Rejected.** It changes permission semantics, the flow assertions and the TIRAMIS branching for no user benefit. |
| B. Merge the two wizard pages into one big conditional component | Risky. `useUnderwriteQuotationWizard` is fixed per line by design (L342: "line is fixed by the route"). |
| **C. Frontend orchestration layer + mode adapters (recommended)** | One shell and one type chooser. After the type is picked, a `MotorModeAdapter` binds the existing hook to `UnderwriteLine.MOTOR` or `FLEET`. Detail, policy and transaction pages are the existing shared pages, rendered with the line resolved from the record. |

```
                Motor Insurance (New)  — /apps/motor/*
 ┌──────────────────────────────────────────────────────────────┐
 │ UnifiedMotorShell (nav tabs, feature gate)                   │
 │  ├─ UnifiedMotorRegister ──► GET underwrite/vehicle-lines/   │  (new, read-only)
 │  │                            quotations | policies          │
 │  ├─ TypeChooser ─► UnifiedMotorWizard                        │
 │  │      mode=single ─► useUnderwriteQuotationWizard(MOTOR)   │
 │  │      mode=fleet  ─► useUnderwriteQuotationWizard(FLEET)   │
 │  │      steps: shared + MotorVehicleSection | MotorFleet...  │
 │  ├─ RecordLineResolver (quotation_flow / business_line)      │
 │  │      └─► QuotationDetailPage line=…  (+FleetVehiclesPanel)│
 │  │      └─► PolicyDetailPage + buildUnderwriteTransaction    │
 │  │          Scope(line)  (endorse / cancel / renew)          │
 └──────────────┬───────────────────────────────────────────────┘
                ▼  existing, unchanged
   tenant/underwrite/{motor|fleet}/…   tenant/quotations/*   premium-calculation/*
   UnderwriteLineGuard ─► DataAccessScopeService ─► quotations / policies / policy-transactions
```

## 7. Temporary navigation and routes [PR]

Minimal menu. "Create" is a button, and endorse/cancel/renew are actions on a policy:

```
Motor Insurance (New)
  Dashboard
  Quotations          [+ New Motor Quotation] button
  Policies            policy actions: Endorse · Cancel · Renew
  Policy Transactions tabs: Endorsements | Cancellations | Renewals | TIRA queue
  Vehicles & Fleets   tabs: Vehicles | Fleets
```

Seven items become five, against the 2 × 10 entries today. Customers stays in the existing Customers area. TIRA pending and exceptions become a tab with a badge count.

**Routes:** a new prefix `/apps/motor/...` that does not collide with `/apps/underwrite/:line`.

| Purpose | Path |
|---|---|
| Lists | `/apps/motor`, `/apps/motor/quotations`, `/apps/motor/policies`, `/apps/motor/transactions?tab=` |
| Wizard | `/apps/motor/quotations/new?type=single\|fleet`, `/apps/motor/quotations/:id/edit` |
| Records | `/apps/motor/quotations/:id`, `/apps/motor/policies/:id` |
| Policy transactions | `/apps/motor/policies/:pid/endorsements/new\|:eid`, `.../cancellations/new\|:cid`, `.../renewals/:rid` |

The `:id` routes resolve the line from the record. Old `/apps/underwrite/motor|fleet/*` deep links stay unchanged.

**Feature gate.** No feature-flag mechanism exists today [V].
- [PR] A build or env flag `VITE_FEATURE_UNIFIED_MOTOR` hides the module entirely.
- [PR] A new permission `underwrite.motor-unified.preview` decides which pilot users see the menu. It is seeded but granted to no role by default, and it only reveals navigation. Every data call still goes through the existing `underwrite.motor.*` / `underwrite.fleet.*` gates and data scopes, so the preview permission grants no data access.
- **Rollback:** revoke the permission or turn off the flag. No data is created in a new shape, so nothing needs reverting.

## 8. Unified quotation wizard [PR]

**The type is chosen first** (before the Customer step):
- it decides which line endpoint creates the draft;
- the stored flow is immutable (`assertStoredFlow`);
- Fleet changes the Customer step itself (Fleet Type New/Addition, Fleet risk).

It is a two-card chooser (reusing the `QuotationStartModal` pattern):
- each card is enabled only if the user holds `underwrite.<line>.create` + `quotations:create`;
- the type can be changed freely **until the first draft save**, and after that it is locked and shown as a badge.

| Step | Single Motor | Fleet Motor | Reused |
|---|---|---|---|
| 0 Type | card | card | new `QuotationTypeChooser` |
| 1 Customer & Cover | Policyholder, product, cover dates, currency | + Fleet Type, Fleet risk, adjustments | `PolicyholderStep`, `ProductCoverStep`, `CoverNoteSetupStep`, `FleetRiskField`, `FleetAdjustmentsFields` |
| 2 Vehicles | one vehicle form (TIRA lookup / register) | vehicle table: add, edit (drawer using the same vehicle fields), remove, duplicate, CSV import, per-vehicle status and premium | `MotorVehicleSection`, `VehicleDetailsFields`, `MotorFleetDetailsStep`, `useFleetVehicleActions`, `fleetCsvImport` |
| 3 Premium & Source | `RiskPremiumStep flow=MOTOR_SINGLE`, AddOns | `FleetPremiumStep` (per vehicle + totals) | `BusinessSourceStep` both |
| 4 Review & Finalize | summary, payment method, validation list | + fleet summary table | `SummaryReviewStep` |

- Company, branch, sales point and officer are derived on the server today [V]; the wizard does not add choosers for them.
- Business source follows the existing `quotations:select-insurance-channel` gate.
- All premiums shown come from the server endpoints, and finalize reprices authoritatively; the frontend does no pricing maths.
- Draft points stay as they are per mode (single at step 2, fleet at step 3 or manual).

**[BC]** `docs/motor-quotation-wizard-review.md` deliberately collapsed Single Motor into one screen. The unified wizard either:
- (a) keeps a compact Single layout (steps 1–3 on one page with section anchors), or
- (b) uses the same four steps for both.

Recommendation: (a). The shell shows steps 1–3 as sections for Single and as separate steps for Fleet.

## 9. Unified quotation CRUD [PR]

- **Create:** the wizard above.
- **Read:** one register. Columns:
  - Quotation No.
  - Customer
  - Type (badge)
  - Product
  - Vehicles (count)
  - Reg No. / Fleet ID
  - Branch
  - Premium
  - Status
  - Approval
  - Payment
  - TIRA
  - Created
  - Actions

  Filters: type, status, branch, product, dates.
- **Update:** `/apps/motor/quotations/:id/edit` resolves the line and opens the wizard in that mode. Editability uses the existing `canEditQuotation` (`Q/utils/quotation-editability.ts`) together with the server's `isQuotationEditable` (`quotations.service.ts:9908`).
- **Delete:** only the existing soft "Delete draft" (`assertDraftDeletionAllowed` :3295: untouched DRAFT only, audited).
- **Cancel:** the existing `cancelQuotation` (refused once TIRA has been submitted). Policies are never deleted.
- **Actions:** rendered from `availableCommands` (`GET /tenant/quotations/:id/workflow`) plus permissions, so no new commands are needed.
- **Gaps:**
  - **Duplicate quotation [M]:** there is no endpoint. Defer, or add `POST :line/quotations/:id/duplicate` reusing the internal `cloneDraftPayload` :2837 **[BC]**.
  - **Approval invalidation on edit [M/BC]:** editing a quotation that is pending approval does not reset its approval (`replace` :860-1040). This is a pre-existing control gap; it needs a decision independent of this UI work.

## 10. Unified quotation details and editing [PR]

Reuse `QuotationDetailPage` as-is.
- **Header:** `QuotationDetailHeader` + Type badge.
- **Tabs:** Overview · Vehicles · Premium · Approval · Payment · TIRAMIS · Documents · History · Policy.
- **Vehicles tab:** one vehicle card for Single, `FleetVehiclesPanel` for Fleet (already the case through `FLEET_DETAIL_TABS`).

The unified route only needs a `RecordLineResolver`:
1. fetch the quotation;
2. map its flow to a line (`underwriteLineFromQuotationFlow`);
3. render the page with `line` and the fleet panel when applicable.

Approval, Documents and Policy as separate tabs are a [PR] restructuring of existing content (approval history is currently inside Details/History).

## 11. Unified policy register and details [PR]

- **Register:** a combined list with filters by type, customer, policy no., branch, product, status and cover period.
- **Details:** `PolicyDetailPage` wrapped in `buildUnderwriteTransactionScope(line)`, with `FleetVehiclesPanel` (vehicles, per-vehicle cover note and sticker) for fleet.
  - The line comes from `business_line` (this fixes the §4 defect inside the new module only).
  - Tabs: Overview · Vehicles · Premium · Cover notes · Documents · Transactions (endorsements, cancellations, renewals) · History.
- No change to the issuance model (1 policy : N cover notes).

## 12. Unified endorsement design [PR]

Entry point: Policy → **Endorse policy** → `/apps/motor/policies/:pid/endorsements/new`, reusing `PolicyEndorsementPage` under the line-scoped transaction scope. Because the scope injects `FleetVehiclePanel` for fleet lines, the existing behaviour carries over automatically:
- the fleet types (`FLEET_ADD_VEHICLE` / `FLEET_REMOVE_VEHICLE`);
- add, remove and revert vehicle;
- the minimum of 2 active vehicles;
- removal refunds;
- per-vehicle repricing;
- the TIRAMIS payloads (FleetType 2 additions under the issued FleetId; EndorsementType 2 removals).

The steps are: type → changes → premium review → approval → payment → TIRAMIS → resulting policy version. All of these already exist through `underwrite-transactions.controller.ts:156-447`. Nothing is simplified.

## 13. Cancellation and renewal [PR]

- **Cancellation:** `PolicyCancellationPage` under the scope. It cancels the whole policy for both types [V].
  - Partial fleet cancellation **is** the FLEET_REMOVE_VEHICLE endorsement [V]. The unified UI makes this explicit: on a fleet policy, "Cancel" offers "Remove vehicles (endorsement)" vs "Cancel whole policy".
- **Renewal:** `PolicyRenewalPage`. A fleet renews as one fleet quotation without off-cover entries [V]. The renewal quotation opens in the unified wizard in fleet mode.

## 14. RBAC and data scope [PR]

- **Unchanged:** every call still passes through `UnderwriteLineGuard` (`underwrite.<line>.<action>`), the legacy action permissions, and `DataAccessScopeService` (company / branch / department / own, `data-access-scope.service.ts:17-257`).
- **Combined list endpoint:**
  - It must include a flow **only if** the user holds that line's VIEW gate, then apply `applyQuotationReadScope` / `applyPolicyReadScope`.
  - A user with Motor-only rights must never see fleet rows. Contract tests prove this.
- **Frontend actions:** permissions ∩ `availableCommands` (lifecycle state). Hidden buttons are UX only; the backend remains the control.
- **Maker-checker / approval authority:** unchanged (approve endpoints and APPROVE gates).

## 15. Wireframes (low-fi)

```
Register (desktop)                                   Mobile: cards, type badge + status
┌ Motor Insurance ─ Quotations ─────────── [+ New Motor Quotation] ┐
│ [Type ▾][Status ▾][Branch ▾][Date ▾]  search…                    │
│ No.      Customer   Type    Veh  Reg/Fleet  Premium  Status  TIRA│
│ Q-1021   ACME Ltd   Fleet   14   FLT-88     12.4M    Approved ✓  │
│ Q-1022   J. Mushi   Single  1    T123ABC    480K     Draft   –   │
└──────────────────────────────────────────────────────────────────┘

Type chooser                        Fleet vehicles step
┌ New motor quotation ──────────┐   ┌ Vehicles (14) [+Add][Import CSV] ┐
│ ( ) Single vehicle            │   │ # Reg     Make   Cover  Premium ✓ │
│     One car, one cover note   │   │ 1 T1..    Toyota Comp   820K    ✓ │
│ ( ) Fleet                     │   │ 2 T2..    Isuzu  TPO    —       ! │
│     Several vehicles, FleetId │   │           Fleet total:  12.4M     │
│               [Continue]      │   └ row click → side drawer form ─────┘
└───────────────────────────────┘
Detail: Header(No · Customer · [Fleet] · Status · Premium · primary action)
        Tabs: Overview | Vehicles | Premium | Approval | Payment | TIRAMIS | Documents | History | Policy
```

Component hierarchy:

```
UnifiedMotorShell
├─ QuotationTypeChooser
├─ UnifiedMotorWizard
│  └─ UnderwriteWizardShell
│     └─ steps by mode
├─ UnifiedMotorRegister
│  └─ DataTable
├─ RecordLineResolver
│  └─ QuotationDetailPage | PolicyDetailPage
└─ TransactionsTabs
   └─ UnderwriteTransactionsPage
```

Built with the existing `components/ui` and `components/shared` (DataTable, StatusBadge, PremiumBreakdown, ActivityTimeline, PageHeader).

## 16. Component reuse matrix

| Need | Reuse | New |
|---|---|---|
| Wizard state/autosave/finalize | `UW/wizard/useUnderwriteQuotationWizard.ts`, `UnderwriteWizardShell.tsx` | `UnifiedMotorWizard.tsx` (mode → step list) |
| Customer/cover | `PolicyholderStep`, `ProductCoverStep`, `CoverNoteSetupStep` | — |
| Single vehicle | `UW/motor/MotorVehicleSection`, `VehicleDetailsFields`, `VehicleLookup` | — |
| Fleet vehicles | `MotorFleetDetailsStep`, `useFleetVehicleActions`, `fleetCsvImport` | responsive table/drawer wrapper |
| Premium | `RiskPremiumStep`, `FleetPremiumStep`, `AddOnsStep`, `BusinessSourceStep` | — |
| Review | `SummaryReviewStep` | — |
| Detail | `QuotationDetailPage`, `FleetVehiclesPanel` | `RecordLineResolver.tsx` |
| Policy/transactions | `PolicyDetailPage`, `PolicyEndorsementPage`, `PolicyCancellationPage`, `PolicyRenewalPage`, `buildUnderwriteTransactionScope` | — |
| Lists | `UnderwriteQuotationsPage` columns, `UnderwriteTransactionsPage`, `DataTable` | `UnifiedMotorRegister.tsx` |
| Nav | `nav-config.ts` `NavLeaf` gating | `UW/unified/nav.ts` |

## 17. Backend and API compatibility

- **No existing endpoint changes.** All writes use the existing `motor` / `fleet` line endpoints.
- **One additive read endpoint [PR]:** `GET tenant/underwrite/vehicle-lines/{quotations|policies}`.
  - It reuses `underwrite-query.service.ts` with `quotation_flow IN (...)` / `business_line IN (...)`, restricted to the lines the user may VIEW, then data-scoped.
  - Each row returns its `line` so the client can route.
  - Alternative with no backend change: two parallel calls merged on the client. That breaks server pagination and sorting, so it is acceptable for the MF-1 pilot only.
- **Optional, [BC]:** a duplicate endpoint (§9).
- **Not touched:** TIRAMIS formats, pricing, issuance, PolicyTransaction.

## 18. Feature parity and regression matrix

| Feature | Motor | Fleet | Unified | Reused | Gap | Required test |
|---|---|---|---|---|---|---|
| Create quotation | [V] | [V] | chooser + wizard | wizard hook | — | E2E both modes produce the same draft payload as the old pages (snapshot diff of `PUT :id/draft` body) |
| Draft save/autosave | [V] | [V] incl. manual early draft | same per mode | hook | — | draft created at the same step; reload resumes |
| Edit / editability | [V] | [V] | resolver → mode | `canEditQuotation` | approval not reset on edit [M] | locked states refuse edit (UI + 4xx) |
| Vehicle validation | [V] | [V] per vehicle | same | `motorFields`, fleet step | TIRA-required fields per wizard review P9 | invalid vehicle blocks finalize |
| Fleet header / FleetId | n/a | [V] | fleet mode | fleet fields | — | FleetId uniqueness error surfaced |
| CSV import | n/a | [V] | fleet mode | `fleetCsvImport` | — | import same file → same entries |
| Premium / discounts / tax | [V] | [V] + totals | same | pricing endpoints | — | finalize totals equal old flow for fixtures |
| Approval | [V] | [V] | detail actions | workflow API | — | maker ≠ checker; approve/reject/request-changes |
| Finance | [V] | [V] | Payment tab | `QuotationPaymentTab` | — | request payment → invoice reused; paid unlocks submit |
| TIRAMIS | [V] | [V] | TIRAMIS tab | submit/retry | — | payload byte-equal vs old flow (mock-tira) |
| Cover notes | 1 | N | Vehicles/Cover notes | `FleetVehiclesPanel` | — | N cover notes linked to one policy |
| Policy issuance | [V] | [V] | Policy tab | issuance | — | one policy per revision |
| Endorsement | [V] | [V] + add/remove/revert | scope-driven | `PolicyEndorsementPage` | — | fleet types visible only for fleet; min-2 rule |
| Cancellation | [V] whole | [V] whole | + "remove vehicles" hint | cancellation page | — | FleetSize resync payload |
| Renewal | [V] | [V] | wizard in mode | renewal factory | — | off-cover entries dropped |
| Documents | [V] | [V] | Documents tab | motor schedule renderer | — | schedule downloads for both |
| Reporting/dashboard | [V] per line | [V] per line | combined dashboard [PR] | `:line/dashboard` | combined KPIs [M] | totals = motor + fleet |
| Data scopes | [V] | [V] | combined list | data-scope service | new endpoint | Motor-only user sees no fleet rows; branch user sees only own branches |
| Audit | [V] | [V] | History tab | ActivityTimeline | — | events identical to old flow |
| Duplicate | [M] | [M] | [BC] | `cloneDraftPayload` | endpoint | — |
| Single-vehicle fleet display | — | [P] defect | `business_line` | — | §4 | fleet with 1 vehicle still shows as Fleet |

**Fleet-unique features that must stay:**
- FleetId and Fleet Type (New/Addition)
- fleet adjustments
- CSV import
- per-vehicle pricing and totals
- fleet register sync
- per-vehicle cover notes and stickers
- add/remove/revert vehicle endorsements
- removal refunds
- the minimum-active-vehicle rule
- fleet renewal filtering

**Parity method:** run old and new UIs against the same fixtures. Assert equality of the backend artefacts: the draft payloads, the finalized pricing snapshot, the TIRAMIS request body (mock-tira) and the issued policy and cover notes. Visual similarity does not count as parity.

## 19. Migration and rollback

1. MF-1 to MF-5 ship behind the flag plus the preview permission; old menus stay untouched.
2. Pilot users exercise both UIs side by side, and the parity suite runs in CI.
3. MF-7 cutover (only after approval):
   - point the sidebar at `/apps/motor`;
   - redirect `/apps/underwrite/motor|fleet/quotations|policies...` to the unified routes (detail ids are the same records);
   - keep the old route code for one release.
4. **Rollback at any point:** turn off the flag, revoke the permission, or revert the nav commit. No data shape changes, so no data rollback is needed.

## 20. Phased roadmap

| Phase | Objective | Files reused | New files | Backend | DB | Acceptance / tests | Rollback |
|---|---|---|---|---|---|---|---|
| MF-1 Shell & nav | Gated menu, routes, combined registers, resolver | `nav-config.ts`, `UW/routes.tsx` (add only), `UnderwriteQuotationsPage`, `QuotationDetailPage`, `PolicyDetailPage` | `UW/unified/{nav.ts,routes.tsx,UnifiedMotorShell.tsx,UnifiedMotorRegister.tsx,RecordLineResolver.tsx}` | combined list endpoint + scope tests | permission seed only | old menus unchanged; scope contract tests; deep links work | flag off |
| MF-2 Wizard | Chooser + both modes | wizard hook, shell, all steps | `QuotationTypeChooser.tsx`, `UnifiedMotorWizard.tsx` | none | none | payload-equality E2E for single and fleet; CSV import | flag off |
| MF-3 Register/detail | Tab restructure, type badges, edit via resolver | detail components | small tab wrappers | none | none | action availability = workflow commands | flag off |
| MF-4 Policies | Unified policy list/detail, `business_line` fix (new module only) | `PolicyDetailPage`, `FleetVehiclesPanel` | policy wrapper | none | none | 1-vehicle fleet shows Fleet | flag off |
| MF-5 Transactions | Endorse/cancel/renew via scope; transactions tabs | policy transaction pages, `buildUnderwriteTransactionScope` | `TransactionsTabs.tsx` | none | none | fleet add/remove/revert E2E; TIRAMIS payload equality | flag off |
| MF-6 Regression/UAT | Full parity + authorization suites | existing e2e helpers (`test/`) | parity specs | — | — | sign-off per matrix row | — |
| MF-7 Cutover | Swap nav, add redirects | — | redirects | none | none | explicit approval | revert nav commit |

## 21. Business decisions

### Decided (2026-11-07)

| # | Decision | Design impact | Phase |
|---|---|---|---|
| D1 | **Single Motor keeps its compact one-page layout.** | `UnifiedMotorWizard` renders steps 1–3 as sections on one page in single mode, and as separate steps in fleet mode. | MF-2 |
| D2 | **Add a Duplicate quotation endpoint.** | `POST tenant/underwrite/:line/quotations/:id/duplicate`. Guard: `quotations:create` + `underwrite.<line>.create` + read scope on the source. It reuses `cloneDraftPayload` (`quotations.service.ts:2837`). Result: a new DRAFT on the same line with a new number. Cleared on the copy: approval, payment, invoice, TIRA, cover-note numbers, `fleet_id` (a new FleetId is required because of the uniqueness index) and `source_policy_transaction_id`. The copy is repriced on save. Audit event `quotation.duplicated`. | MF-3 |
| D3 | **Editing a quotation resets its approval only if the premium changes.** | In `replace` (`quotations.service.ts:860-1040`), after authoritative repricing, compare the new authoritative gross premium (fleet: grand total) with the previously stored value. If it differs and the approval status is PENDING or APPROVED, set the approval back to NOT_SUBMITTED, record the event `quotation.approval.reset_on_premium_change` (old and new premium), and require resubmission. Edits that leave the premium unchanged keep the approval. If payment was already requested, the reset also voids or blocks the invoice **[BC: confirm voiding]**. Applies to both lines and to the old UI as well, because it is a backend control. | MF-3 (backend) |
| D4 | **A fleet quotation must have at least 2 vehicles.** | Server validation in `quotations.service.ts` for `MOTOR_FLEET` (save past the vehicles step and finalize), reusing `FLEET_MINIMUM_ACTIVE_VEHICLES = 2`. Mirrored in the wizard so Continue/Finalize are disabled with a clear message. Renewals must keep at least 2 on-cover vehicles. **[BC]** What should happen when a fleet renewal has fewer than 2 on-cover vehicles: block it, or offer to convert it to single motor? | MF-2 |

The §4 note that TIRAMIS accepts a one-vehicle fleet still holds for legacy and endorsed records. New business is now limited to 2 or more vehicles.

### Still open

1. Combined dashboard KPIs: which metrics?
2. Should Customers live inside the motor module or remain global?
3. Who are the pilot users, and what are the exit criteria for cutover?
4. Should the fleet register sync failure (currently only logged) be surfaced to users?
### Decided follow-ups (2026-11-07)

| # | Decision | Design impact |
|---|---|---|
| D3a | **Premium changes after payment was requested:** the existing invoice is voided and a new invoice is created. | Inside the D3 reset, the open quotation invoice is voided through the existing billing service, with the reason "premium changed". The payment state is reset so the quotation goes back to approval, and the next `requestPayment` creates a new invoice instead of reusing the old one (`createOrReuseQuotationPaymentInvoice` :9926 must skip voided invoices). If payment has already been **received** against the invoice, the edit is refused with a clear message: a paid invoice cannot be silently voided, and refund or adjustment stays a Finance process. Audit and finance events are recorded for the void. |
| D4a | **A fleet renewal with fewer than 2 on-cover vehicles converts to a single motor renewal quotation.** | In `renewal-quotation-factory.service.ts` / `policy-transaction-context.service.ts`, after dropping the off-cover entries: if exactly 1 vehicle remains, build a `MOTOR_SINGLE` draft (`is_fleet=false`, no `fleet_hdr`/`fleet_id`, one entry) and link it to the renewal. If 0 remain, refuse the renewal. The renewal record shows "Converted from Fleet <FleetId>". The unified UI opens it in single mode. Verify TIRAMIS accepts a non-fleet cover note for a vehicle that was previously on a fleet (mock-tira test). |

## 22. Recommended first phase

**MF-1.** Add the gated "Motor Insurance (New)" shell, the combined quotation and policy registers (with the additive scoped list endpoint and its authorization tests), and the `RecordLineResolver`, which opens the existing detail pages.

It is low risk and fully reversible, it touches no write paths, and it proves the data-scope design before any wizard work starts.
