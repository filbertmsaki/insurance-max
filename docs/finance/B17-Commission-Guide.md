# B17 commissions and acquisition accounting — inactive control slice

This increment preserves legacy commission accrual/payment APIs and adds internal Finance evidence controls. It does not authorise a payable, expense, acquisition asset, IFRS 17 movement, journal or real payout. Company-admin accounting approval and controlled cutover remain outstanding.

The initial native adapter covers the existing intermediary commission-payable path. Broker commission receivables, inward/reinsurance commission and other business-profile adapters require their own approved treatment and are not represented as completed by this slice. No insurer name, tax rate or accounting election is hardcoded.

## Implemented boundaries

- Signed B11 `source.commission.evidence-snapshotted.v1` intake is required for each source snapshot. Tenant, legal entity, book, company, original reviewed B13 billing, quotation, commission identity, party, currency and precision are checked.
- Commission, commission tax, withholding and net payable remain separate signed components. `commission + tax - withholding = payable` uses exact decimal units. Unknown components stay null and block review/settlement. No rates or tax treatments are invented.
- The read-only native adapter preserves the existing commission snapshot and native calculation hash. It reconciles the commission header, balance, paid allocations and outstanding draft/approved legacy payment allocations. It never calls the legacy journal writer. Native rows currently lack authoritative commission-tax/withholding evidence and therefore remain unresolved.
- Immutable source movements form an exact reviewed chain. Delivery/revision aliases cannot recreate an entitlement. A changed accepted vector is retained as a conflict. Economic identity cannot be allocated to a second book.
- Review requires a different subject and natural person, excludes beneficiary-related people, checks current scoped currency/amount authority, and rechecks the maker's frozen authority. Reviews remain `REVIEWED_INACTIVE` or `REJECTED_INACTIVE`.
- An endorsement/cancellation adjustment must consume the exact current reviewed B16 commission difference once. Reversals oppose every original component and retain the original reference. Late clawbacks remain visible even when settlement reservations or confirmed cash exceed the reduced entitlement.
- Known applied B16 changes hold settlement before their B17 movement arrives. Outstanding unreviewed commission changes and conflicting deliveries also hold new cash commitments.
- Settlement reservations consume net payable less historical paid/reserved allocations. Requests reserve immediately, including while awaiting review. Rejection/cancellation may release capacity only when bound cash cannot still occur. Expiry alone does not imply that unknown cash disappeared.
- An independently approved settlement can produce a B15 obligation candidate. That candidate still needs genuine signed B11 intake. An exact approved, unexecuted B15 intent must be bound before reserve/submit, with the same company, beneficiary, currency, precision, entitlement hash and bounded expiry. Partial intents cannot exceed the approved settlement.
- Provider-confirmed principal, bank fees and signed bank matching are reconciled separately. Unknown outcomes retain capacity; original-key B15 queries can recover provider truth after a late correction. Legal discharge and journal posting remain held.
- Acquisition classification is only `UNASSESSED`, `PROPOSED_ATTRIBUTABLE` or `PROPOSED_NON_ATTRIBUTABLE`. Proposals require attribution/allocation evidence. All expense, acquisition asset, amortisation, recoverability and IFRS 17 accounting effects remain zero. The same commission cannot create both an expense and a full acquisition asset here.

## Internal service sequence

1. Read native calculation and legacy allocation evidence with `readCommissionSource`; resolve missing source evidence through the source owner, without fabricating zero tax.
2. Publish the source-owned immutable snapshot through a transactional outbox and signed B11 intake. This increment does not enable a live source producer.
3. `observe` verifies the signed source and original billing. `review` independently accepts/rejects the inactive movement.
4. `read` returns contract/component roll-forwards, legacy allocation consumption, settlement reservations, negative availability, acquisition proposals and explicit holds. `readParty` aggregates separate contracts for one party in the exact book and source currency, retaining each contract's position and holds; it never offsets another book or converts currencies.
5. Observe and independently review exact B16-linked adjustments/reversals before new settlements.
6. `prepareSettlement`, `reviewSettlement`, `obligationCandidate`, signed B11 intake, B15 preparation/review, `bindExecution`, then the existing isolated B15 simulator controls exercise the cash boundary.
7. `reconcileSettlement` records actual principal/fees, bank-match status and exceptions. It never marks a legacy commission paid or legally discharged.

Seven new B17 tables contain authorities, movements, aliases, reviews, settlements, settlement events and mandatory transaction-bound audit. Financial evidence is append-only. Database constraints serialize reservations and guard review independence, component totals, chain ownership, linked adjustments, exact reversals and B15 reserve/submit boundaries. Real company authorities are not seeded. No new HTTP route, worker, live payment adapter or company permission is enabled.

## Database discrepancy and controlled hardening

The older G04/endorsement verification baseline recorded 13 applied Finance migrations, migration ledger 89 and 354 application tables. During B17 verification the local development database instead contained B15, B16 and an early B17 definition: ledger 92 and 376 tables. All 22 added control tables were empty. Their presence alone does not certify installation or policy approval.

The installed early B17 guard lacks the pending-policy-change safeguards and contains an unsafe shared-trigger field access. `1797800000000-FinanceCommissionControlHardening.ts` provides an explicit forward repair. Fresh installs and this repair use the same tested function definitions. The repair changes control functions only, never financial records or company mandates. A stepwise rollback retains stronger guards; the base migration removes controls only if every B17 table, including authorities/audit, is empty.

No source-database migration was executed during this implementation. The forward repair must be separately reviewed and applied through the controlled migration procedure, with before/after schema/function fingerprints, paid-invoice hashes, permissions and financial reconciliation. Never try to fix an already applied migration by editing its ledger or silently rerunning it.

Fresh installation and replacement of a simulated early guard were tested on disposable PostgreSQL databases. Those checks do not constitute a full migration rehearsal on a copy of the current source database.

Read-only verification compares the 85 protected Finance/policy tables and four paid invoice headers/items against the earlier baseline. Permission-assignment tables remain unchanged; the role catalogue's full hash differs from the older baseline, so an unchanged role catalogue is not asserted. No role, assignment or permission-writing code is introduced in B17.

## Remaining release work and unresolved policies

- Company scope, accounting policies, commission tax/withholding rules, legal earning/clawback terms, acquisition attribution, renewal allocation, recoverability and IFRS 17 ownership require the relevant approvals. DEC-03, DEC-06, DEC-08, DEC-12 and DEC-14 remain visible and inactive.
- Publish and certify live source snapshots/outbox routes, tax/withholding rule evidence, cash ownership and operational exception ownership. The native adapter deliberately cannot turn unknown tax into an approved zero.
- Certify company-specific ledger accounts and posting rules. Operational commission cash, IFRS 17 acquisition cash-flow allocation and later measurement movements need one approved accounting-effect owner; this increment posts none of them.
- Reinsurance commission/cross-party/netting, clawback collection and legal offset require their approved operational adapters and policies. This slice does not migrate those writers or automatically net different contracts.
- Complete historical commission/payment reconciliation, company acceptance, live compatibility APIs/workers, provider integration, segregation-of-duties appointments, release gates and incremental one-writer cutover. Finance remains embedded until extraction reconciliation passes.

Executed checks and current counts are recorded in `B17-Verification.json` and `B17-Implementation-Report.html`. Prior B15/B16/endorsement proof files remain historical evidence; their embedded database counts are not current inventory.
