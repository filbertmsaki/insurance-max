# B16 — Inactive endorsements, cancellations and refunds

B16 adds an internal, inactive Finance control slice. It preserves existing policy-transaction pricing, regulatory submission, policy application, invoicing and refund workflows. It does not replace their financial writer, post a journal, discharge a liability or return actual money.

## Evidence and component ownership

The read-only native adapter reads an **APPLIED**, regulator-**ACCEPTED** endorsement/cancellation and its consecutive source/target policy versions. It validates the existing native policy/pricing hashes using `ProductDefinitionHashService`. It does not recalculate prorating, cancellation charges, tax, levies, commission or premium. The native `net_premium_difference` is not used as tax-exclusive net: the existing endorsement engine puts payable premium difference in that field.

`source.policy-change.evidence-snapshotted.v1` uses the existing signed B11 source-snapshot intake. Every observed change retains the original billing reference, customer, company, policy, term versions, source/workflow revisions, pricing snapshot/hash, effective date, currency and decimal scale. Signed delivery aliases share one economic identity and cannot create another entitlement or operational book owner.

Additional premium and return premium are mutually exclusive source amounts. Signed tax, fee and commission differences remain separate; tax and levy lines retain their codes and configured rule evidence hashes. Net difference is derived only from a complete vector:

```text
payable difference = additional premium − return premium
net premium difference = payable difference − tax/levy difference − fee difference
```

Commission is a separate movement, not another deduction from customer payable. Normal return-premium entitlement is the source return premium. An explicit reversal/adjustment contributes the negative of its payable difference to the original entitlement root. These are inactive control quantities, not accounting recognition policies.

The current source does not publish a pricing-owned `finance_components` object. The adapter leaves missing breakdowns unresolved. A future source producer must supply explicit, native-hash-covered component/rule evidence, reconcile the transaction tax aggregate and pass signed intake. It may not synthesize zero tax, approve a rate, or manufacture missing evidence.

That producer must invoke the adapter and capture its outbox evidence inside the same source database transaction. The adapter accepts a transaction-local manager; it does not create a standalone source capture transaction or publish an event itself.

**Known source prerequisite:** `PolicyTransactionInvoiceService` still writes the entire additional premium to gross with tax and charges zero. The adapter holds that invoice until its actual breakdown reconciles. Correcting that source writer, generating tax/levy detail, assessing historical endorsement invoices and certifying the producer are remaining live-integration work. B16 does not silently edit historical invoices or claim that legacy issue is fixed. The earlier quotation-invoice correction is not a certification of the endorsement writer.

## Control flow

1. `observe` verifies signed accepted B11 bytes and exact original B13 billing ownership. Unreviewed unresolved evidence can be replaced by a higher signed revision. A changed vector after acceptance becomes a durable conflict; delivery aliases do not reset it.
2. `reviewChange` requires a different subject and natural person. The next term must follow the exact accepted predecessor. Unresolved components or invoice reconciliation block review. Ordinary changes after cancellation are held; explicit evidenced corrections remain possible.
3. Reversals/adjustments reference the latest accepted original control effect. A full reversal must invert the exact payable, tax, fee, commission and individual tax/levy vector. A partial adjustment retains its original entitlement root.
4. `prepareRefund` freezes the accepted change, current policy-head hash, original independently reviewed B14 receipt allocation, beneficiary reference, amount and expiry. Command retries retain the same subject. Entitlement and receipt limits are checked under the existing tenant transaction lock.
5. Pending/reviewed B14 allocation reversals and non-rejected/non-cancelled B16 refunds share the original allocation capacity. Database guards protect both entry points. Approval does not create money or prove payment.
6. `reviewRefund` excludes the preparer, aliases of that person and beneficiary-related people. Authority is scoped by tenant/entity/book, currency, amount and expiry. Rejection releases a draft reservation. Cancellation cannot release active, attempted, uncertain or confirmed cash.
7. `obligationCandidate` returns a read-only B15 obligation candidate. It must pass actual signed B11 intake; it does not create a producer signature or insert an accepted inbox.
8. `bindExecution` links the approved refund to the exact approved, unexecuted B15 cash intent and beneficiary. Multiple execution amounts cannot exceed the refund. The intent expiry cannot outlive refund approval.
9. B15 reservation/submission database hooks require a current, approved and bound refund. A pending policy change, conflict, stale head or insufficient entitlement blocks new execution. Recovery queries for an already attempted execution retain its original key, including after a policy correction.
10. `reconcileRefund` projects actual confirmed principal and provider fees separately, checks B15 signed bank reconciliation and retains unknown/partial/conflicting outcomes. A late correction below consumed refunds produces negative available entitlement and a held exception. It never rewrites provider truth or marks a legacy refund paid.

## Persistence and access

Migration `FinancePolicyChangeControls1797600000000` creates seven empty tables:

| Table | Purpose |
|---|---|
| `finance_policy_change_authorities` | Bounded, revocable scoped capabilities |
| `finance_policy_changes` | Immutable applied source vectors and original effect links |
| `finance_policy_change_aliases` | Delivery aliases and durable source conflicts |
| `finance_policy_change_decisions` | Independent inactive review |
| `finance_policy_refund_requests` | Frozen entitlement/allocation/beneficiary/expiry |
| `finance_policy_refund_events` | Review, cancellation, execution binding and cash reconciliation |
| `finance_policy_change_audits` | Audit committed with each control object |

Evidence records reject update, delete and truncate. Scoped foreign keys, shared capacity guards and deferred audit requirements complement service checks. Empty rollback is supported; populated controls or mandates prevent destructive rollback.

The six capabilities are `OBSERVE_CHANGE`, `REVIEW_CHANGE`, `PREPARE_REFUND`, `REVIEW_REFUND`, `RECONCILE_REFUND` and `READ_CHANGE`. No grants, policy decisions, sample company data, APIs or workers are seeded. The service is registered/exported within the existing Finance foundation. The live application has an empty payment-simulator collection; tests explicitly inject the existing isolated B15 simulator.

B15 and B16 migrations are both pending in the source development database. They were exercised only on disposable databases. Source Finance policies/books remain inactive and historical paid invoices are preserved.

## Verification and remaining release work

See [B16 verification](B16-Verification.json) and [implementation report](B16-Implementation-Report.html) for executed checks. The isolated cases cover source revisions, genuine zero versus missing tax, debit/credit/no-change vectors, term ordering, independent review, concurrent refund limits, shared reversal capacity, direct database bypass attempts, immutable audit, exact reversals, late corrections, stable-key recovery, unknown outcomes and partial/full bank-matched cash.

```text
node apps/insurance-portal-service/test/finance/run-isolated-postgres.cjs --test-file finance-policy-change.finance-integration.ts --evidence-dir <private-output-directory>
```

Before any live use: correct and certify the native endorsement invoice breakdown; implement a reconciled source producer/outbox and compatibility adapters; reconcile all existing applied transactions, allocation/refund populations and provider outcomes; implement live APIs, operational exception ownership and telemetry; obtain actual company setup/accounting/tax/legal approvals; complete business UAT and release/cutover gates. IFRS 17 modification/new-contract classification, revenue/liability treatment, commission clawback and legal discharge remain unapproved. B17 supplies the commission adapter. No control review activates accounting or approves service extraction.
