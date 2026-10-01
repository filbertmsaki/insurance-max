# Underwrite module: remaining tasks

Status date: 2026-10-01. Branch: `feat/claim-module`.
Background: [underwrite-handoff.md](underwrite-handoff.md) and
[fleet-vehicle-endorsement-design.md](fleet-vehicle-endorsement-design.md).

## Done on 2026-10-01

- **Step 5, fleet vehicle screens.**
  - `FleetVehicleEndorsementPanel` on the Fleet endorsement screen. It is provided through `PolicyTransactionScope.FleetVehiclePanel`, so only the Underwrite Fleet scope offers the two fleet types.
  - Add vehicle: TIRAMIS MotorDtl form, choice of the vehicle to price like, and sum insured.
  - Remove, with a confirmation, and undo on pending vehicles.
  - Badges: New, Being removed, Removed (with date).
  - Premium and refund summary, and plain-language messages for TIRA082, TIRA090/220, TIRA105, TIRA106, TIRA108, TIRA137, TIRA138, TIRA212 and TIRA221.
  - `FleetVehiclesPanel` shows added and removed vehicles with dates. The backend `forPolicy` merges membership from the current policy version, and totals count only vehicles on cover.
  - Tests: helpers, panel behaviour, and the backend panel merge.
- **Ordinary fleet endorsements:** `FleetId`, `FleetType` and `ComprehensiveInsured` now come from the issued fleet (`source.finalizationSnapshot.fleet`). They were sent empty before, and the TIRA service requires all three. Vehicles cancelled by an earlier endorsement are no longer sent.
- **Known bugs fixed:**
  - `usage_type` is now "Private"/"Commercial" from MotorUsage. Migration `1791100000005` repairs old rows.
  - Analytics branch filter: branch-restricted users may only read allowed branches; one allowed branch is the default, and users with several must choose.
  - Quotation `requires_approval` is now true when any discount exceeds its pricing-control approval threshold, so approval is enforced before payment and TIRA submission.
- **Step 6 tooling:** `scripts/fleet-endorsement-live-smoke.mjs` (`npm run smoke:fleet-endorsements-live`) takes a copy of an issued fleet policy through vehicle removal and addition via the gateway and mock TIRA.

## Still open

### 1. Run the live end-to-end check
- [ ] Start the gateway, the portal and mock TIRA, then run
      `npm run smoke:fleet-endorsements-live`. It has not passed yet: on
      2026-10-01 the local portal did not finish compiling within an hour, so
      the run could not reach it. The first attempt also hit
      `UQ_policies_issued_quotation_revision`; the fixture now gives its copy
      its own revision.
- [ ] Manually check the screens: add, remove and undo on `/underwrite/fleet`,
      and the badges in the vehicles panel.
- [ ] Renew a changed fleet.

### 2. Confirm with TIRA or compliance
- [ ] Header totals on a vehicle-removal request. Currently the removed
      vehicles' issued premium.
- [ ] `ComprehensiveInsured` for mixed fleets. Currently estimated from the
      issued ratio.
- [ ] `FleetSize` on addition and removal requests. Currently the number of
      vehicles in the request, which is what the TIRA service validates.
- [ ] Minimum fleet size after a removal. The default is 2.
- [ ] Which cancellation reason's rules apply to a removal. The default is
      `CUSTOMER_REQUEST`.

### 3. Known limitations to review
- An added vehicle is priced from a template vehicle's quote. Sum insured,
  seats, year and weights come from the new vehicle; other factors come from
  the template.
- The "already insured elsewhere" check reads quotation vehicles only. TIRA
  (TIRA090/220) catches the rest.
- Undoing a pending addition can leave a gap in fleet entry numbers.
- On a removal, the tax difference comes from repricing, not from the
  cancellation-rule refund.
- Analytics: users assigned to several branches must now pick a branch
  (queries take one branch).
- Quotations: discounts over the approval threshold now require approval.
  Existing drafts are re-evaluated on their next save.

### 4. Release and verification
- [ ] Run the full backend suite: `npx jest --runInBand`. On 2026-10-01 it
      did not finish within 90 minutes alongside the running dev servers.
      Targeted suites for all changed modules pass, and the full web suite
      passes (261 tests).
- [ ] Deploy `apps/tiramis` together with the portal service.
- [ ] Run migrations `1791100000000` to `1791100000005` and the seed on a
      staging copy.
- [ ] Work through the Phase 9 checklist in
      [portal-completion-qa.md](portal-completion-qa.md).

### 5. Owner decision
- [ ] Retiring the old `/underwriting` module
      ([underwrite-deprecation-plan.md](underwrite-deprecation-plan.md)).
