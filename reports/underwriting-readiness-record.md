# Underwriting and reporting readiness — working record

Date: 6 November 2026. Release decision: **not ready**. This is a scoped validation of the current working tree, not a production or regulatory certification. Existing uncommitted changes were present. No production data, regulatory requests, application database migrations, payments, backup or restore operations were performed. A migration was exercised only on a disposable synthetic database.

## Automated checks performed

- Portal and TIRAMIS TypeScript no-emit checks passed.
- Seven focused quotation, payment-event, webhook, TIRAMIS retry and issuance unit suites: 103 tests passed. Simulated failure log messages are expected in retry tests.
- Eight focused report, historical helper, cancellation-refund, Claims and pricing unit suites: 49 tests passed.
- These tests use mocks and fixtures. They do not prove PostgreSQL transaction locking, event delivery, complete historical data, production permissions, or actual TIRA semantics.

## Required isolated-environment exercises

1. **Database transaction and lock:** On a disposable PostgreSQL database only, populate a previously published snapshot, inject an insertion failure, verify the old snapshot survives; race two refreshes for the same company/date and verify one complete set, no partial rows or deadlock. Test different company/date combinations and independently reconcile calculated data. Confirm the generated SQL against multi-currency, null dimensions and claim-only/invoice-only rows.
2. **Finance and underwriting concurrency:** Create an invoice and real test receipt/allocation; race reversal against submission reservation and simulate crashes around outbox dispatch. Verify no unsupported paid state, financial evidence and expected exception. The current implementation does not yet guarantee atomic clearance-to-dispatch.
3. **TIRAMIS delivery and recovery:** Use a non-production mock only. Exercise duplicate and out-of-order notifications, rejected signatures, timeout before and after remote receipt, late callback from earlier attempts, concurrent submission and reconciliation. Verify retry rules with the authoritative regulator specification before production. Do not send live TIRA requests as part of this exercise.
4. **Scope and authority:** Verify backend list/detail/export/mutation routes for branch and tenant isolation; creator/submitter and transaction maker cannot self-approve. Review actual deployed grants separately: seed changes do not revoke existing database permissions. Delegated authority and roles remain incomplete.
5. **Finance and Claims reconciliation:** Select an approved closed period and representative anonymized records; compare original-currency receipt, allocation, refund, premium ledger, reserve movements and disbursement totals to independently produced Finance/Claims totals. Resolve every missing mapping or difference before sign-off. Product-performance source attribution and as-of methods remain incomplete.
6. **Recovery exercise:** Operations should test backup and restoration on isolated copies; verify application startup, data integrity, delivery/outbox recovery, alerting, restore ownership and rollback. No restore should target the live system for this exercise.
7. **Operational evidence:** Record test environment/version, dataset provenance, run time, results, unresolved defects, owners and approvals. Security should verify key rotation, tenant binding, signature configuration and shared Redis replay protection in the target deployment without exposing secret values.

## Current blockers

- UW-0 through UW-6 have outstanding work, including receipt/clearance races, authority limits, historical quotation expiry, rating configuration, ambiguous regulatory retries, historical coverage, and unfinished registers and queues.
- Reporting steps 2 and 3 lack verified source attribution and complete historical movements. Step 4 snapshot replacement has passed a focused synthetic PostgreSQL rollback and concurrency check but requires broader source and production-like validation; step 5 comparator has not been fed reconciled data.
- Finance/Claims must approve the remaining metric and cutoff decisions. TIRA message, acknowledgement and retry semantics must be checked against authoritative current integration specifications.
- Do not use the existing product-performance report for financial reliance until these issues, data reconciliation and release gates are closed.

## Update: 180-day offers and isolated PostgreSQL checks

New finalized quotation offers expire at the end of the 180th calendar day in Africa/Dar_es_Salaam, counting the finalization date as day one. The expiration is stored as the exclusive start of the next local day. A scheduled job expires eligible unsubmitted quotations, and approval, payment-request and submission paths reject an expired offer. Historical quotations have no invented expiry; policy-transaction quotations are excluded from the automatic expiry job. The migration has not been applied to the application database. Expiry does not automatically refund a paid quotation.

Finance quotation payment projection now participates in the Finance transaction; an in-flight regulatory submission is not reopened by a payment reversal, and late system payment events can be recorded on closed quotations. This does not eliminate the clearance-to-dispatch race. Policy-transaction payment projection now also uses the caller Finance transaction, and payment changes preserve an in-flight submission. Focused unit tests passed; the combined flow still requires PostgreSQL concurrency and recovery testing.

A disposable local PostgreSQL database with synthetic tables and data was used to exercise report currency grouping, earned premium, failed snapshot replacement rollback, same-company/date concurrent refresh, the offer migration up/down, and receipt-backed clearance. It exposed and verified a fix for a snapshot SQL parameter-count defect. These focused checks do not establish production reconciliation, full migration compatibility, reversal-versus-dispatch safety, or report reliability. The temporary database was removed.

The premium authority threshold confirmed by the business is TZS 100,000,000; the approving roles, above-limit escalation, and other referral triggers remain unconfirmed and have not been invented or enforced. Existing historical cash, regulatory recovery, reporting attribution and historical balances, deployed security, restore testing and business sign-off remain open. The product-performance report remains unsuitable for financial reliance.


