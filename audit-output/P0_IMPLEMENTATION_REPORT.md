# Finance Phase 0 implementation status

This report records the work completed in the 18 November 2026 implementation session. **Phase 0 is incomplete and is not production ready.** The statuses below describe capability acceptance, not whether some supporting code exists.

## A. Capability status

| Code | Capability | Status | Main remaining acceptance work |
|---|---|---|---|
| FIN-11 | General Ledger | Partial | Prove one authoritative live ledger, historical equivalence, balances, periods and approved cutover. |
| FIN-13 | Double-Entry Posting Engine | Partial | Verify all source routes and direct-write restrictions across the live canonical path. |
| FIN-14 | Accounting Rules Engine | Partial | Approve complete source rules, effective dates and account mappings. |
| FIN-22 | Premium Billing | Partial | Verify all product lifecycles and source-to-tax-to-ledger reconciliation. |
| FIN-25 | Premium Collections | Partial | Certify a real collection provider and settlement matching. |
| FIN-28 | Receipt Allocation | Partial | Prove concurrent multi-invoice allocation and reversal tie-outs. |
| FIN-39 | Payment Disbursements | Partial | Register and certify a bank/provider adapter; link settlement evidence to legacy payouts. |
| FIN-46 | Policy Financial Ledger | Partial | Reconcile policy financial history to invoices, receipts, refunds and GL. |
| FIN-50 | Claims Financial Accounting | Partial | Complete reserve and settlement GL tie-outs. |
| FIN-51 | Claims Settlement Finance | Partial | Verify cash settlement through the controlled disbursement workflow. |
| FIN-53 | Reinsurance Premium Accounting | Partial | Reconcile ceded premium subledger to GL and treaty evidence. |
| FIN-54 | Reinsurance Claims Accounting | Partial | Reconcile recoverables and settlement cash to claims and GL. |
| FIN-57 | Insurance Financial Reconciliation | Partial | Complete cross-source exception and balance reconciliation. |
| FIN-74 | Bank Reconciliation | Partial | Bank account master, certified statement import and GL matching. |
| FIN-75 | Payment Reconciliation | Not fully verified | Provider/bank fees, exceptions and complete settlement evidence. |
| FIN-80 | Foreign Exchange Accounting | Partial | Approve IAS 21 treatment and test realized/unrealized FX postings. |
| FIN-105 | Finance Permissions | Partial | Complete branch, company and role authorization matrix. |
| FIN-107 | Accounting Policies | Partial | Independent policy approval, activation and effective-date acceptance. |
| FIN-108 | Internal Financial Controls | Partial | End-to-end maker/checker and payout settlement tests. |
| FIN-111 | Source Evidence Registry | Partial | Provision real signing keys and verify all event producers. |
| FIN-112 | Finance Event Processing | Partial | Define and implement consumers for invoice and commission outbox events; replay monitoring. |
| FIN-113 | Financial Integrations | Partial | Certify payment, bank and tax integrations with real external contracts. |

Supporting FIN-15 Accounting Events also remains partial pending approved end-to-end source mapping and reconciliation.

## B. Backend changes

- Added server-side currency-separated dashboard aggregates and a company-wide authorization guard.
- Hardened legacy journal posting with an advisory transaction lock and source-event conflict checks backed by a new unique index.
- Removed administrator self-approval exceptions for refunds, commission commands and claims decisions; retained authority limits.
- Preserved unresolved cancellation tax evidence and rejected accounting recognition from that invoice state.
- Made outbox event-key insertion atomic and rejected reused keys with different evidence.
- Blocked new legacy refund and commission paid transitions without verified settlement evidence; historical already-paid retries remain idempotent.

## C. Frontend changes

- Dashboard totals now come from database aggregates rather than a paginated list and remain separated by currency.
- Foundation review includes a read-only certified trial balance and account journal references for an authorized book and period.
- Refund and commission payment details explain the verified-settlement dependency instead of offering an unsafe mark-paid action.

## D. Database changes

- Added `1798500000000-FinanceJournalSourceIdempotency.ts`: preflights duplicate source keys and creates a unique `(company_id, source_type, source_event_id)` index.
- Added `1798600000000-FinanceJournalBalanceGuard.ts`: preflights legacy journals, then installs deferred balance checks and immutable posted journal triggers.
- Both migrations passed on an isolated disposable PostgreSQL database. They were **not applied** to the local development or any production database.
- Read-only local development inspection found 93 applied migrations, zero legacy journal headers, zero duplicate source keys and zero unbalanced journals. Several later Finance migrations remain pending.

## E. Financial controls

Transactional locking plus the unique index guard duplicate legacy source postings. Deferred database checks reject unbalanced or empty journal commits, and immutability triggers reject journal updates and deletes. Policy eligibility still gates legacy posting. The outbox rejects conflicting event-key reuse. Unresolved tax evidence and unverified disbursements fail closed. These controls do not establish complete single-ledger authority or a production accounting cutover.

## F. Tests

- Finance frontend: 10 files, 65 tests passed, 0 failed; the exact decimal dashboard test passed again after the formatting change.
- Isolated Finance PostgreSQL: all 32 existing files passed on their final run (403 tests), and the new concurrent outbox test passed (1 test). Total: 33 files, 404 tests passed, 0 failed or pending.
- Journal migration integrity: the new migration test is included in those 32 files; it rejects unbalanced, duplicate and mutated direct journal writes.
- The first long PostgreSQL batch had four environment failures after C: ran out of space. All four passed when rerun with private temp directories on D:.
- Full backend unit suite rerun on D:: 305 suites, 2,514 tests passed, 0 failed, 0 skipped. The final dashboard aggregate unit test passed again after its status correction.
- A first full backend unit run was invalidated by the C: disk limit during Jest transform caching (156 suites could not run). The clean D: rerun above is the result used for acceptance evidence.
- Backend and frontend production builds passed; the frontend typecheck also passed after the exact decimal display change.
- The isolated PostgreSQL runner retains its stopped private temp clusters. Automatic approval review rejected recursive cleanup of those C: directories, so they were left untouched; new test runs use D: temp space.

## G. Production readiness

The changed code and isolated database safeguards are available for controlled review. Phase 0 as a whole is **not ready for production deployment or live posting**. No production migration, policy activation or money movement was performed.

## H. External dependencies and remaining work

External decisions or access required:

1. Finance owners must approve accounting policies, source-to-account mappings, tax/levy treatment, FX policy, certified opening balances and the live ledger cutover.
2. Payment and bank owners must provide certified provider contracts, credentials, settlement webhooks or statements and sandbox access. The controlled outgoing service has no registered live adapter.
3. Invoice and commission event owners must define the consumer contract or destination.
4. Database operators must authorize and execute a controlled migration rollout and historical reconciliation. No production database access was provided in this session.

Independent implementation and acceptance work still open:

- Complete the branch/company authorization matrix and scope all remaining operational Finance reads and writes.
- Connect verified payout settlement observations to refunds and commission payments, then replace the temporary fail-closed paid transition.
- Implement and test defined non-quotation outbox consumers and replay monitoring.
- Finish source-to-subledger-to-GL reconciliations, balance/period checks, cross-company negative cases and end-to-end UAT for every P0 source type.
