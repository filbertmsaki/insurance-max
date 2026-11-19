# Finance Phase 0 implementation checklist

This working checklist tracks code changes separately from controlled UAT and production authorization. It is not an accounting approval.

## Readiness

- [x] Preserve the existing working tree; `audit-output/` was the only untracked path at start.
- [x] Confirm portal service Finance module and shared `DB_*` data source.
- [x] Read local development migration status. Finance migrations through `1797800000000-FinanceCommissionControlHardening` are applied, but several later Finance migrations are pending. No migration was run against this database.
- [x] Identify legacy `finance_journal_entries` and canonical `finance_foundation_journals`.
- [x] Identify empty payment adapter registry and outgoing simulator binding.
- [x] Review the isolated PostgreSQL runner and three stale controller assertions.

## P0 capabilities

| Code | Capability | Current implementation work | Remaining acceptance work |
|---|---|---|---|
| FIN-11 | General Ledger | Source-event uniqueness and deferred balance/immutability migrations tested in isolated PostgreSQL; certified trial balance and account drill-down UI | Single-ledger equivalence, balances, periods, UAT |
| FIN-13 | Double-Entry Posting Engine | Existing policy and balance checks retained | Concurrency and canonical authority proof |
| FIN-14 | Accounting Rules Engine | Existing governed policy retained | Complete source-specific rules and approvals |
| FIN-22 | Premium Billing | Existing quotation/endorsement paths retained | All product lifecycle scenarios |
| FIN-25 | Premium Collections | Existing manual/provider paths retained | Real provider adapter and certification |
| FIN-28 | Receipt Allocation | Existing controlled commands retained | Multi-invoice and concurrency proof |
| FIN-39 | Payment Disbursements | Existing outgoing controls retained | Bank execution adapter, lifecycle, reconciliation |
| FIN-46 | Policy Financial Ledger | Existing payment projection retained | Complete policy subledger and history |
| FIN-50 | Claims Financial Accounting | Existing claims controls retained; admin approval override removed | Reserve and GL tie-out |
| FIN-51 | Claims Settlement Finance | Existing gated disbursement retained | Bank settlement evidence |
| FIN-53 | Reinsurance Premium Accounting | Existing source module retained | Ceded premium subledger/GL reconciliation |
| FIN-54 | Reinsurance Claims Accounting | Existing settlement path retained | Recoverable and cash reconciliation |
| FIN-57 | Insurance Financial Reconciliation | Existing payment reconciliation retained | Cross-source financial reconciliation |
| FIN-74 | Bank Reconciliation | Existing reconciliation batches retained | Bank master, statement import, GL matching |
| FIN-75 | Payment Reconciliation | Existing matching retained | Provider/bank fee and exception handling |
| FIN-80 | Foreign Exchange Accounting | Existing rate context retained | IAS 21 policy and realized/unrealized FX |
| FIN-105 | Finance Permissions | Existing permission decorators retained; dashboard aggregate restricted to company-wide data scope | Full role and scope test matrix |
| FIN-107 | Accounting Policies | Existing policy governance retained | Approved policy readiness and UAT |
| FIN-108 | Internal Financial Controls | Existing locks/mandates retained; admin self-approval exceptions removed; unverified legacy payout completion blocked | End-to-end maker/checker controls |
| FIN-111 | Source Evidence Registry | Existing attestation registry retained | Key provisioning and event coverage |
| FIN-112 | Finance Event Processing | Existing quotation outbox retained; transactional event-key idempotency hardened | Other event contracts and replay monitoring |
| FIN-113 | Financial Integrations | Existing portal/insurance integrations retained | Provider, bank, and tax integrations |

Supporting FIN-15 and invoice, receipt, payment, approval, currency, book, and period workflows remain on the acceptance path. No live posting, policy activation, or money movement has been performed.

## Current independent improvements and remaining blockers

- Company dashboard totals are now database aggregates by currency, with company-wide access required. Paged rows are no longer presented as global totals.
- Cancellation invoices with unresolved source tax are explicitly flagged and refused by the journal posting path.
- Refund and commission payment commands fail closed before recording a paid state. Their UI exposes the settlement dependency. A certified bank/provider integration and linkage to those records is still required.
- The Finance outbox processor only applies quotation payment events; other persisted event contracts need defined consumers and replay rules. They must not be declared published without a consumer.
- Atomic outbox event-key insertion passed a concurrent isolated PostgreSQL retry and conflicting-payload test.
- The dashboard includes fully allocated receipts and displays exact PostgreSQL decimal strings without JavaScript number conversion.
- The local development database has no posted legacy journals but several unapplied Finance migrations. No local or production migration was executed in this work.
