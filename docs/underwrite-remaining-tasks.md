# Underwrite module — remaining tasks

Status date: 2026-09-30. Branch: `feat/claim-module`.
Background: [underwrite-handoff.md](underwrite-handoff.md) and
[fleet-vehicle-endorsement-design.md](fleet-vehicle-endorsement-design.md).

## 1. Fleet add/remove-vehicle endorsements

Build steps 1–4 are done (engine, endpoints, TIRA requests, apply to the
policy). Two steps are left.

### Step 5 — Screens
- [ ] "Add vehicle" on the Fleet endorsement screen (shared
      `PolicyEndorsementPage` in the Underwrite scope). Reuse the fleet
      wizard's vehicle capture fields, choose the template vehicle, and show
      the remaining-period premium before saving.
      Calls `POST tenant/underwrite/fleet/endorsements/:id/vehicles`.
- [ ] "Remove" on each vehicle card, with a confirmation that shows the
      return premium (`pricing_snapshot.fleetRemovalRefund`).
      Calls `DELETE .../vehicles/:fleetEntry`.
- [ ] "Undo" on pending vehicles (`POST .../vehicles/:fleetEntry/revert`).
- [ ] Badges on vehicle cards: New / Removed (pending) / Cancelled (applied).
- [ ] Offer the two fleet types only on Fleet policies. Hide field editing on
      them (the backend already refuses it).
- [ ] `FleetVehiclesPanel`: show each vehicle's status and its added or
      removed date.
- [ ] Plain-language messages for TIRA082, TIRA090/220, TIRA105, TIRA106,
      TIRA108, TIRA212 and TIRA221.
- [ ] Frontend tests for the add, remove and undo calls and the badges.

### Step 6 — End-to-end check with mock-TIRA
- [ ] Add one vehicle → approve → submit → callback → the policy has the new
      risk, cover note (reference and sticker), fleet item and totals.
- [ ] Remove one vehicle → return premium follows the company's
      cancellation rules → the risk is cancelled from the effective date → a
      claim on it after that date is refused.
- [ ] Add then remove on the same policy (the second endorsement uses the
      first one's snapshot).
- [ ] An ordinary endorsement on a fleet with a cancelled vehicle does not
      send that vehicle to TIRA.
- [ ] Renew a changed fleet.

## 2. Confirm with TIRA or compliance
- [ ] Header totals on a vehicle-removal request. Currently sent as the
      removed vehicles' issued premium.
- [ ] `ComprehensiveInsured` for fleets that mix comprehensive and
      third-party cover. Currently estimated from the issued fleet's ratio.
- [ ] `FleetSize` on addition and removal requests. Currently the number of
      vehicles in the request, which is what the TIRA service validates.
- [ ] Minimum fleet size after a removal (D4). The default is 2.
- [ ] Which cancellation reason's rules apply to a vehicle removal. The
      default is `CUSTOMER_REQUEST`.
- [ ] Ordinary (non add/remove) fleet endorsements may send an empty
      `FleetId`: they read it from `cover.fleet`, which issued snapshots do not
      carry. Check, and if confirmed, use `source.finalizationSnapshot.fleet`
      as the add/remove requests do.

## 3. Known limitations to review
- An added vehicle is priced from a template vehicle's original quote. Sum
  insured, seats, year and weights come from the new vehicle; other pricing
  factors (for example usage or body type) come from the template.
- The "already insured elsewhere" check reads quotation vehicles only.
  Vehicles added mid-term to other policies are caught by TIRA
  (TIRA090/220).
- Undoing a pending addition can leave a gap in fleet entry numbers.
- On a removal, the tax difference comes from the repricing, not from the
  cancellation-rule refund.

## 4. Release and verification
- [ ] Deploy `apps/tiramis` (it parses every fleet `FleetResDtl`) together
      with the portal service.
- [ ] Run migrations `1791100000000` to `1791100000004` on a staging copy:
      issuance links and backfill, policy-number counters and the sync-status
      repair, fleet endorsement types, `policy_risks.cancelled_at`, and
      nullable `cover_notes.quotation_entry_id`.
- [ ] Run the seed, which adds the `FLEET_ADD_VEHICLE` and
      `FLEET_REMOVE_VEHICLE` endorsement types for new companies.
- [ ] Work through the Phase 9 checklist in
      [portal-completion-qa.md](portal-completion-qa.md) on staging.
- [ ] From `/underwrite` on each line: issue → endorse → cancel → renew.

## 5. Known bugs (separate fixes)
- [ ] `QuotationsService.persistMotorVehicle` writes `usage_type = fuel_used`.
- [ ] The analytics `branch_id` filter is not checked against the user's
      allowed branches.
- [ ] Quotation-level `requires_approval` is hard-coded false.

## 6. Owner decisions still open
- [ ] Retiring the old `/underwriting` module: plan in
      [underwrite-deprecation-plan.md](underwrite-deprecation-plan.md). It
      needs approval and a separate change.
