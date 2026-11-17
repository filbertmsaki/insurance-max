# B15 — Inactive outgoing cash controls

This slice implements payment preparation, independent review, reservations, a durable provider-call ledger, recovery queries, bank reconciliation and separate discharge evidence review. It creates no live payments or financial postings. Existing quotation, invoice, receipt, commission, claim, reinsurance and payment paths remain authoritative.

## Control flow

1. Capture signed funding, obligation or bank-payment evidence through the existing B10/B11 source-event intake. The new event contract is `source.outgoing.evidence-snapshotted.v1`; it uses the existing source snapshot codec and exact tenant/entity/book targets.
2. `observeEvidence` verifies accepted signed source bytes, source ownership, currency and decimal scale against an exact reviewed `RECEIVABLE_CONTROLS` profile. No fourteenth G04 configuration family or duplicate currency calculator is introduced.
3. Funding evidence explicitly reconciles **cleared balance − legacy reservations − legacy commitments − unavailable funds = available capacity**. Every component is required, including genuine zeros. A second source alias cannot reset the funding baseline or create another cash pool in a different accounting book.
4. `prepare` freezes the funding/obligation versions, amount, maximum fee, beneficiary reference, provider account reference and approval expiry. The execution key is derived once from the immutable intent identity. Reusing a command key with different content is rejected.
5. `review` requires a different subject and natural person from the preparer and excludes beneficiary-related people. The reviewer must have an exact current currency/amount-limited mandate covering the intent expiry. Approval authorizes inactive control processing only.
6. `reserve` serializes capacity checks and reservations. Reservations include the maximum approved fee and consume the remaining obligation amount. Database guards independently enforce the cash and obligation limits.
7. `dispatch(SUBMIT)` first commits one durable call record, then invokes the explicit isolated simulator **outside** the database transaction. An attempted intent can never produce another submission. The application registers an empty simulator collection; execution also requires test mode, a loopback server and an isolated test database name.
8. Timeout, pending, missing response or `NOT_FOUND` preserve the reservation. Recovery uses `dispatch(QUERY)` with the original execution key. A query lease prevents simultaneous recovery queries; no lease expiry authorizes resubmission.
9. Provider observations are appended after the call. A failed result transaction leaves the durable attempt available for recovery. Authority revocation after submission does not erase confirmed provider truth. Definitive zero-cash failure releases capacity; confirmed cash consumes its actual amount and fee, releasing unused fee allowance.
10. Conflicting source revisions, changed beneficiary/provider references, contradictory observations, duplicate provider payment identities or fee/amount overruns remain held exceptions. Confirmed facts remain visible, affected funding is frozen, and negative availability is shown without clamping.
11. `reconcile` requires signed bank evidence matching the original provider key, beneficiary, account, currency, amount and fee. A separate discharge review records evidence while retaining `LEGAL_DISCHARGE_HELD`, `HELD_INACTIVE` and zero financial effects.

## Persistence and permissions

Migration `FinanceOutgoingCashControls1797500000000` creates eight empty registries:

| Registry | Purpose |
|---|---|
| `finance_outgoing_authorities` | Bounded, revocable person/currency/amount mandates |
| `finance_outgoing_evidence` | Immutable funding, obligation and bank evidence |
| `finance_outgoing_aliases` | Accepted delivery aliases linked to one economic identity |
| `finance_outgoing_intents` | Frozen payment subject, approval expiry and execution key |
| `finance_outgoing_events` | Approval, rejection, reservation, cancellation and reconciliation reviews |
| `finance_outgoing_calls` | Durable single submission and controlled recovery queries |
| `finance_outgoing_observations` | Immutable provider responses and held conflicts |
| `finance_outgoing_audits` | Mandatory audit records committed with their subject |

Capabilities are `OBSERVE_CASH`, `PREPARE_PAYMENT`, `REVIEW_PAYMENT`, `RESERVE_CASH`, `EXECUTE_SIMULATION`, `RECONCILE_CASH` and `READ_CASH`. No company grants or default roles are seeded. The internal service is exported by `FinanceFoundationModule`; no public payment route or scheduled payout worker is registered.

The journal-specific B09 approval service is not used to manufacture a cash journal candidate. B15 reuses its strict beneficiary contract and natural-person control pattern, together with existing amount validation, configuration ownership and B11 accepted-source verification.

Evidence, intents, events, calls, observations and audits reject update, delete and truncate. New versions/controlled evidence remain the correction mechanism. Empty migration rollback is supported; rollback refuses deletion once any mandates or evidence exist. The migration is pending in local development and was exercised only on disposable PostgreSQL databases.

## Verification

The isolated suite covers 23 cases, including concurrent reservations/submission, command and payee changes, source aliases, scoped denial, approval revocation, timeout and missing-response recovery, provider-confirmed cash followed by database failure, definitive failure, fee overrun, signed bank mismatch, separate discharge evidence, test-only execution, immutable records, direct SQL capacity/maker-checker bypass and missing audit rejection.

Run the repository-owned isolated runner:

```text
node apps/insurance-portal-service/test/finance/run-isolated-postgres.cjs --test-file finance-outgoing.finance-integration.ts --evidence-dir <private-output-directory>
```

This provisions and stops its own PostgreSQL cluster, uses synthetic signed source events and an in-memory provider-call ledger, and never reads application database credentials. It performs no actual bank, mobile-money, TIRAMIS, fiscal, email or SMS operation.

## Remaining release work

The slice does not establish real bank capacity or actual company acceptance. The immutable funding snapshot is a validation baseline, not a live bank-balance feed; refreshing it requires a separately reconciled migration/version design. Actual legacy cash writers and B14 receipt/refund populations must be reconciled and governed by one reservation authority before live use.

Live provider adapters, authenticated payment APIs, payout/recovery workers, bank/webhook verification, operational exception-owner assignment and telemetry, approved tax/withholding treatment, legal discharge, accounting entries and actual company permissions remain gated work. B16–B19 supply the refund, commission, claim and reinsurance adapters. G04 company evidence and approvals, G05 compatibility acceptance and later release/cutover gates remain required.

No simulator success, draft approval or bank evidence review activates a policy, opens a posting period, approves a live release or authorizes service extraction. Historical paid invoices remain unchanged.
