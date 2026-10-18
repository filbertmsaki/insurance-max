# Motor Quotation Wizard — Review and Simplification Plan

Status: **implemented** on branch `feat/motor-wizard-simplification` (2026-10-18), not yet merged. Decisions are in section 9; what changed and the test results are in section 11.

Scope: the active Motor wizard at `/underwrite/motor/quotations/new` and `/:id/edit`
(`apps/insurance-portal-web/src/modules/tenant/underwrite/motor/MotorQuotationWizardPage.tsx`).
The legacy `quotations/pages/QuotationWizardPage.tsx` is no longer routed and is out of scope.
Fleet and Non-Motor share the same controller (`useUnderwriteQuotationWizard`) and must keep working unchanged.

---

## 1. Current wizard

### 1.1 Steps and fields

The wizard has four steps. All steps stay mounted and are hidden with `hidden` (`UnderwriteWizardShell.tsx`), so form state survives navigation.

| # | Step | Visible controls (direct-channel user) | Notes |
|---|---|---|---|
| 1 | Product & Cover | Product\*, Risk\*, Currency (read-only), Date range\* (30/60/90/365 days), Cover starts\*, Cover ends (read-only), Cover wording (collapsed: 2 text areas) | `ProductCoverStep` + `CoverNoteSetupStep` |
| 2 | Customer & Vehicle | Existing/New toggle, Customer combobox\*; TIRA lookup: Motor category, Search by, Identifier, Fetch; "Use a saved vehicle" select; Sum insured (if the risk needs it); **22 vehicle fields (17 required)** | `PolicyholderStep` + `MotorDetailsStep` + `VehicleDetailsFields` |
| 3 | Premium & Business Source | Discount type, Tax, Exempted (+ exemption type/reference), risk-specific rating factors, Add add-on (dialog); Channel / Intermediary / Commission only with `quotations:select-insurance-channel` | `RiskPremiumStep` + `AddOnsStep` + `BusinessSourceStep` |
| 4 | Review & Submit | Payment method\* (Cash/Cheque/EFT), summary, "Edit cover details" | `SummaryReviewStep` |

The new-customer dialog adds 14 more fields: type, full name, date of birth, gender, ID type, ID number, phone, email, fax, country, region, district, street and postal address.

### 1.2 Data flow

- **Draft.** The first draft is saved when leaving step 3 (`deferDraftUntilStepId: 'premium-source'`). The **quotation number is generated at that first draft save**. Each later step change autosaves silently.
- **Finalize.** `POST /tenant/underwrite/motor/quotations/:id/finalize` does the following:
  - re-prices every motor risk on the server (`refreshPricingBeforeSave`, `assertAuthoritativePricing`), so the browser's figures are only a preview;
  - resolves the customer from `policy_holders[0]` (ID type + ID number, then ID number, then phone);
  - upserts `motor_vehicles` and the insured asset.
- **TIRA.** TIRA submission is a separate, later call (`POST /tenant/quotations/:id/submit`). The policy is issued on TIRA's success callback.
- **Server-derived values.** Sale point, branch, officer name/title, cover note type, default tax and category are all derived on the server. The wizard never asks for them.

### 1.3 Problems found

**Search and selection**

| # | Finding | Evidence |
|---|---|---|
| P1 | Customer search filters in the browser over the **500 newest customers** (`GET /tenant/customers?limit=500`, full rows). Older customers cannot be selected. | `quotations/hooks.ts` `useQuotationCustomers` |
| P2 | The customer combobox only matches the label text. The `keywords` (email, TIN, registration, customer no.) are dropped because `ComboboxOption` has no such field, so the placeholder promises more than the search does. | `PolicyholderStep.tsx:319-337`, `components/ui/combobox.tsx` |
| P3 | The backend customer search uses unescaped ILIKE, so `%` and `_` act as wildcards. It has no phone normalisation (`0712 345 678` ≠ `0712345678` ≠ `+255712345678`) and no full-name match for customers created from quotations, whose `display_name` is NULL. There are no search indexes. | `customers.service.ts` `findAllForUser` |
| P4 | Vehicle lookup needs **two selections** (motor category, "search by") plus a Fetch click. It only queries TIRA, never the local register. The local "saved vehicle" list covers only the selected customer's vehicles (up to 500). | `VehicleLookup.tsx`, `MotorDetailsStep.tsx` |
| P5 | Vehicles created through quotations never fill `registration_no_normalized` / `chassis_no_normalized`. Normalised matching (manual create, fleet apply, portal lookups) misses them. | `quotations.service.ts` `persistMotorVehicle` |
| P6 | `persistMotorVehicle` matches the raw `UPPER(TRIM())` value **within one customer**. `T 123 ABC` and `T123ABC` count as different vehicles, so a duplicate row can be created. A plate held by another customer fails at finalize with a database constraint message. | `quotations.service.ts:8554-8649` |

**Field behaviour**

| # | Finding | Evidence |
|---|---|---|
| P7 | All 22 vehicle fields stay on screen even after a TIRA or register fill. Nothing tells the user which fields are actually missing. | `VehicleDetailsFields.tsx` |
| P8 | Registration shows a required asterisk for in-transit vehicles, but validation correctly treats it as optional. | `VehicleDetailsFields.tsx:28` vs `motorFields.ts:127` |
| P9 | **Seats, Vehicle usage and Owner address are optional in the portal but required by the TIRAMIS gateway.** A quotation can finalize and then fail at submit with "Motor payload validation failed". | `motorFields.ts` vs `apps/tiramis/.../tiramis-motor.service.ts` (`requirePositiveNumber(sittingCapacity)`, `requireNumberIn(motorUsage,[1,2])`, `requireString(ownerAddress)`) |
| P10 | "Auto-select the only product" never runs for Motor. The effect lives in `CoverNoteSetupStep`, which Motor only mounts *after* a product is picked. | `ProductCoverStep.tsx:159-172`, `CoverNoteSetupStep.tsx:76-92` |

**Performance and wiring**

| # | Finding | Evidence |
|---|---|---|
| P11 | **Every pricing input change sends two premium calculations.** `useRiskPremiumCalculation(form, 0)` is mounted twice for the same risk: once in `MotorDetailsStep` (for sum insured) and once in `RiskRow`. Mutations are not de-duplicated. | `MotorDetailsStep.tsx:55`, `RiskRow.tsx:96` |
| P12 | The Motor wizard loads every Non-Motor subject matter (`limit=500`) and never uses them. | `useUnderwriteQuotationWizard.ts:228` |
| P13 | The "drop business source step for direct-only users" filter looks for step id `source`, but the Motor step id is `premium-source`. Direct-only users still get a step labelled "Business Source". | `useUnderwriteQuotationWizard.ts:139-145` |
| P14 | The wizard needs the **full** customer record from the 500-row list to build the policyholder payload (`buildPolicyHolderPayload(existingCustomer)`). If the customer is not in that list, the payload silently falls back to empty form fields. | `useUnderwriteQuotationWizard.ts:237`, `schemas.ts:1125` |

---

## 2. Proposed wizard: two steps

### Step 1 — Quote details (one screen with four sections)

**A. Customer**

- One search box: "Search customer by name, phone or ID number". It is server-side, debounced at 300 ms and cancellable, and supports keyboard navigation.
- Each result row shows the name, customer no., phone, masked ID (`NIDA ••••1234`) and type.
- Selecting a result loads the full record through the existing `GET /tenant/customers/:id` and shows the existing compact customer card with *Change* and *Edit*.
- If the record is missing TIRA-required policyholder data (date of birth, ID, region/district, gender for individuals), a "Complete missing details" prompt opens the existing edit dialog.
- "+ Create new customer" opens the existing policyholder dialog. On save, the customer is selected without leaving the wizard. Creation timing is **decision D1** (section 9).

**B. Vehicle**

- One search box: "Search vehicle by registration or chassis number". It searches the local register first, ignoring spaces, hyphens and case.
- Each result shows `T 123 ABC — Toyota Land Cruiser · Chassis JTE••••1234 · 2022 · Registered`.
- A footer action, "Look up `T123ABC` with TIRA", reuses the existing verification:
  - registration is tried first, then chassis (the same fallback the fleet bulk lookup already uses);
  - motor category is inferred (`MC…` → motorcycle) and can be overridden.
- After a vehicle is selected, a compact vehicle card is shown. **Only fields that fail validation are displayed**, plus *Edit all details*.
- Owner name, type and address default from the policyholder when empty (owner = policyholder is the common case). The user can still overwrite them.
- "Enter vehicle manually" opens the full existing field set, including the Registered / In transit choice. Registration is optional for in-transit vehicles.

**C. Cover** — responsive grid: 4 columns at `xl`, 2 at `sm`, 1 on phones.

- **Product and risk.** Product is picked automatically when only one is valid (fixes P10). Risk is picked automatically when only one is valid (existing).
- **Sum insured.** Shown only when the selected risk requires it.
- **Cover period.** Duration (default 1 year), Start (default today); End is calculated.
- **Payment method.** Moved here from Review because it feeds the `payment_mode` pricing factor. Changing it on Review could invalidate the price.
- **Adjustments.** A collapsed row, e.g. "No discount · VAT 18% applied · Change". It holds Discount type, Tax and Exemption.
- **Rating factors.** Risk-specific factors appear only when the risk declares them (existing logic).
- **Add-ons.** "+ Add optional cover" is shown only when the product has add-on definitions.
- **Cover wording.** Stays collapsed (existing).

**D. Business source** — rendered only for users with `quotations:select-insurance-channel` (existing rule). Intermediary and commission appear only for non-direct channels.

### Step 2 — Review & submit

- **Summary.** Customer, vehicle, product/risk, period and sum insured, each with *Edit*. Edit returns to step 1 and scrolls to that section; nothing is lost because the steps stay mounted.
- **Premium breakdown.** Premium, discount, premium excl. tax, taxes, add-ons and total payable.
- **Pricing status.** The existing "waiting for current premiums" notice, with a Recalculate action when pricing is stale.
- **Footer.** Back, Save draft, Create/Complete quotation. These are the same mutations and the same server-side validation and repricing as today.

**Persistence**

- The first draft (and with it the quotation number) is created when the user leaves step 1. That is the same point of data completeness as today's "leave step 3".
- Drafts saved with old step IDs map to the new ones:

  | Old step ID(s) | New step |
  |---|---|
  | `product-cover`, `customer-vehicle`, `premium-source`, `customer`, `vehicle`, `cover`, `premium`, `source` | `details` |
  | `review-submit`, `review` | `review` |

---

## 3. Field optimisation matrix

Legend:

- **M** — mandatory user input or confirmation
- **A** — automatic (from a record or configuration)
- **C** — conditional (shown only when relevant)
- **O** — optional, behind progressive disclosure
- **Calc** — calculated by the backend
- **H** — hidden technical value

| Field | Today | Proposed | Source when automatic |
|---|---|---|---|
| Customer | M (client-side combobox) | **M** (server search) | — |
| Policyholder details (14) | C (new customer) | C (new customer, or missing data only) | Customer record |
| Product | M | **A** if one valid, else M | Product list for the user's access |
| Category | A | A | Product |
| Risk | M (A if one) | A if one, else M | Product risks |
| Currency | read-only input | **H** (shown in summary) | Default TZS (as today) |
| Exchange rate | C (non-TZS) | C | — |
| Cover duration / start | M (defaults) | M (defaults) | 1 year / today |
| Cover end | read-only | Calc | Start + duration |
| Cover wording (2) | A, editable | A, editable (collapsed) | Generated from product and period |
| Cover note type, previous reference, endorsement | H / C | H / C | Server (product version) |
| Payment method | M (Review step) | M (Cover section, default Cash) | — |
| Vehicle search | 3 controls + Fetch | **1 control** | — |
| Vehicle fields (22) | always visible | **C** (missing only) / manual entry | Register or TIRA |
| Motor category / type | M (selects) | A (register/TIRA/inferred), C when manual | — |
| Owner name / type / address | M | A from policyholder when empty | Customer record |
| Sum insured | C | C | Risk required factors |
| Risk rating factors | C | C | Risk required factors |
| Discount type | always visible | **O** | — |
| Tax / exemption (2–4) | always visible | **O** (default tax applied) | Default tax |
| Add-ons | always offered | C (product has add-ons) | Product add-on definitions |
| Channel / intermediary / commission | C (permission) | C (permission) | Default DIRECT |
| Branch, sale point, officer, insurer | H | H | Server |
| Premium figures, totals, pricing quote id | Calc / H | Calc / H | Pricing engine (re-priced at finalize) |

No field is removed from the payload. Every value that is hidden or automatic is still written to the same form path, so `buildQuotationPayload` and `buildQuotationDraftPayload` produce the same payload for the same data.

---

## 4. Customer search design

**Endpoint.** `GET /api/v1/tenant/customers/search?q=<term>&limit=20&page=1`

- Same controller, `@TenantScoped()`, `customers:read`.
- Declared before `/:id` in the controller.
- `limit` ≤ 50. The service fetches `limit + 1` rows to return `hasMore`, so it avoids the `COUNT(*)` that the list endpoint runs on every keystroke.

**Query parsing** (pure helper, unit-tested)

- The term is trimmed and split into tokens. Every token must match (AND), so "John Mwita" finds "John Michael Mwita".
- LIKE wildcards are escaped with the existing `escapeLike` helper.
- A phone-like term (at least 6 digits once formatting is removed) is reduced to its **last 9 digits**. That makes `0712 345 678`, `+255 712 345 678` and `255712345678` match each other.
- ID-like tokens are upper-cased and stripped of spaces, hyphens and slashes.

**Match**

The match runs against one immutable search expression per customer:

```sql
lower( coalesce(customer_no,'') || ' ' || coalesce(display_name,'') || ' ' ||
       coalesce(first_name,'') || ' ' || coalesce(middle_name,'') || ' ' || coalesce(last_name,'') || ' ' ||
       coalesce(company_name,'') || ' ' ||
       regexp_replace(upper(coalesce(id_number,'') || ' ' || coalesce(nida_no,'') || ' ' || coalesce(passport_no,'') || ' ' ||
                      coalesce(driving_license_no,'') || ' ' || coalesce(tin,'') || ' ' || coalesce(registration_no,'')), '[-/]', '', 'g') || ' ' ||
       regexp_replace(coalesce(phone,'') || ' ' || coalesce(alternate_phone,''), '[^0-9 ]', '', 'g') )
```

**Index.** A GIN `gin_trgm_ops` index on that expression (requires the `pg_trgm` extension). It is created `CONCURRENTLY` in a non-transactional migration so writes are not blocked.

**Ranking**

1. Exact customer no., ID or phone match first.
2. Then names that start with the term.
3. Then the rest, by most recently updated.

**Security**

- The existing `applyCustomerReadScope` applies (company + branch / own-records rules). It is the same scope as the customer list, so there is no new visibility.
- Every query is parameterised.

**Response.** A summary projection only:

`id, customer_no, customer_type, policy_holder_type, name, phone, id_type, id_number_masked, status`

- The full ID number, email, DOB and metadata are **not** returned by search.
- The full record is loaded on selection through the existing scoped `GET /:id`.
- Masking (last 4 characters) follows `CustomerDetailPage.maskIdentifier`. The phone stays unmasked, consistent with the customer list.

**Frontend.** Extend the existing `AsyncCombobox` (300 ms debounce, abort signal, `keepPreviousData`, loading/empty/error states) with:

- an optional two-line `description` per option;
- a footer action slot.

No new dependency is needed.

## 5. Vehicle search design

**Endpoint.** `GET /api/v1/tenant/motor/vehicles/search?q=<term>&limit=20`

- `@TenantScoped()`, `motor:read`. Vehicles are company-scoped today; there is no branch rule.
- Declared before `vehicles/:id`.

**Normalisation.** The search term goes through `normalizeMotorIdentifier` (strip non-alphanumerics, upper-case), the same function used when vehicles are created manually.

**Match**

- `registration_no_normalized LIKE :q || '%'` (prefix), **or**
- `chassis_no_normalized LIKE '%' || :q || '%'` (contains — users often type the last characters of a chassis number).

Soft-deleted rows are excluded.

**Indexes**

- GIN `gin_trgm_ops` on both normalised columns.
- A one-off backfill of the NULL normalised columns using the same `regexp_replace(upper(x),'[^A-Z0-9]','','g')` already used by migration `1790208000000`.

**Write path fix (prevents duplicates)**

`persistMotorVehicle` will:

- write both normalised columns;
- find an existing vehicle by normalised registration or chassis **across the company**, falling back to the current raw match;
- if the vehicle belongs to another customer, follow **decision D3** instead of hitting the raw database constraint.

**Response.** `id, registration_no, chassis_no_masked, make, model, manufacture_year, motor_type, motor_category, customer {id, name}`.

- The full record is loaded on selection through the existing `GET /tenant/motor/vehicles/:id`.
- The wizard fills the form from that record exactly as `fillFromExisting` does today.

## 6. Before and after

Assumed case: direct-channel user, existing customer, vehicle already in the register or found by TIRA, one product with two risks, a risk that needs sum insured, no discount, no add-ons.

| Area | Current | Proposed | Benefit |
|---|---|---|---|
| Wizard steps | 4 | **2** | Fewer navigations and validation stops |
| Visible input controls | **38** (6 + 28 + 3 + 1) | **8** (customer, vehicle, product, risk, sum insured, duration, start, payment); 7 with one risk | About 80 % fewer controls on screen |
| Vehicle fields shown after a fill | 22 | 0 (only missing ones) | No re-reading of filled data |
| Required manual selections | Product, risk, customer, vehicle category, search-by, saved vehicle or Fetch | Customer, vehicle, risk (product automatic when single) | 6 → 3 |
| Clicks, typical | About 13: product 2, risk 2, Next ×3, customer 2, vehicle 2, sum insured 1, Create 1 | About 9: customer 2, vehicle 2, risk 2, sum insured 1, Next 1, Create 1 | About 30 % fewer clicks, and less typing |
| Load-time requests | customers ×500 full rows, vehicles ×500 per customer, subject matters ×500, products, categories, taxes, currencies, channels | products, categories, taxes, currencies, channels; search requests of 20 summary rows on demand | Three 500-row loads removed |
| Premium calculation | 2 POSTs per pricing change | 1 | Half the pricing load, and no competing writes to the same fields |
| Customer reachability | 500 newest only | Every customer in the user's scope | Correctness |
| Submission | Draft → finalize → separate TIRA submit | Unchanged | Same behaviour |

Clicks are counted from the code paths with the defaults above; they are not measured in a browser.

**Unchanged:**

- server-side repricing and authoritative pricing checks;
- quotation numbering (first draft save);
- `expected_updated_at` concurrency checks;
- maker-checker and approval rules;
- channel permission enforcement;
- the TIRA payload builders;
- endorsement, renewal and edit flows;
- Fleet and Non-Motor wizards;
- audit logging.

## 7. Implementation plan

**Phase 2 — Backend**

1. `customers/dto/search-customers.dto.ts`, `customers/utils/customer-search.util.ts` (term parsing), `CustomersService.searchForUser`, and `CustomersController` `GET search`.
2. `motor/dto/search-motor-vehicles.dto.ts`, `MotorService.searchVehicles`, and `MotorController` `GET vehicles/search`.
3. A migration that adds `pg_trgm`, the customer search expression index (concurrently), the vehicle normalised-column backfill and the trigram indexes.
4. `QuotationsService.persistMotorVehicle`: write normalised identifiers, use company-wide normalised matching, and give a clear conflict for a vehicle owned by another customer.
5. Tests:
   - Jest unit tests for the parser and scope application;
   - an e2e spec against the throwaway `insurance_portal_e2e` database covering company-wide, branch and own-records scope and cross-company isolation (modelled on `test/cover-notes/cover-notes-scope.e2e-spec.ts`).

**Phase 3 — Frontend**

1. `AsyncCombobox`: optional `description` and footer action, backward compatible.
2. `customersApi.searchCustomers`, `motorApi.searchVehicles`.
3. `CustomerSearchField`, `VehicleSearchField`, and a vehicle card that shows only missing fields (`VehicleDetailsFields` gains an `onlyKeys` prop).
4. `MotorQuotationWizardPage`: two steps with sections; step aliases; `deferDraftUntilStepId: 'details'`.
5. `useUnderwriteQuotationWizard`:
   - takes the selected customer from the fetched record instead of `customerOptions.find`;
   - skips the 500-customer load for Motor;
   - loads subject matters only for Non-Motor;
   - fixes the step filter;
   - auto-selects the product for Motor.
6. One premium-calculation hook per risk (sum insured rendered inside `RiskRow`); registration asterisk follows motor type; owner defaults from the policyholder.
7. Vitest coverage:
   - search fields;
   - payload parity (same values → same `buildQuotationPayload` output);
   - step aliasing;
   - the single calculation request.

**Phase 4 — Verification**

- `npm run format:check`, `lint:all`, backend unit tests, `test:web`, both builds.
- `NODE_ENV=e2e` e2e specs.
- `smoke:underwrite-live` against mock TIRA, if the stack is running.

## 8. Test scenarios (mandatory list → how each is covered)

| Scenarios | Coverage |
|---|---|
| 1–4: customer search by first name, full name, phone and ID | Parser unit tests and real-database e2e |
| 5, 8: create customer / vehicle from the wizard | Vitest (dialog → API → auto-select); duplicate 409 path |
| 6–7: vehicle search by registration / chassis, including spacing and case variants | Parser unit tests and real-database e2e |
| 9–11: complete records, missing data, changing customer or vehicle | Vitest (missing-fields-only rendering; dependent values cleared) |
| 12–14: product/risk dependency, premiums, discounts and taxes | Existing pricing specs plus payload parity tests; server repricing is unchanged |
| 15–17: numbering, editing, navigation without data loss | Step-alias and draft tests; existing quotation service specs |
| 18: role scope and cross-company isolation | e2e with three scopes and a foreign company |
| 19: TIRAMIS payload | Existing mapper and validator specs, plus payload parity |
| 20: duplicates and concurrency | Vehicle normalised-match unit tests; existing `expected_updated_at` behaviour |

All tests use isolated fixtures. The e2e suite runs only against `insurance_portal_e2e`.

## 9. Decisions (made 2026-10-18)

| # | Question | Decision |
|---|---|---|
| D1 | When is a new customer created? | **Immediately**, through the existing `POST /tenant/customers` (duplicate detection, customer no., display name, audit), then auto-selected. Users without `customers:create` keep the previous behaviour: the customer is created at finalize. |
| D2 | Seats, Vehicle usage and Owner address: TIRAMIS requires them; the portal treats them as optional (P9). | **Keep them optional.** Only the owner defaults from the policyholder were added. P9 therefore remains open. |
| D3 | A searched vehicle belongs to a different customer. | **Transfer ownership at finalize**, keeping the ownership history. A transfer is refused when the chassis numbers disagree: that is a data conflict, not the same vehicle. |
| D4 | Rollout scope. | **Motor, Fleet and Non-Motor** all use the server-side customer search. Vehicle search is Motor-only; Fleet keeps its saved-vehicle list. |

## 10. Findings outside this scope (not changed by this plan)

- **Possible finalize failure for commercial weight-band risks.** The server builds `vehicle_weight_kg` / `cargo_weight_ton` from kilograms but does not send `gross_weight_tons`, which `assertMotorRiskSelectionMatches` requires. This needs a test before any change. See `quotations.service.ts` `buildMotorPricingFactors`.
- **Finalize ignores the draft's `customer_id`.** It re-resolves the customer by ID number and then by **phone**. A phone match can attach a quotation to a different person.
- **Intermediary TIRA company code appears to be stripped** in `TiramisClientService` before submission.
- **Portal accepts a zero-premium risk** that the gateway then rejects.
- **No idempotency key** on draft create or finalize. A double click on "create" before the first response can create two quotations; the button is disabled while a request is pending.

---

## 11. What was implemented

### Backend

- **Customer search.** `GET /tenant/customers/search`: `customers.controller.ts`, `CustomersService.searchForUser`, `customers/utils/customer-search.util.ts`.
  - It uses the same `applyCustomerReadScope` as the list.
  - Results are summary fields with the ID number masked.
  - It does not run a `COUNT`.
- **Vehicle search.** `GET /tenant/motor/vehicles/search`: `motor.controller.ts`, `MotorService.searchVehicles`. It is company-scoped like the rest of the register, and returns a masked chassis number and the owner's name.
- **Migration `1794600000000-WizardRecordSearch`.**
  - Adds `pg_trgm` and the customer search-document GIN index.
  - Backfills `registration_no_normalized` / `chassis_no_normalized`.
  - Adds trigram indexes on those two columns.
  - The entities declare the indexes with `synchronize: false`, so migration generation will not drop them.
  - The migration runs in TypeORM's single transaction, so indexes are built without `CONCURRENTLY`. Writes to `customers` and `motor_vehicles` are blocked briefly while the indexes build.
- **Finalize vehicle upsert** (`QuotationsService.persistMotorVehicle`):
  - writes the normalised identifiers;
  - matches registration and chassis across the company;
  - matches the engine number only within the policyholder's own vehicles, as before;
  - transfers ownership (D3) through `motor/utils/record-vehicle-ownership-transfer.ts`, which closes and opens `motor_vehicle_ownerships` periods and writes an `OWNERSHIP_CHANGED` audit row.
  - The motor-detail version link now comes from the saved vehicle's ID.

### Frontend

- **`AsyncCombobox`** gained optional result descriptions, a minimum search length, a "more matches" hint and keyboard-reachable actions. It stays backward compatible.
- **Customer selection in all three wizards** (`PolicyholderStep` with `CustomerSearchField`):
  - customers are searched on the server;
  - the selected record is loaded by ID (`useCustomer`);
  - a "Missing for TIRA" prompt appears when the record lacks policyholder details;
  - new customers are created and selected straight away (D1).
- **The controller** (`useUnderwriteQuotationWizard`):
  - no longer loads 500 customers;
  - loads saved vehicles for Fleet only, and subject matters for Non-Motor only;
  - blocks completion while the selected customer is still loading.
- **Motor wizard (two steps):**
  - `MotorQuotationWizardPage` holds the customer, vehicle (`MotorVehicleSection`), cover, premium and business source sections, then Review.
  - Legacy step IDs are aliased, and the draft (and with it the quotation number) is created when leaving step 1.
  - Payment method moved to step 1.
  - Discount and tax fold into one "Adjustments" line. The tax fields stay mounted, so the default tax still applies.
  - Add-ons are offered only when the product defines them.
  - Review has per-section Edit links and shows the discount line.
- **One premium calculation per change.** Sum insured is now rendered only by `RiskRow`, so a single `useRiskPremiumCalculation` instance runs for risk 1.
- **The product is picked automatically when only one is valid** (P10). The registration asterisk follows the vehicle type (P8).

### Test results (2026-10-18)

| Suite | Result |
|---|---|
| Backend unit (`jest`) | 220 suites, 1,564 tests passed (includes the new search parser and index-drift tests) |
| Backend e2e (`wizard-record-search`, `cover-notes-scope`) on disposable databases | 21 + 2 tests passed |
| `test:verify-clean` | No test databases left; no e2e rows in the working database |
| Web (`vitest`) | 54 files, 323 tests passed (21 new) |
| Web type-check and lint, backend lint (changed files) | Clean |
| `build:insurance-portal-service`, `build:insurance-portal-web` | Succeeded |

**What the new e2e spec covers:**

- search by first name, full name, local and international phone, ID with separators, customer number and TIN;
- LIKE wildcards are matched literally;
- own-records, branch and cross-company isolation;
- masked output;
- paging;
- PostgreSQL actually uses the trigram index for the query expression;
- vehicle search by registration typed differently and by part of the chassis number;
- normalised identifiers are stored;
- the vehicle is reused instead of duplicated;
- a conflicting registration is refused;
- ownership is transferred with history and audit.

**Not run:**

- `smoke:underwrite-live` (draft → finalize → TIRA submit). It needs the portal, the TIRAMIS gateway and mock TIRA running.
- A manual pass in the browser.

### Still open

- **P9:** TIRAMIS requires seats, usage and owner address (D2 kept them optional).
- **Section 10 items:**
  - weight-band repricing;
  - finalize re-resolving the customer by phone;
  - the intermediary TIRA code;
  - zero premiums;
  - no idempotency key.
- **Vehicle value reset.** `persistMotorVehicle` still resets `vehicle_value` to 0 when it reuses a register entry (pre-existing).
- **The repository-wide `format:check` already fails** on about 69 files on `main`. The files changed here are formatted.
