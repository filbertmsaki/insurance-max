# Claims FX data for Finance and IAS 21

This is a description of the current development implementation and its gaps.
It is not an approval of accounting policy or a transfer of ownership.

Claims stores transaction currency and amounts on the relevant claim, reserve
movement, assessment, voucher, payment and disbursement records. Governed
conversions use `claim_fx_snapshots`: company and claim IDs, event type and ID,
transaction and functional currencies, approved rate ID, rate and direction,
source reference, effective date, original and converted values, rounding,
version and supersession. Snapshots are append-only. Legacy events without a
snapshot are unverified; the absence of evidence must not be treated as parity.

For a confirmed payout, `DISBURSEMENT_CONFIRMED` uses the disbursement ID as
the snapshot event ID. Finance journal entries for payment and reversal use the
same disbursement ID as `source_id` and distinct source types
`CLAIM_DISBURSEMENT` and `CLAIM_DISBURSEMENT_REVERSAL`. The journal currently
uses transaction-currency amounts. Its functional-currency valuation and FX
gain/loss treatment are not established by the Claims snapshot.

The Finance interface still needs a controlled, tenant-scoped way to receive
or query these immutable references, both journal IDs, event dates, and the
monetary balance and reporting date for an approved remeasurement run. It must
also identify the original and reversal journal and the original snapshot for
reversals. Corrections need an explicit link and approval evidence before they
can be supplied as trusted Finance inputs. An as-of balance cannot safely be
inferred from only the latest mutable payment status; historical reversal and
movement evidence must be complete and reconciled.

Claims does not post realized or unrealized FX journal entries and does not
provide an IAS 21 remeasurement engine. Balance eligibility, rate policy,
period-end valuation, journal mappings and treatment of exchange differences
require Finance approval. Reporting-date remeasurement and FX journals remain
outstanding original WP1 requirements; assigning them to a WP1B Finance
workstream requires explicit scope approval and completion of the source-data
and interface controls above.
