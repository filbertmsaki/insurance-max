# B13 quotation memorandum billing — inactive implementation

The approved B13 task separates quotation billing from legal accounting
recognition. Its live acceptance depends on B07/B08/B09/B11 and B45. B43 currency
foundations, B44 core reporting, B45 independent foundation acceptance and all
19 accounting decisions/107 operating choices remain unresolved. This batch
implements an internal, inactive memorandum lane; it does not declare those
dependencies complete, switch existing issuance/payment paths, extract a
database or post operational/IFRS 17 revenue.

## Quotation tax correction following B13

The subsequently authorized tax correction supersedes B13's decision to retain
the live invoice builder's zero-tax column. See [TAX-CORRECTION.md](TAX-CORRECTION.md).
Original B13 execution reports describe their historical starting state; they
are not current invoice calculation instructions. All memorandum recognition
holds and unresolved accounting decisions remain inactive.

## Existing project behavior and retained ownership

QuotationsService calls QuotationInvoiceService to create/reuse an invoice for
payment requests. The builder retains workflow creation revision, pricing and
finalization hashes and the agreed payable. The corrected builder verifies the
persisted quotation components and stores net premium plus separately evidenced
tax, levy and fee lines. Missing breakdowns require reconciliation.
FinanceCommandService.issue can separately call FinanceJournalService.postInvoice,
whose existing invoice branch posts receivable, premium income and tax/levy.
QuotationPaymentEventService re-derives payment projection from current invoice
state and rejects a mismatched workflow revision. The tax correction updates
the builder, its caller, financial validation gates and legacy quotation journal
vector; it does not activate the new Finance foundation or IFRS 17 recognition.

FinanceQuotationBillingService is an internal Finance provider with no journal,
payment provider, scheduler, HTTP controller or live source subscription. It
records memorandum source facts only. Fixed database controls retain
MEMORANDUM_ONLY billing authority, UNASSIGNED_HELD recognition ownership,
HELD_INACTIVE accounting and financial_effects=0. Approval of factual billing
does not grant ordinary premium revenue, IFRS 17 revenue, IFRS 9 rights, taxes,
cash/allocations, policy recognition or IAS 21 effects. No new financial handler
is registered in B11. Existing B11 dispositions and B12 ownership/replay remain
unchanged.

## Source contract and legacy adapter

The source event is `source.quotation.billing-snapshotted.v1`, aggregate
QUOTATION, fact kind QUOTATION_BILLING. B10/B11 still transport the signed
SOURCE_SNAPSHOT_REFERENCE_V1 envelope. The full bounded
FINANCE_QUOTATION_BILLING_V1 snapshot is supplied separately and must match the
exact snapshot hash covered by that signed envelope and the accepted scoped
inbox. The service re-verifies stored raw bytes, Ed25519 signature, pinned
historical public-key snapshot, contract, economic/semantic hashes, target
manifest and quotation/company/revision identities. It does not fetch an
arbitrary URL or derive a Finance tenant/entity from a source Company ID.
Historical accepted evidence remains historical when a producer key rotates;
new receptions still need B10/B11's current producer authority.

Snapshots carry separate billing aggregate revision, workflow revision, invoice
creation revision and invoice state version. They retain quotation/invoice/
policy references, product/customer/branch dimensions, original currency and
explicit decimal scale, billing date, pricing/finalization hashes, observed
payment-reference amount/state and declared original journal references. Paid
status and a policy link are observations, never proof of new recognition or
cash discharge. Journal absence must not be inferred from DECLARED_NONE;
LEGACY_EFFECTS_NOT_RECONCILED remains a hold for every memorandum.

`quotationBillingFromLegacyInvoice` is a pure structural adapter for the corrected
quotation invoice shape. It performs no legacy database read or
live hook. The source must supply the actual quotation number, product, billing
revision, current workflow revision, billing date, scale and evidence context.
It requires original invoice/finalization linkage and verified persisted tax
component evidence. A historical zero-tax invoice with no breakdown is rejected
for reconciliation. The corrected split is mapped to explicit EXCLUSIVE
components, including when the original customer price was tax-inclusive.
Independent historical UNSPLIT source observations may still be retained in the
inactive memorandum contract; they do not authorize an invoice, posting or payment.
The adapter preserves PAID/PARTIALLY_PAID/OVERPAID as source status without
certifying cash. Production producer construction, actual source export and
independent source reconciliation remain acceptance gates.

## Exact components and lineage

Amounts use unsigned decimal strings with explicit 0–12 fractional digits and
numeric(38,12) storage capacity. BigInt arithmetic rejects rounding/coercion.
Each line and the complete header must conserve every component:

| Source presentation | Source total                                          |
| ------------------- | ----------------------------------------------------- |
| EXCLUSIVE           | gross − discount + tax + charges                      |
| INCLUSIVE           | gross − discount + charges; tax already included      |
| UNSPLIT             | gross − discount + charges; embedded tax unknown/null |

These are source consistency checks, not legal tax rules, rates, payable
postings or accounting policy elections. Negative totals, discounts exceeding
gross, duplicate lines, incomplete vectors and cross-currency payment-reference
conversion are rejected. Zero quote observations can be retained without
creating a zero legacy invoice; the existing positive-total invoice requirement
continues unchanged.

One memorandum is allowed per exact book/economic source revision and per
canonical source-system/company UUID/quotation UUID/revision. Delivery aliases,
retries and UUID spelling variants cannot create another economic original.
The exact first accepted delivery remains pinned. A changed existing revision
conflicts. Revision n requires the actual revision n−1 memorandum linked to
B10's predecessor; no opening balance is invented. A source correction creates
a new full snapshot, never mutates history or automatically computes a GL delta.
Older billing dates do not backdate a journal. Review rejects a superseded
source head; historical records and already recorded decisions remain visible.

## Review and audit protocol

1. Independently propose/review a typed QUOTATION_BILLING_RULES release in the
   exact book using B06. Its only supported purpose/recognition are
   MEMORANDUM_ONLY/HELD_INACTIVE, with an explicit maximum line count and
   DEC-01/DEC-12/DEC-14 dependencies. It has no activation option.
2. An authenticated human with current PREPARE_BILLING authority calls
   prepareInactive with accepted inbox ID, exact profile ID/hash and snapshot.
   It atomically records header, exact component lines and maker audit. Scope,
   source, profile and maker evidence are frozen. Exact retries reuse it.
3. A different subject and natural person with REVIEW_BILLING calls
   reviewInactive with the exact memorandum ID/hash and an explicit inactive
   review/rejection. Current maker/reviewer authority, original signature,
   profile and latest source head are checked. Audit failure or permission
   expiry rolls back the decision. Exact repeated decisions return their
   historical receipt, not a new approval or accounting effect.
4. READ_BILLING is a separate exact-scope human permission. readInactive uses
   a read-only transaction, rechecks persisted vectors, exposes source facts,
   supersession and immutable audit history, and omits raw signatures/keys.

Authorities default DRAFT. No real grants, profiles, source events, chart
bindings or monetary balances are seeded. Future authenticated IAM, DB roles/
RLS, retention and production read/capacity governance remain deployment gates.
Supported configuration and memorandum writes share the tenant catalogue lock
before book/profile locks. Deferred database checks independently require exact
stored vectors, original source/lineage, current profile and human authority,
independent review and matching atomic audit. Late line insertion, mutation,
deletion and truncation of memorandum evidence are prohibited.

## Migration and acceptance

Migration 1796800000000 adds five empty registries and the inactive configuration
kind. No earlier migration is edited. Down refuses nonempty new registries or
new profiles. The private `quotation-billing` fixture applies B05–B13; earlier
fixture modes keep their previous migration boundaries and rollback tests.
Only private disposable PostgreSQL databases are migrated by verification.

Tests cover complete signed source binding, exact and alias retries, source
lineage/late facts, zero/inclusive/unsplit values, current authority, independent
review, privacy/isolation, original journal holds, signature corruption,
persisted-vector corruption, audit rollback, expiry and guarded rollback.
Existing quotation, quotation lifecycle, payment projection, invoice creation,
journal, guard and prior Finance tests are included in the bounded checks.
Repository/mock compatibility is not full deployed quote-to-policy UAT or actual
financial reconciliation. The approved legal recognition branch, taxes/rates,
measurement ownership, currencies, real source adapters and full live B13
acceptance remain pending. No new ordinary/IFRS 17 journal or production switch
is authorized or performed by this batch.
