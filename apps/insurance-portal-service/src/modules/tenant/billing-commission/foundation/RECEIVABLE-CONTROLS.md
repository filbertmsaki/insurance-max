# B14 receipt and receivable controls — inactive implementation

The approved backlog defines B14 as receipt ownership, original aliases, exact
availability, allocations/discharge/ageing and independent reconciliation after
B13. This internal provider implements those controls as inactive records. It
does not introduce a legal receivable election, journal posting, cash execution,
live producer subscription or replacement for existing payment workflows.
All 19 accounting decisions and 107 operating choices remain unresolved.
B43/B44/B45, legal discharge and actual source/bank reconciliation remain gates.

## Accepted source and ownership

`FinanceReceivablesService` accepts `source.receivables.evidence-snapshotted.v1`
with aggregate/fact kind `RECEIVABLE_EVIDENCE` and the existing B10/B11 signed
snapshot-reference codec. `FINANCE_RECEIVABLE_EVIDENCE_V1` has two exact shapes:
`CONFIRMED_RECEIPT` and `BILLING_DUE_DATE`. Full source snapshots must remain
available at the producer; this service neither follows arbitrary URLs nor
infers a Finance tenant/entity/book from a Company ID.

The shared `verifyAcceptedSource` function rechecks the accepted inbox, pinned
contract, exact book target, historical Ed25519 signature/key snapshot, raw
bytes, economic/semantic identities and full supplied snapshot hash. B13 now
uses the same verifier with its unchanged quotation-specific contract.
Historical accepted keys do not become invalid solely because a producer rotates
keys. New evidence still needs the existing current B10/B11 producer authority.

An effective reviewed-inactive `RECEIVABLE_CONTROLS` release must explicitly
declare source cash-account ID, source company, currency and decimal scale.
The original confirmed receipt is identified by tenant/legal entity, declared
source account and exact bank transaction reference. Owner and currency are
frozen vector fields, so changing either cannot create new cash. It has one owner
book. A second book observation cannot create another allocatable receipt.
Source aliases preserve their own accepted evidence but reuse the exact original
cash vector. Changed amounts, customer, bank components or original evidence
produce an owned `CONFLICT_HELD` source observation instead of another receipt.
Conflicts retain the observing human identity and reason and block new assignment.

Current human grants are scoped separately for receipt observation, preparation,
independent review, reconciliation and reads. Subject aliases cannot bypass
natural-person separation. Command completion rechecks the frozen grants and
effective profile after mandatory audit. No production grants, profiles or source
associations are seeded.

## Cash conservation and availability

Each confirmation requires an explicit positive received amount, bank-settled
amount, bank fee, value date and bank-evidence hash. Exact conservation is
`received = bankSettled + bankFee`. Bank fees are retained separately; no expense
classification or implicit net-to-gross conversion is elected.

Existing allocated, refunded and reserved amounts and a legacy evidence hash
are mandatory, even when each is genuinely zero. Missing data never becomes
zero. These inherited components are source observations pending independent
reconstruction, not certified opening balances. Original receipt evidence remains
confirmed even if its legacy consumption exceeds the receipt. Negative capacity
is returned with a reconciliation hold, never clamped to zero.

All values are unsigned exact decimal strings with explicit 0–12 decimal scale,
numeric(38,12) storage and BigInt arithmetic. Rounding and cross-currency
assignment are rejected. Each request must match the original receipt's source
company, customer, currency and scale and a reviewed B13 billing reference.

Inactive assignment capacity is:

`received - legacyAllocated - legacyRefunded - legacyReserved`

`- reviewedAssignments - pendingAssignments + reviewedUnassignments`

This is receipt-to-billing control capacity. It does not authorize B15 outgoing
bank spending or discharge a legal receivable. Confirmed net bank cash and fees
remain distinct from the gross customer receipt observation.

## Requests, review and source changes

Pending ALLOCATE requests reserve both receipt and billing capacity immediately.
A distinct current human reviewer may record REVIEWED_INACTIVE or
REJECTED_INACTIVE against the exact immutable subject. Rejection releases the
reservation. It remains possible when the preparer's authority has expired;
positive review needs the original frozen preparer authority still valid.

REVERSE requests reference an original reviewed assignment and support partial
amounts. Pending reversals reserve reversal capacity but release no receipt
capacity until reviewed. A reversal is an unassignment, never a claim that bank
cash was undone or a customer was refunded. Original confirmations are immutable.
Changing a confirmed source amount requires a separately governed future source
correction; this implementation does not rewrite cash or process bank reversals.

The current implementation serializes control commands on the existing tenant
configuration lock. Database constraints also check complete receipt and billing
consumption, exact currency/ownership, original reversal bounds, independent
review and mandatory scoped audit. No throughput or operating SLA is inferred
from the synthetic tests.

Billing capacity follows the original economic root across source revisions.
New assignments and positive reviews require the current reviewed source; source
reductions expose a signed over-assigned balance. A partial unassignment can
progressively clear it against the original reviewed assignment. Superseded
history remains immutable. Inherited PAID/VOIDED/CANCELLED billing observations
cannot receive new assignments in this lane.

## Due dates, ageing and independent reconciliation

Ageing requires a signed due-date source tied to the exact invoice, B13 subject,
customer, source company, currency and scale, then independent inactive review.
It never substitutes billing date or a default credit term. Until review,
`DUE_DATE_EVIDENCE_REQUIRED` and a null overdue age remain visible. Due dates are
immutable per billing revision; corrections require a new source/billing revision.
Configured ordered day bands and the explicit as-of date produce the ageing
bucket. The selected profile must cover that as-of date. Remaining and available
amounts retain negative source gaps and unassigned legal/IFRS 9 scope.
Assignment/review history and source heads are cut at the end of the requested
UTC day using their capture timestamps. An as-of date before captured billing
evidence is rejected. This does not invent backdated source history or certify
a historical GL balance from a bank value date.

A separate reconciliation permission and natural person are required. Receipt
and assignment preparers cannot attest to their own work. The reconciliation
freezes a complete position hash, statement evidence hash, gross receipt, bank
settlement and fee amounts. A component mismatch is an owned EXCEPTION_HELD
record, preserving the confirmed receipt; an exact factual match is MATCHED_HELD.
Neither outcome clears legal/recognition or legacy migration holds.

Aliases, pending assignments, reviews, unassignments and changed billing source
heads make prior reconciliation stale. Exact retries return the original
historical receipt rather than a new approval. A new independent reconciliation
must use the current position hash. Receipt-specific conflict resolution and
actual bank/source export acceptance remain explicit future gates; upstream
B12 integration replay never silently repairs these financial observations.

## Persistence, rollback and rollout

Migration `1797000000000-FinanceReceivableControls` adds seven empty registries:
authorities, confirmed receipts, source aliases/conflicts, requests, decisions,
reconciliations and audits. Composite scope foreign keys, immutable histories,
fixed HELD_INACTIVE/LEGAL_DISCHARGE_HELD states and financial_effects=0 preserve
the boundary. The down migration refuses populated registries or new profiles.

The migration is executed only on owned disposable test databases for this batch.
It is not applied to the user's development database. B05–B13 migrations, actual
scope/producer/grant provisioning and independent review are release prerequisites
before any later controlled deployment. No API, scheduler, source hook, transport,
configuration activation, operational cash/receipt writer or GL dependency is added.

Existing quotation tax correction and the three configured operational ledger
accounts remain in place. The four historical paid invoices and their items are
protected by pre/post read-only hashes. Existing receipts, allocations, journals,
tax catalogue, identifier and outbox data are also compared without modification.
Overall live B14 financial acceptance remains pending actual source/bank evidence,
legal receivable/discharge treatment, migration reconciliation and deployed UAT.
