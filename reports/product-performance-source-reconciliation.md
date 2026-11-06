# Product-performance source reconciliation — step 2 working notes

Date: 6 November 2026. Status: partial repository analysis; metric definitions are pending Finance, Underwriting and Claims approval. No production data or snapshots were inspected or modified. The corrected query is not verified against PostgreSQL and the report is not ready for financial reliance.

## Currency correction made in the working tree

`apps/insurance-portal-service/src/modules/tenant/reporting/services/product-performance-snapshot.service.ts` now groups claim amounts by `claims.currency_code` and invoice balances by `invoices.currency`, and joins both to policy aggregates on currency. Standalone claim/invoice rows retain their own currency rather than defaulting to TZS. Related policy joins require matching company and exclude deleted policy/invoice records. This preserves separate original-currency rows; it does not convert currency or establish historical balances. Existing snapshots are unchanged.

## Candidate source mapping

| Source | Repository evidence | Link for reconciliation | Open question |
|---|---|---|---|
| Quotation invoice | `billing-commission/services/quotation-invoice.service.ts:80` sets QUOTATION source, quotation ID and initially null policy ID. | `invoice.source_record_id` -> quotation -> issued policy `quotation_id`. | One quotation may have multiple policy revisions. `policy.source_quotation_revision` and invoice `source_revision` are not necessarily equal because quotation workflow revision changes during status transitions. Do not use a naive join or invent one-to-one matching. |
| Policy invoice | Current snapshot query joins POLICY source ID directly to policy. | Company + source ID -> policy ID. | Confirm which policy-source invoices are issued and whether current paid_amount is acceptable for the intended period. |
| Endorsement/cancellation invoice | `policy-transactions/services/policy-transaction-invoice.service.ts` stores source transaction ID and source policy ID. | Invoice source ID -> company-scoped policy transaction -> source policy. | Confirm treatment of debit/credit and whether transactions were applied and recognized. |
| Receipt allocation | `billing-commission/entities/receipt-allocation.entity.ts` has invoice/receipt IDs, currency, allocation and reversal timestamps. | Link active or historical allocation to a uniquely attributed invoice and posted receipt. | Agree cash receipt versus allocated premium, cutoff, reversals, overpayments and mixed currencies. Current invoice paid_amount is a mutable aggregate. |
| Refund | `billing-commission/entities/finance-refund.entity.ts` records receipt, invoice, policy, currency, paid_at and status. | Match refunds to related invoice/receipt without double-counting allocations. | Determine whether reported collections are gross or net; FAILED/REQUESTED refunds are not cash paid. |
| Claim | `claims/entities/claim.entity.ts` links claim to policy and has currency_code, paid and reserve fields. | Company + claim policy ID -> policy/product; group by claim currency. | Current balances are not historical as-of values. Verify complete paid/disbursement and reserve movement histories. |
| Premium ledger | `regulatory-compliance/entities/premium-ledger-entry.entity.ts` has company, policy, currency, type and transaction date. | Company + policy/source IDs and posted status. | Producer coverage, amount sign, effective/posted semantics and Finance approval are unverified. |

## Reconciliation before using a new source

1. Select a Finance-approved closed period and a representative test dataset or read-only extract. Inventory invoices by source type, status, currency, source and policy links; total receipt allocations and paid refunds independently.
2. For each quotation invoice, find company-scoped policy candidates and classify as zero, one or multiple; flag zero/multiple as exceptions rather than counting them. Investigate source snapshot hashes and linkage history before selecting a policy revision.
3. Reconcile endorsement/cancellation invoice totals through the policy transaction and its source policy, without counting an invoice twice if multiple references are populated.
4. Compare total cash receipts, allocations, reversals and refunds by currency to the Finance journal; document unexplained balances, stale projections and unallocated cash. Determine the approved period and cutoff before reporting.
5. Reconcile claims paid and reserves against confirmed disbursements and dated reserve movements by currency. Validate late, reversed and backdated events and historical coverage.
6. Test the query on an isolated PostgreSQL database containing at least two currencies in the same branch/product, claims-only and invoice-only rows, null branch/department/user, cross-tenant references, deleted records and duplicate candidates. Compare every output row against independently calculated expectations.

The executive premium metric in `analytics/services/executive-metrics-source.service.ts` also labels a company-wide sum as TZS without grouping or filtering currency in the inspected method. It remains outside this partial correction and must be addressed along with its scope and interface semantics before reliance.
