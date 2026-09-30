# Fleet add / remove vehicle endorsements — design

Status: **approved design; all decisions settled 2026-09-30 against TIRAMIS API v1.3 (June 2021)**. Date: 2026-09-30.

## 1. Goal

Let an underwriter add a vehicle to, or remove a vehicle from, an issued
fleet policy mid-term, through the Underwrite endorsement screens, with
correct remaining-period premium, TIRA submission, and policy records
(policy risks, fleet register, cover notes, claims eligibility).

Out of scope: changing an existing vehicle, which already works through
`entries.N.motor.*` and `entries.N.risks.M.sumInsured`.

## 2. What exists today

| Piece | Behaviour | Gap for add/remove |
|---|---|---|
| `ENDORSEMENT_FIELD_RULES` (`endorsement.service.ts`) | Only field-level MODIFY paths | No rule for a whole entry |
| `ProposedPolicySnapshotService.build` | Applies changes in field-path order; `REMOVE` does `delete` | Deleting `entries.1` leaves a hole in the array and breaks `entries.N` references |
| `EndorsementRepricingService` | Reprices every entry from its **original pricing quote** (`entry.pricing.risks[].pricingQuoteId`) | A new vehicle has no original quote, so it fails with "Original pricing quote is missing" |
| `buildFleetEndorsementPayload` | One TIRA item per entry, each with `prevCoverNoteReferenceNumber` | A new vehicle has no previous reference |
| `PolicyTransactionApplyService` | Writes the new policy version and refreshes `coverNotes[]` by fleet entry | Never creates or retires `policy_risks`; never touches the fleet register |
| Fleet TIRA callback | Fixed 2026-09-30: one reference per `FleetResDtl` | Ready to use |

## 3. Data model (snapshot)

Entries are **never spliced**, so every `entries.N` path stays stable for the
life of the transaction.

- **Remove:** a `MODIFY` of `entries.N.status` to `REMOVED`, plus
  `entries.N.removedEffectiveDate` (the transaction's effective date). New
  field rule: `^entries\.\d+\.status$` → category `ASSET`, material,
  repricing, regulatory.
- **Add:** an `ADD` of `entries.<next index>` whose value is a whole entry:
  `motor` (the same fields as the fleet wizard vehicle step), `risks[]`,
  `pricing.risks[]` with a **new** `pricingQuoteId`, a new `fleetEntry`
  (max existing + 1), and `status: 'ADDED'`. New field rule:
  `^entries\.\d+$` with operation `ADD` only.
- The snapshot builder applies `ADD` of an array index by appending, and
  rejects an index other than `length` (so replays stay deterministic).

## 4. Backend flow

### 4.1 Add vehicle
`POST tenant/underwrite/fleet/endorsements/:id/vehicles` (line gate
`fleet.endorsements.manage` + `endorsements:create`):

1. Validate the vehicle: required motor fields, no duplicate registration or
   chassis among active entries, and the vehicle is not insured on another
   active policy (same check as the fleet wizard).
2. Price it with the pricing engine using a template: the product, cover and
   pricing inputs of an existing fleet vehicle's original quote, with the
   new vehicle's factors. Persist the `PricingQuote` and put its id in
   `pricing.risks[]`. Existing repricing then works unchanged.
3. Record the `ADD` change, rebuild the proposed snapshot, reprice.

### 4.2 Remove vehicle
`DELETE tenant/underwrite/fleet/endorsements/:id/vehicles/:fleetEntry`:
records the `status = REMOVED` change. Rejected if it would leave the fleet
below the minimum size (decision D4) or would remove the last vehicle.

### 4.3 Repricing
- `REMOVED` entries are priced at zero for the remaining period, so the
  existing old/new comparison produces the return premium.
- `ADDED` entries are priced for the remaining period from their new quote,
  producing additional premium.
- Mixed add + remove nets off, if D3 allows mixing.

### 4.4 TIRA submission (depends on D1 / D2)
The recommended option for each is shown first.

- **Added vehicle, D1-A (recommended):** a separate **new-business** fleet
  cover-note request for the added vehicle(s): `MOTOR_COVER_NOTE_FLEET`, the
  same `FleetId`, the remaining period, and the vehicle's remaining-period
  premium. It is submitted as a child submission of the endorsement
  transaction; the endorsement completes when both succeed.
- **Added vehicle, D1-B:** include it as an item in the fleet endorsement
  request with no `prevCoverNoteReferenceNumber`. Only valid if TIRA
  accepts it; nothing in this repo shows that it does.
- **Removed vehicle, D2-A (recommended):** an endorsement item on that
  vehicle's cover note with the "decreasing premium" endorsement type and
  the return premium, and the vehicle then flagged off-cover.
- **Removed vehicle, D2-B:** a per-vehicle cover-note cancellation through the
  existing cancellation payload path.

The TIRA response already returns per-vehicle references (callback fix), so
apply can match them by `fleetEntry`.

### 4.5 Apply (on TIRA success)
In the apply transaction, additive only:
- **Added:** create `policy_risks` rows (from the entry's risks and new quote),
  append `coverNotes[]` with the new reference and sticker, and add a
  `motor_fleet_items` row linked to the new `policy_risk_id`.
- **Removed:** set the vehicle's `policy_risks.status = 'CANCELLED'` with
  the effective date, set the fleet item `status = 'REMOVED'` (soft delete, as
  the register already does), and keep its `coverNotes[]` entry marked
  inactive.
- Update `motor_fleets.total_vehicles` and the sum insured and premium totals.

Claims: a removed vehicle's `policy_risk` is `CANCELLED` from the effective
date, so a loss after that date is not claimable. The claims policy-risk
lookup must filter on status and date (small change in `claims.service.ts`).

## 5. Frontend

On the Fleet endorsement screen (the shared `PolicyEndorsementPage` running in
the Underwrite scope):
- An **Add vehicle** button opens the fleet wizard's vehicle capture form
  (reused from `FleetQuotationWizardPage`'s vehicle step) and shows the
  priced remaining-period premium before saving.
- **Remove** on each vehicle card, with a confirmation that shows the return
  premium. Removed cards show a "Removed from <date>" badge; added cards show
  "New".
- The `FleetVehiclesPanel` on the policy shows vehicle status (Active,
  Added <date>, Removed <date>).

Shown only when the policy line is Fleet and the endorsement type is one of
the new fleet types (D3).

## 6. Endorsement types

Two seeded endorsement types, configurable like the existing ones:
`FLEET_ADD_VEHICLE` and `FLEET_REMOVE_VEHICLE`, each with its TIRA endorsement
type code (D2) and approval rules. They are material, so approval is always
required, as for the existing asset changes.

## 7. Decisions needed (owner / compliance)

| # | Question | Recommendation |
|---|---|---|
| D1 | How is an added vehicle reported to TIRA: a new fleet cover note under the same FleetId, or an item in the endorsement request? | **New cover note** (D1-A). Confirm against the TIRAMIS spec or with TIRA. |
| D2 | How is a removed vehicle reported: a decreasing-premium endorsement on its cover note, or a cover-note cancellation? Which TIRA endorsement type code? | **Decreasing-premium endorsement** (D2-A); code to be confirmed. |
| D3 | Can one endorsement mix add, remove and field changes? | **No**: one kind per endorsement, which keeps the TIRA submission single-shaped. |
| D4 | Minimum fleet size after removal (below that, convert to single motor or refuse)? | **Refuse below the product's fleet minimum** (default 2). |
| D5 | Return premium on removal: pro-rata or short-period scale? | Use the product's **existing cancellation refund rule** for that vehicle. |

### Decided (2026-09-30)

- **D1:** an added vehicle gets a new fleet cover note under the same FleetId (D1-A).
- **D2:** a removed vehicle is reported with a decreasing-premium endorsement on its cover note (D2-A). The TIRA endorsement type code still needs confirming.
- **D3:** one kind per endorsement (`FLEET_ADD_VEHICLE` / `FLEET_REMOVE_VEHICLE`).
- **D5:** the product's cancellation refund rule, applied to the removed vehicle.
- **D4:** refuse a removal that would leave fewer than 2 active vehicles (default until the owner sets another minimum).

### TIRAMIS API v1.3 references

- **Added vehicle** (§6.1): a `MotorCoverNoteRefReq` to the fleet endpoint with `CoverNoteType = 1` (new) and `FleetHdr.FleetType = 2` ("For addition"), the existing `FleetId`, `FleetSize` = the new active count, and one `FleetDtl` per added vehicle. The `FleetEntry` continues the fleet's numbering (`Numeric(3)`, so at most 999). There is no `PrevCoverNoteReferenceNumber`, since it is optional for new cover notes. Cover dates run from the effective date to the policy end date. The response (§6.3) returns a reference and sticker per `FleetResDtl`, which the callback now parses.
- **Removed vehicle** (§6.1 `FleetDtl`): `CoverNoteType = 3` (endorsement), `EndorsementType = 2` (Decreasing Premium Charged), the vehicle's `PrevCoverNoteReferenceNumber` (mandatory for endorsements), `EndorsementReason`, `EndorsementPremiumEarned`, and risks priced for the remaining period (zero).
- `EndorsementType = 4` (Cancellation) stays reserved for whole-policy cancellation.
- Error codes to surface: TIRA082 (invalid previous cover note reference), TIRA090/TIRA220 (motor already has an active cover note), TIRA105 (invalid/duplicate FleetId), TIRA106 (invalid fleet size), TIRA108 (invalid fleet entry), TIRA212 (invalid endorsement type), TIRA221 (invalid fleet type).

## 8. Build plan (after decisions)

Progress (2026-09-30):
- **Steps 1–2 done.**
  - Snapshot builder appends to `entries` and sorts changes numerically.
  - Repricing prices `REMOVED` entries at zero.
  - `FleetVehicleEndorsementService` (policy-transactions) adds, removes and reverts vehicles in one DB transaction through `EndorsementService.applyWithinDraft`.
  - Generic field changes are refused on the two fleet types.
  - Endpoints: `POST` / `DELETE tenant/underwrite/fleet/endorsements/:id/vehicles[/:fleetEntry]` and `POST .../vehicles/:fleetEntry/revert`.
  - Types seeded (migration `1791100000002`).
  - Added vehicles are priced from a template vehicle's original quote (pricing inputs other than sum insured, seats, year and weight come from the template).
- **Step 3 done** (`policy-transaction-tiramis-payload.service.ts`). Because each endorsement holds one kind of change (D3), each maps to exactly one TIRA request, and no child submission is needed.
  - **Add Vehicle:** `CoverNoteType 1`, `FleetType 2`, the issued `FleetId` (from `source.finalizationSnapshot.fleet`), and only the added vehicles as items. There is no previous reference and no endorsement fields. Totals are the added vehicles' remaining-period premium; commission is that total times the cover's rate.
  - **Remove Vehicle:** `CoverNoteType 3`, and only the removed vehicles as items, each with its own previous reference and `EndorsementType 2`. Items carry the vehicle's issued risks, because TIRA rejects zero premiums (as for cancellations). `EndorsementPremiumEarned` is the issued premium minus the remaining-period premium.
  - **Fleet header:** `FleetSize` and `ComprehensiveInsured` count the submission's items, since the TIRA service validates `fleetSize === items.length`.
  - An ordinary endorsement that somehow carries added or removed vehicles is refused.
  - Mock-TIRA needs no change: it builds `FleetResDtl` from the request's items.
- **Step 4 done.** `FleetVehicleApplyService` runs inside `PolicyTransactionApplyService.applyEndorsement`.
  - **Applied snapshot:** an added vehicle becomes a normal entry (`addedEffectiveDate`) with its TIRA reference and sticker appended to `coverNotes`. A removed one stays as `CANCELLED` (`removedEffectiveDate`). Repricing, the generic fleet payload and the vehicle service treat `CANCELLED` as off cover.
  - **Headline cover note:** the policy keeps its own `cover_note_no` and sticker on these two types.
  - **Added vehicle records:** insured asset and motor vehicle (matched by chassis, registration or engine number, else created); policy risks from the endorsement pricing; a cover note cloned from the template vehicle's (TIRA reference and sticker, `quotation_entry_id` NULL) linked in `policy_cover_notes`; a fleet register item.
  - **Removed vehicle records:** policy risks `CANCELLED` with the new `cancelled_at`. Vehicles that were themselves added are matched by vehicle only, so their template's risks are untouched. Its fleet item is retired and fleet totals refreshed.
  - **Claims** refuse a loss on a cancelled vehicle on or after `cancelled_at`.
  - **Refund (D5):** `FleetRemovalRefundService`, in the snapshot rebuild, sets the return premium to the removed vehicles' issued premium refunded under the company's cancellation method (reason `CUSTOMER_REQUEST` rules), minus the cancellation charge once. Details are kept in `pricing_snapshot.fleetRemovalRefund`. The tax difference remains the repricing's.
  - **Migrations:** `1791100000003` (`policy_risks.cancelled_at`) and `1791100000004` (`cover_notes.quotation_entry_id` nullable).
  - **Checked against the local database** in a rolled-back transaction on POL-DIR-2026-00008.
- **Open for owner / TIRA confirmation:** header totals on a removal (sent as the removed vehicles' issued premium), and `ComprehensiveInsured` for mixed fleets (approximated from the issued ratio).

1. Snapshot: `ADD` append and `status` rule; unit tests for replay order.
2. Add/remove endpoints, vehicle validation, template pricing, repricing of
   `REMOVED` entries; specs.
3. TIRA payload per D1/D2, child submission for new cover notes; mock-TIRA
   support for the chosen shape.
4. Apply: policy risks, cover notes, fleet register, totals; claims filter.
5. UI: add/remove on the endorsement screen, status in the vehicles panel.
6. QA with mock-TIRA: add 1, remove 1, add then remove, then renewal of the
   changed fleet.

Estimate: 5–7 days after the decisions, most of it steps 2–4.
