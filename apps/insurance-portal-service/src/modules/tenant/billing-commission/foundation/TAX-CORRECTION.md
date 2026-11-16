# Quotation invoice tax correction

## Root cause and corrected contract

The invoice builder accepted only the quotation's tax-inclusive payable, wrote
that to both gross and total, set tax/discount/charges to zero and saved one
premium line. It did not consume the existing persisted risk/add-on tax evidence.
QuotationsService also returned the latest invoice before calling the builder,
which would have bypassed its corrected validation. The single-quotation preview
summary incorrectly included tax in premium-before-discount. Its fallback
finalization hash could describe an empty object instead of the stored snapshot.
These paths are corrected together.

The builder now owns an atomic transaction, locks the scoped quotation, reads
persisted risk/add-on premiums and tax rows, and verifies original pricing charge
snapshots or matching effective catalogue rules. It does not reprice an agreed
quotation with a newer rate. Date values returned by PostgreSQL are normalized
consistently with ISO pricing dates. Existing invoices must have the same verified
financial evidence before reuse, including across workflow-only changes.

The shared calculator reuses the existing Decimal.js precision and HALF_UP
premium/tax rounding policy: premium and each charge use two decimal places.
Exclusive charges are computed on net premium. Inclusive charges use
`payable / (1 + sum(applicable non-exempt rates))`, round each component, then
allocate the residual to net premium so the agreed payable remains exact. All
supported charges use the original NET_PREMIUM percentage basis; no compound,
withheld or fixed charge is inferred from a percentage row. Other charge models
require an explicitly supported source contract before financial use.

Each component requires its original fractional rate, calculated amount, explicit
exemption status and (when exempt) exemption type/reference. A configured zero
rate or evidenced exemption can produce zero. An empty selection in an editable
pricing preview does not establish invoice exemption; missing invoice tax rows,
rates or effective rules block creation. Calculated tax rounding to zero is valid
only with complete rule evidence. No tax rate is hardcoded in production code.

## Storage and posting

Existing invoice header semantics are:

| Field           | Corrected quotation meaning                                      |
| --------------- | ---------------------------------------------------------------- |
| gross_amount    | Premium before discount, excluding separately identified charges |
| discount_amount | Reduction from gross to net premium                              |
| tax_amount      | Statutory tax plus levy/stamp-duty aggregate                     |
| charges_amount  | Separately identified non-statutory fees/charges                 |
| total_amount    | Gross minus discount plus statutory tax plus fees                |

InvoiceItem stores one NET component per risk/add-on and separate lines for every
tax, levy or fee, including evidenced zero amounts. Existing JSON snapshots store
codes, category, rule identity, effective dates, rate, base, exemption evidence,
source IDs, calculation basis and financial hash. The first line contains the
complete `QUOTATION_INVOICE_TAX_V1` breakdown; each item has a component key/hash.
The validator rechecks the header, quantities, unit amounts, component totals and
all hashes before issue, legacy posting, new payment instructions or invoice PDF.

The existing operational journal debits receivables for the unchanged payable,
credits premium for net after discount, and credits each charge to its mapped
account with rate/base/source descriptions. Reversal inverts that vector. Existing
1200/4100/4200 account meanings remain the compatibility defaults; no account is
automatically created by the quotation branch. Non-TAX components need an explicit
catalogue posting account and all accounts must be active and correctly typed.
Receipt cash confirmation and historical paid amounts are not rewritten.

This changes legacy quotation accounting accuracy. It grants no IFRS 17/IFRS 9/
IAS 21 recognition authority and does not activate B13 memoranda. The 19 accounting
decisions, 107 operating choices and B43/B44/B45 gates remain open.

## Catalogue metadata and rollout

One nullable JSON column, `taxes.calculation_options`, is necessary because the
existing catalogue has no effective dates, category or posting mapping. Migration
`1796900000000-TaxCalculationEvidence.ts` adds it without seeding rates, changing
invoice schema or updating historical records. Options are category, inclusive
effective_from/effective_to and ledger_account_code. Null metadata retains the
old catalogue's TAX category and unbounded availability; it is not fabricated
historical version evidence. New pricing snapshots freeze configured metadata
for reproducibility; older quotes without snapshots require matching catalogue
evidence and remain held when that evidence cannot be established.

Before deployment, apply this migration through the project's normal migration
process on the intended database, then deploy API and web changes together.
Review each company's taxes and customer-payable levy/fee mappings and dates.
Do not treat an insurer's regulatory remittance levy as a customer surcharge
without an applicable configured pricing rule. Retain the source pricing snapshots
when revising rules; there is no full new tax-policy version registry in this fix.
The down migration refuses to discard populated metadata. No migration or write
was executed against the user's development database during this investigation.

## Historical reconciliation

The read-only local development review identified four paid quotation invoices:
three with payable 118,000/net 100,000/source tax 18,000 and one with payable
23,600/net 20,000/source tax 3,600, all TZS. Candidate source tax totals 57,600;
payable totals 377,600. This is a reconciliation population, not an approved tax
return or a ledger adjustment. The invoice headers remained exactly unchanged.

Those invoices have paid/allocation counters but no matching receipt, allocation
or journal rows through the inspected direct source links. Investigate original
payment/import evidence, source tax status, dates, accounts, reporting and periods
before choosing any correction. Missing linked journals do not prove that no
external, imported or differently referenced financial effect exists.

Preserve original documents and hashes. An authorized independent reviewer must
approve a linked correction/reissue or an adjustment in an appropriate open
period, reconcile cash/receivables/tax/premium, and retain an audit record. Do not
overwrite paid invoices, silently backfill taxes, recollect payable, or generate
both an operational adjustment and a duplicate IFRS measurement posting. This
change supplies a candidate manifest and blocks new use of missing breakdowns;
it deliberately supplies no automatic historical repair command.

## Verification and limits

Tests cover exclusive and inclusive rounding, multiple charges, discounts,
exemption/zero rates, frozen versus changed catalogue rates, dates, fleet/add-ons,
short-term/non-motor source shapes, payment workflow delegation, PDF/UI display,
real PostgreSQL persistence/concurrency/rollback, correct journal vectors,
reversal and corrupted stored component rejection. The complete prior Finance
unit/database regression suites are retained except old assertions intentionally
superseded by the user's tax correction. Synthetic PDF examples are generated
from the actual builder and renderer. These checks do not certify every product's
deployed pricing workflow, statutory invoice accreditation or actual cutover.

Tanzania policy review references: [VAT Act Cap.148 R.E.2023, section 38](https://www.trab.go.tz/uploads/documents/en-1776866166-THE%20VALUE%20ADDED%20TAX%20ACT.pdf)
and [TIRA premium levy guidance, revised November 2025](https://www.tira.go.tz/uploads/documents/sw-1764074358-GUIDELINES%20FOR%20PREMIUM%20LEVY%20COMPUTATION%20AND%20COLLECTION%20%28Revised%20Version%20No.%2002%20of%20November%202025%29.pdf).
These are jurisdiction review inputs, not universal rate defaults or a substitute
for approved product-specific tax applicability and effective-date decisions.
