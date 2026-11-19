# Detailed capability findings

Evidence paths below are starting points for the capability, not proof of every subfeature. A path to a parent module for a missing capability establishes that the capability was searched within the registered Finance surface. No database migration was assumed applied. All runtime verification is `No`; production ready is `Unknown` for every capability. Permissions are `FinancePermissions`/scoped authority where present; missing capabilities have no verified dedicated permission.

## FIN-01 — Finance Setup (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/foundation/finance-setup/finance-setup.service.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/setup/FinanceSetupPage.tsx`. API/route evidence: /tenant/finance/setup.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1797400000000-FinanceSetupReviews.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Reviewed setup exists; approve and deploy real company configuration and verify live scope.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-02 — Chart of Accounts (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/foundation/finance-foundation.controller.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/foundation/FinanceFoundationPage.tsx`. API/route evidence: /tenant/finance/foundation.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1797200000000-FinanceLedgerFoundation.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Draft and retained chart controls exist; validate accepted chart and live account mappings.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-03 — Accounting Dimensions (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/foundation/finance-foundation.controller.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/foundation/FinanceFoundationPage.tsx`. API/route evidence: /tenant/finance/foundation.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1797200000000-FinanceLedgerFoundation.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Reviewed dimension master exists; prove all source events populate governed dimensions.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-04 — Accounting Books (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/foundation/finance-foundation.controller.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/foundation/FinanceFoundationPage.tsx`. API/route evidence: /tenant/finance/foundation.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1797200000000-FinanceLedgerFoundation.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Book entity and scope selection exist; certify active books and source-company mapping.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-05 — Accounting Periods (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/foundation/finance-foundation.controller.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/foundation/FinanceFoundationPage.tsx`. API/route evidence: /tenant/finance/foundation.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1797200000000-FinanceLedgerFoundation.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Period documents and fences exist; verify close calendar and reopening controls in a deployed book.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-06 — Currency Management (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/foundation/finance-foundation.controller.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/foundation/FinanceFoundationPage.tsx`. API/route evidence: /tenant/finance/foundation.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1797200000000-FinanceLedgerFoundation.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Currency contexts exist; validate functional and presentation currency policy for every book.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-07 — Exchange Rate Management (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/foundation/finance-foundation.controller.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/foundation/FinanceFoundationPage.tsx`. API/route evidence: /tenant/finance/foundation.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1797200000000-FinanceLedgerFoundation.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Rate documents exist; add or verify approved rate source, effective-date coverage, and exception handling.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-08 — Opening Balances (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/foundation/finance-foundation.controller.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/foundation/FinanceFoundationPage.tsx`. API/route evidence: /tenant/finance/foundation.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1797200000000-FinanceLedgerFoundation.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Opening and review workflow exists; certify a reconciled cutover opening for live posting.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-09 — Financial Numbering (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.controller.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/api.ts`. API/route evidence: /tenant/finance.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/modules/tenant/finance/receivables/invoices/entities/invoice.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Invoice and journal identifiers exist; verify all finance document sequences and gap controls.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-10 — Finance Master Data (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/foundation/finance-setup/finance-setup.service.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/setup/FinanceSetupPage.tsx`. API/route evidence: /tenant/finance/setup.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1797400000000-FinanceSetupReviews.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Legal entity and source maps exist; complete bank, supplier, tax, and accounting master data.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-11 — General Ledger (PARTIALLY IMPLEMENTED; P0)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/foundation/finance-foundation.controller.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/foundation/FinanceFoundationPage.tsx`. API/route evidence: /tenant/finance/foundation.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1797200000000-FinanceLedgerFoundation.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Canonical ledger tables and reads exist; deployment and policy release must authorize live posting.
- **Dependency/acceptance:** Approve policy, configure scoped book, and apply migrations before posting. Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-12 — Journal Management (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/foundation/finance-foundation.controller.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/foundation/FinanceFoundationPage.tsx`. API/route evidence: /tenant/finance/foundation.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1797200000000-FinanceLedgerFoundation.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Candidates, approvals, validations, and journal reads exist; finish controlled operational journal workflow.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-13 — Double-Entry Posting Engine (PARTIALLY IMPLEMENTED; P0)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/accounting/posting-rules/finance-posting-policy.service.ts`.
- **Frontend/route:** No dedicated UI found; None found. API/route evidence: Journal posting via FinanceJournalService.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1797100000000-FinancePolicyGovernance.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Balanced posting code is guarded by approved release, active book, open period, and transaction.
- **Dependency/acceptance:** Approve policy, configure scoped book, and apply migrations before posting. Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-14 — Accounting Rules Engine (PARTIALLY IMPLEMENTED; P0)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/accounting/posting-rules/finance-posting-policy.service.ts`.
- **Frontend/route:** No dedicated UI found; None found. API/route evidence: Journal posting via FinanceJournalService.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1797100000000-FinancePolicyGovernance.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Policy definitions and mapping checks exist; approved source-specific releases are not evidenced.
- **Dependency/acceptance:** Approve policy, configure scoped book, and apply migrations before posting. Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-15 — Accounting Events (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/integrations/finance-events/finance-outbox.processor.ts`.
- **Frontend/route:** No dedicated UI found; None found. API/route evidence: Internal outbox and intake.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1796600000000-FinanceIntegrationReliability.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Event intake and previews exist; prove every production source event reaches exactly one accounting outcome.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-16 — Recurring Journals (NOT IMPLEMENTED; P1)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/accounting/finance-accounting.module.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No dedicated route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build scheduled recurring journal templates, approvals, execution, and reversal policy.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-17 — Accruals and Prepayments (NOT IMPLEMENTED; P1)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/accounting/finance-accounting.module.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No dedicated route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build governed accrual and amortization schedules with period posting.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-18 — Financial Allocations (INACTIVE; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/accounting/allocations/finance-allocation-scheduler.service.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/setup/AllocationReview.tsx`. API/route evidence: /tenant/finance/setup/allocation-previews.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1797800000000-FinanceRecurringAllocationPreviews.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Allocation worker produces inactive previews only; release reviewed posting workflow after policy validation.
- **Dependency/acceptance:** Approve policy, configure scoped book, and apply migrations before posting. Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-19 — Intercompany Accounting (NOT IMPLEMENTED; P1)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/accounting/finance-accounting.module.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No dedicated route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build paired company entries, due-to/due-from, elimination, and reconciliation.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-20 — Period-End Closing (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/foundation/finance-foundation.controller.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/foundation/FinanceFoundationPage.tsx`. API/route evidence: /tenant/finance/foundation.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1797200000000-FinanceLedgerFoundation.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Period fences exist; add a complete close checklist, tie-outs, and signoff workflow.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-21 — Financial Adjustments (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/foundation/finance-foundation.controller.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/foundation/FinanceFoundationPage.tsx`. API/route evidence: /tenant/finance/foundation.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1797200000000-FinanceLedgerFoundation.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Journal candidates and reversals exist; define controlled adjustment types and approvals.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-22 — Premium Billing (PARTIALLY IMPLEMENTED; P0)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/integrations/quotation-finance/quotation-invoice.service.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/pages/FinanceInvoicesPage.tsx`. API/route evidence: /tenant/finance/invoices.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/modules/tenant/finance/receivables/invoices/entities/invoice.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Quotation and endorsement invoice paths exist; reconcile all premium changes to invoices and ledger.
- **Dependency/acceptance:** Approve policy, configure scoped book, and apply migrations before posting. Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-23 — Invoice Management (NOT VERIFIED; P1)

- **Existing/backend:** Present (runtime unverified). Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.controller.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/api.ts`. API/route evidence: /tenant/finance.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/modules/tenant/finance/receivables/invoices/entities/invoice.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** API and UI are present; live create/issue/void behavior and migration state were not verified.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-24 — Accounts Receivable (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.controller.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/api.ts`. API/route evidence: /tenant/finance.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/modules/tenant/finance/receivables/invoices/entities/invoice.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Balances and controlled receivable requests exist; complete aged subledger and GL tie-out.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-25 — Premium Collections (PARTIALLY IMPLEMENTED; P0)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.controller.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/api.ts`. API/route evidence: /tenant/finance.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/modules/tenant/finance/receivables/invoices/entities/invoice.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Manual/provider payment paths exist; no concrete provider adapter is registered.
- **Dependency/acceptance:** Approve policy, configure scoped book, and apply migrations before posting. Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-26 — Payment Transactions (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.controller.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/api.ts`. API/route evidence: /tenant/finance.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/modules/tenant/finance/receivables/invoices/entities/invoice.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Transaction API/UI exists; verify provider settlement, idempotency, and live payment state.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-27 — Receipt Management (NOT VERIFIED; P1)

- **Existing/backend:** Present (runtime unverified). Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.controller.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/api.ts`. API/route evidence: /tenant/finance.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/modules/tenant/finance/receivables/invoices/entities/invoice.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Post/reverse APIs and UI exist; live runtime and migration state were not verified.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-28 — Receipt Allocation (PARTIALLY IMPLEMENTED; P0)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.controller.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/api.ts`. API/route evidence: /tenant/finance.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/modules/tenant/finance/receivables/invoices/entities/invoice.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Allocation and reversal paths exist; prove multi-invoice and suspense handling with GL reconciliation.
- **Dependency/acceptance:** Approve policy, configure scoped book, and apply migrations before posting. Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-29 — Credit and Debit Notes (NOT IMPLEMENTED; P1)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.controller.ts`.
- **Frontend/route:** No capability-specific UI found; `apps/insurance-portal-web/src/modules/tenant/finance/api.ts`. API/route evidence: /tenant/finance.
- **Database:** No capability-specific table found; `apps/insurance-portal-service/src/modules/tenant/finance/receivables/invoices/entities/invoice.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build governed credit/debit note documents and tax/ledger effects.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-30 — Refund Management (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.controller.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/api.ts`. API/route evidence: /tenant/finance.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/modules/tenant/finance/receivables/invoices/entities/invoice.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Request/approve/pay/cancel APIs and UI exist; verify provider execution and accounting reversal.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-31 — Outstanding Premiums (BACKEND ONLY; P1)

- **Existing/backend:** Present (runtime unverified). Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.controller.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/api.ts`. API/route evidence: /tenant/finance.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/modules/tenant/finance/receivables/invoices/entities/invoice.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Invoice balance service exists; add aging and collections worklist UI.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-32 — Installment Management (NOT IMPLEMENTED; P1)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.controller.ts`.
- **Frontend/route:** No capability-specific UI found; `apps/insurance-portal-web/src/modules/tenant/finance/api.ts`. API/route evidence: /tenant/finance.
- **Database:** No capability-specific table found; `apps/insurance-portal-service/src/modules/tenant/finance/receivables/invoices/entities/invoice.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build installment schedules, due dates, allocation, arrears, and policy consequences.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-33 — Broker and Agent Receivables (NOT IMPLEMENTED; P1)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.controller.ts`.
- **Frontend/route:** No capability-specific UI found; `apps/insurance-portal-web/src/modules/tenant/finance/api.ts`. API/route evidence: /tenant/finance.
- **Database:** No capability-specific table found; `apps/insurance-portal-service/src/modules/tenant/finance/receivables/invoices/entities/invoice.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build intermediary subledger, statements, allocation, and settlement reconciliation.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-34 — Accounts Payable (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/payables/outgoing-payments/finance-outgoing.service.ts`.
- **Frontend/route:** No dedicated UI found; None found. API/route evidence: Foundation API only.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1797500000000-FinanceOutgoingCashControls.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. No capability-specific test verified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Outgoing obligation controls exist; full supplier AP subledger and aging are absent.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-35 — Supplier Management (NOT IMPLEMENTED; P1)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/payables/outgoing-payments/finance-outgoing.service.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: Foundation API only.
- **Database:** No capability-specific table found; `apps/insurance-portal-service/src/database/migrations/1797500000000-FinanceOutgoingCashControls.ts`. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build supplier master with beneficiary validation, approvals, and change audit.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-36 — Supplier Invoices (NOT IMPLEMENTED; P1)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/payables/outgoing-payments/finance-outgoing.service.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: Foundation API only.
- **Database:** No capability-specific table found; `apps/insurance-portal-service/src/database/migrations/1797500000000-FinanceOutgoingCashControls.ts`. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build invoice capture, duplicate checks, matching, approvals, and AP posting.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-37 — Expense Management (NOT IMPLEMENTED; P1)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/payables/outgoing-payments/finance-outgoing.service.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: Foundation API only.
- **Database:** No capability-specific table found; `apps/insurance-portal-service/src/database/migrations/1797500000000-FinanceOutgoingCashControls.ts`. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build expense coding, evidence, approval, tax, and posting.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-38 — Payment Vouchers (NOT IMPLEMENTED; P1)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/payables/outgoing-payments/finance-outgoing.service.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: Foundation API only.
- **Database:** No capability-specific table found; `apps/insurance-portal-service/src/database/migrations/1797500000000-FinanceOutgoingCashControls.ts`. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build numbered vouchers linked to approved obligations and payment evidence.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-39 — Payment Disbursements (PARTIALLY IMPLEMENTED; P0)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/payables/outgoing-payments/finance-outgoing.service.ts`.
- **Frontend/route:** No dedicated UI found; None found. API/route evidence: Foundation API only.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1797500000000-FinanceOutgoingCashControls.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. No capability-specific test verified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Outgoing intent and bank evidence controls exist; no concrete payment execution adapter is wired.
- **Dependency/acceptance:** Approve policy, configure scoped book, and apply migrations before posting. Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-40 — Petty Cash (NOT IMPLEMENTED; P1)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/payables/outgoing-payments/finance-outgoing.service.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: Foundation API only.
- **Database:** No capability-specific table found; `apps/insurance-portal-service/src/database/migrations/1797500000000-FinanceOutgoingCashControls.ts`. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build custodian balances, imprest replenishment, receipts, and reconciliation.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-41 — Employee Reimbursements (NOT IMPLEMENTED; P1)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/payables/outgoing-payments/finance-outgoing.service.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: Foundation API only.
- **Database:** No capability-specific table found; `apps/insurance-portal-service/src/database/migrations/1797500000000-FinanceOutgoingCashControls.ts`. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build claims, evidence, approval, beneficiary checks, and payment.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-42 — Budget Management (NOT IMPLEMENTED; P1)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/payables/outgoing-payments/finance-outgoing.service.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: Foundation API only.
- **Database:** No capability-specific table found; `apps/insurance-portal-service/src/database/migrations/1797500000000-FinanceOutgoingCashControls.ts`. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build versioned budgets by period, company, branch, and dimension.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-43 — Budgetary Controls (NOT IMPLEMENTED; P1)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/payables/outgoing-payments/finance-outgoing.service.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: Foundation API only.
- **Database:** No capability-specific table found; `apps/insurance-portal-service/src/database/migrations/1797500000000-FinanceOutgoingCashControls.ts`. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build commitment and spend checks against approved budgets.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-44 — Fixed Assets (NOT IMPLEMENTED; P1)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/payables/outgoing-payments/finance-outgoing.service.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: Foundation API only.
- **Database:** No capability-specific table found; `apps/insurance-portal-service/src/database/migrations/1797500000000-FinanceOutgoingCashControls.ts`. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build asset register, capitalization, depreciation, disposal, and GL tie-out.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-45 — Procurement Finance (NOT IMPLEMENTED; P1)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/payables/outgoing-payments/finance-outgoing.service.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: Foundation API only.
- **Database:** No capability-specific table found; `apps/insurance-portal-service/src/database/migrations/1797500000000-FinanceOutgoingCashControls.ts`. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build purchase-order matching, commitments, accruals, and supplier settlement.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-46 — Policy Financial Ledger (PARTIALLY IMPLEMENTED; P0)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/policy-transactions/services/policy-transaction-invoice.service.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/pages/FinanceInvoicesPage.tsx`. API/route evidence: Policy transaction routes.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/modules/tenant/finance/receivables/invoices/entities/invoice.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. No capability-specific test verified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Policy payment projections exist; build a complete policy-level financial subledger.
- **Dependency/acceptance:** Approve policy, configure scoped book, and apply migrations before posting. Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-47 — Premium Adjustments (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/policy-transactions/services/policy-transaction-invoice.service.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/pages/FinanceInvoicesPage.tsx`. API/route evidence: Policy transaction routes.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/modules/tenant/finance/receivables/invoices/entities/invoice.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. No capability-specific test verified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Endorsement repricing and return-premium paths exist; prove every adjustment and tax reversal ties out.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-48 — Commission Accounting (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/payables/commission-controls/finance-commission.service.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/pages/FinanceCommissionPaymentsPage.tsx`. API/route evidence: /tenant/finance/commission-*.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1797700000000-FinanceCommissionControls.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Accrual and reviewed movement controls exist; complete policy-approved posting and reconciliation.
- **Dependency/acceptance:** Approve policy, configure scoped book, and apply migrations before posting. Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-49 — Commission Settlement (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/payables/commission-controls/finance-commission.service.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/pages/FinanceCommissionPaymentsPage.tsx`. API/route evidence: /tenant/finance/commission-*.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1797700000000-FinanceCommissionControls.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Settlement commands and UI exist; verify external execution and cash reconciliation.
- **Dependency/acceptance:** Approve policy, configure scoped book, and apply migrations before posting. Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-50 — Claims Financial Accounting (PARTIALLY IMPLEMENTED; P0)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/claims/services/claim-disbursement.service.ts`.
- **Frontend/route:** No dedicated UI found; None found. API/route evidence: Claims finance routes.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1797900000000-FinanceClaimsControls.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Claim controls and disbursement journals exist; complete reserve-to-GL recognition.
- **Dependency/acceptance:** Approve policy, configure scoped book, and apply migrations before posting. Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-51 — Claims Settlement Finance (PARTIALLY IMPLEMENTED; P0)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/claims/services/claim-disbursement.service.ts`.
- **Frontend/route:** No dedicated UI found; None found. API/route evidence: Claims finance routes.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1797900000000-FinanceClaimsControls.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Claim disbursement service posts gated journals; verify payment provider and bank settlement.
- **Dependency/acceptance:** Approve policy, configure scoped book, and apply migrations before posting. Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-52 — Claims Recoveries (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/claims/services/claim-disbursement.service.ts`.
- **Frontend/route:** No dedicated UI found; None found. API/route evidence: Claims finance routes.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1797900000000-FinanceClaimsControls.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Recovery receipt controls and journal path exist; complete recoverable subledger reconciliation.
- **Dependency/acceptance:** Approve policy, configure scoped book, and apply migrations before posting. Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-53 — Reinsurance Premium Accounting (PARTIALLY IMPLEMENTED; P0)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/reinsurance/services/reinsurance-settlement.service.ts`.
- **Frontend/route:** No dedicated UI found; None found. API/route evidence: Reinsurance routes.
- **Database:** No dedicated structure verified; None found. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. No capability-specific test verified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Reinsurance accounting service exists; validate ceded premium recognition and ledger bridge.
- **Dependency/acceptance:** Approve policy, configure scoped book, and apply migrations before posting. Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-54 — Reinsurance Claims Accounting (PARTIALLY IMPLEMENTED; P0)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/reinsurance/services/reinsurance-settlement.service.ts`.
- **Frontend/route:** No dedicated UI found; None found. API/route evidence: Reinsurance routes.
- **Database:** No dedicated structure verified; None found. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. No capability-specific test verified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Settlement journal path exists; reconcile claims recoverable recognition to cash.
- **Dependency/acceptance:** Approve policy, configure scoped book, and apply migrations before posting. Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-55 — Reinsurance Statements (NOT IMPLEMENTED; P1)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/reinsurance/services/reinsurance-settlement.service.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: Reinsurance routes.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build treaty/facultative statements with balances, cash calls, and counterpart confirmation.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-56 — Insurance Technical Balances (NOT IMPLEMENTED; P1)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/reinsurance/services/reinsurance-settlement.service.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: Reinsurance routes.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build premium, claims, reserve, commission, and ceded technical balance rollforwards.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-57 — Insurance Financial Reconciliation (PARTIALLY IMPLEMENTED; P0)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/reconciliation/payment-reconciliation/reconciliation.service.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/pages/FinanceReconciliationPage.tsx`. API/route evidence: /tenant/finance/reconciliation-batches.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/modules/tenant/finance/reconciliation/reconciliation-batches/entities/finance-reconciliation-batch.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Payment batches exist; add cross-ledger insurance source-to-GL reconciliation.
- **Dependency/acceptance:** Approve policy, configure scoped book, and apply migrations before posting. Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-58 — IFRS 17 Configuration (NOT IMPLEMENTED; P2)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.module.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No IFRS 17 Finance route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build approved IFRS 17 policies, portfolios, methods, assumptions, and disclosures.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-59 — Contract Classification (NOT IMPLEMENTED; P2)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.module.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No IFRS 17 Finance route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build insurance contract and investment component classification.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-60 — Contract Grouping (NOT IMPLEMENTED; P2)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.module.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No IFRS 17 Finance route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build portfolios, annual cohorts, and profitability groups.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-61 — Measurement Models (NOT IMPLEMENTED; P2)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.module.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No IFRS 17 Finance route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build GMM, PAA, and VFA eligibility and measurement.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-62 — Insurance Cash Flows (NOT IMPLEMENTED; P2)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.module.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No IFRS 17 Finance route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build fulfilment cash-flow projections and experience adjustments.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-63 — Discount Rate Management (NOT IMPLEMENTED; P2)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.module.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No IFRS 17 Finance route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build governed yield curves, locked rates, and sensitivity history.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-64 — Risk Adjustment (NOT IMPLEMENTED; P2)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.module.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No IFRS 17 Finance route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build risk adjustment methodology, calculation, and disclosure.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-65 — Contractual Service Margin (NOT IMPLEMENTED; P2)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.module.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No IFRS 17 Finance route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build initial CSM, rollforward, and coverage-unit release.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-66 — Liability for Remaining Coverage (NOT IMPLEMENTED; P2)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.module.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No IFRS 17 Finance route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build LRC measurement and reconciliation.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-67 — Liability for Incurred Claims (NOT IMPLEMENTED; P2)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.module.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No IFRS 17 Finance route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build LIC measurement including discounting and risk adjustment.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-68 — Loss Components (NOT IMPLEMENTED; P2)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.module.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No IFRS 17 Finance route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build onerous group loss component recognition and reversal.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-69 — Reinsurance Held Measurement (NOT IMPLEMENTED; P2)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.module.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No IFRS 17 Finance route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build reinsurance held groups and recovery components.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-70 — IFRS 17 Accounting Engine (NOT IMPLEMENTED; P2)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.module.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No IFRS 17 Finance route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build subledger journal generation and audited reconciliation.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-71 — IFRS 17 Reporting (NOT IMPLEMENTED; P2)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.module.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No IFRS 17 Finance route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build IFRS 17 rollforwards, disclosures, and statement mapping.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-72 — Bank Account Management (NOT IMPLEMENTED; P2)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.module.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No treasury Finance route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build scoped bank account master, signatories, and account validation.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-73 — Cash Management (PARTIALLY IMPLEMENTED; P2)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/reconciliation/payment-reconciliation/reconciliation.service.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/pages/FinanceReconciliationPage.tsx`. API/route evidence: /tenant/finance/reconciliation-batches.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/modules/tenant/finance/reconciliation/reconciliation-batches/entities/finance-reconciliation-batch.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Receipts and disbursement evidence exist; build daily cash position and controls.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-74 — Bank Reconciliation (PARTIALLY IMPLEMENTED; P0)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/reconciliation/payment-reconciliation/reconciliation.service.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/pages/FinanceReconciliationPage.tsx`. API/route evidence: /tenant/finance/reconciliation-batches.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/modules/tenant/finance/reconciliation/reconciliation-batches/entities/finance-reconciliation-batch.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Reconciliation batches exist; verify bank statement import and GL bank-account tie-out.
- **Dependency/acceptance:** Approve policy, configure scoped book, and apply migrations before posting. Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-75 — Payment Reconciliation (NOT VERIFIED; P0)

- **Existing/backend:** Present (runtime unverified). Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/reconciliation/payment-reconciliation/reconciliation.service.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/pages/FinanceReconciliationPage.tsx`. API/route evidence: /tenant/finance/reconciliation-batches.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/modules/tenant/finance/reconciliation/reconciliation-batches/entities/finance-reconciliation-batch.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Matching, approval, and posting APIs/UI exist; live statement and settlement verification is absent.
- **Dependency/acceptance:** Approve policy, configure scoped book, and apply migrations before posting. Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-76 — Treasury Management (NOT IMPLEMENTED; P2)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.module.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No treasury Finance route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build liquidity positions, transfers, limits, and approval controls.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-77 — Cash Flow Forecasting (NOT IMPLEMENTED; P2)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.module.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No treasury Finance route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build forecast drivers, horizons, and variance tracking.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-78 — Investment Accounting (NOT IMPLEMENTED; P2)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.module.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No treasury Finance route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build investment positions, income, impairment, and ledger events.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-79 — Investment Valuation (NOT IMPLEMENTED; P2)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.module.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No treasury Finance route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build valuation inputs, fair-value hierarchy, and controls.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-80 — Foreign Exchange Accounting (PARTIALLY IMPLEMENTED; P0)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/foundation/finance-foundation.controller.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/foundation/FinanceFoundationPage.tsx`. API/route evidence: /tenant/finance/foundation.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1797200000000-FinanceLedgerFoundation.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Rate and currency context exist; legacy posting holds nonfunctional-currency journals.
- **Dependency/acceptance:** Approve policy, configure scoped book, and apply migrations before posting. Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-81 — Bank Integration (NOT IMPLEMENTED; P2)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.module.ts`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No treasury Finance route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build signed bank statement and payment transport adapters with reconciliation.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-82 — Tax Configuration (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/taxation/tax-calculation/premium-invoice-tax.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/taxes/TaxesPage.tsx`. API/route evidence: /tenant/taxes.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/modules/tenant/taxes/entities/tax.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Tax catalog and setup rules exist; approve effective-dated finance tax policy.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-83 — Tax Calculation (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/taxation/tax-calculation/premium-invoice-tax.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/taxes/TaxesPage.tsx`. API/route evidence: /tenant/taxes.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/modules/tenant/taxes/entities/tax.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Premium and endorsement tax calculations exist; verify all product and reversal cases.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-84 — VAT Management (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/taxation/tax-calculation/premium-invoice-tax.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/taxes/TaxesPage.tsx`. API/route evidence: /tenant/taxes.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/modules/tenant/taxes/entities/tax.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Invoice tax breakdown exists; build VAT ledger, returns, and reconciliation.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-85 — Withholding Tax (NOT IMPLEMENTED; P2)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/taxation/tax-calculation/premium-invoice-tax.ts`.
- **Frontend/route:** No capability-specific UI found; `apps/insurance-portal-web/src/modules/tenant/taxes/TaxesPage.tsx`. API/route evidence: /tenant/taxes.
- **Database:** No capability-specific table found; `apps/insurance-portal-service/src/modules/tenant/taxes/entities/tax.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build withholding rules, certificates, remittance, and ledger reporting.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-86 — Corporate Income Tax (NOT IMPLEMENTED; P2)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/taxation/tax-calculation/premium-invoice-tax.ts`.
- **Frontend/route:** No capability-specific UI found; `apps/insurance-portal-web/src/modules/tenant/taxes/TaxesPage.tsx`. API/route evidence: /tenant/taxes.
- **Database:** No capability-specific table found; `apps/insurance-portal-service/src/modules/tenant/taxes/entities/tax.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build current/deferred tax, computations, and return support.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-87 — Insurance Levies (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/regulatory-compliance/services/premium-levy-return.service.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/regulatory/pages/RegulatoryWorkbenchPage.tsx`. API/route evidence: Regulatory routes.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/modules/tenant/regulatory-compliance/entities/premium-levy-return.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Levy assessment and premium levy return services exist; validate current rules and remittance.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-88 — Stamp Duty (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/taxation/tax-calculation/premium-invoice-tax.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/taxes/TaxesPage.tsx`. API/route evidence: /tenant/taxes.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/modules/tenant/taxes/entities/tax.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Tax catalog can represent stamp duty; verify calculation, accounting, and statutory remittance.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-89 — Fiscal Documents (NOT IMPLEMENTED; P1)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/taxation/tax-calculation/premium-invoice-tax.ts`.
- **Frontend/route:** No capability-specific UI found; `apps/insurance-portal-web/src/modules/tenant/taxes/TaxesPage.tsx`. API/route evidence: /tenant/taxes.
- **Database:** No capability-specific table found; `apps/insurance-portal-service/src/modules/tenant/taxes/entities/tax.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build fiscal document numbering, issuance, corrections, and TRA integration as applicable.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-90 — Tax Reconciliation (NOT IMPLEMENTED; P1)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/taxation/tax-calculation/premium-invoice-tax.ts`.
- **Frontend/route:** No capability-specific UI found; `apps/insurance-portal-web/src/modules/tenant/taxes/TaxesPage.tsx`. API/route evidence: /tenant/taxes.
- **Database:** No capability-specific table found; `apps/insurance-portal-service/src/modules/tenant/taxes/entities/tax.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build tax subledger-to-GL and return reconciliation.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-91 — Tax Reporting (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/regulatory-compliance/services/premium-levy-return.service.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/regulatory/pages/RegulatoryWorkbenchPage.tsx`. API/route evidence: Regulatory routes.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/modules/tenant/regulatory-compliance/entities/premium-levy-return.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Premium levy return exists; build complete tax return set and exports.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-92 — Trial Balance (BACKEND ONLY; P1)

- **Existing/backend:** Present (runtime unverified). Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/foundation/finance-foundation.controller.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/foundation/FinanceFoundationPage.tsx`. API/route evidence: /tenant/finance/foundation.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1797200000000-FinanceLedgerFoundation.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Trial-balance endpoint exists; add dedicated report UI and live period validation.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-93 — Income Statement (NOT IMPLEMENTED; P1)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/reporting/`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No dedicated Finance statement route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build governed P&L mapping, comparative periods, and drilldown.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-94 — Balance Sheet (NOT IMPLEMENTED; P1)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/reporting/`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No dedicated Finance statement route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build position statement mapping and balancing controls.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-95 — Cash Flow Statement (NOT IMPLEMENTED; P1)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/reporting/`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No dedicated Finance statement route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build IAS 7 cash-flow classification and reconciliation.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-96 — Statement of Changes in Equity (NOT IMPLEMENTED; P2)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/reporting/`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No dedicated Finance statement route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build equity movement rollforward and comparative statement.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-97 — Financial Statement Notes (NOT IMPLEMENTED; P2)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/reporting/`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No dedicated Finance statement route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build disclosure schedules and source traceability.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-98 — Management Reporting (PARTIALLY IMPLEMENTED; P2)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/reporting/`.
- **Frontend/route:** No dedicated UI found; None found. API/route evidence: No dedicated Finance statement route found.
- **Database:** No dedicated structure verified; None found. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. No capability-specific test verified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Generic reporting exists; build finance KPIs tied to governed books.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-99 — Regulatory Reporting (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/regulatory-compliance/services/premium-levy-return.service.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/regulatory/pages/RegulatoryWorkbenchPage.tsx`. API/route evidence: Regulatory routes.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/modules/tenant/regulatory-compliance/entities/premium-levy-return.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Regulatory workbench and returns exist; validate Finance mappings and TIRA templates.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-100 — Solvency and Capital Monitoring (NOT IMPLEMENTED; P2)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/regulatory-compliance/services/premium-levy-return.service.ts`.
- **Frontend/route:** No capability-specific UI found; `apps/insurance-portal-web/src/modules/tenant/regulatory/pages/RegulatoryWorkbenchPage.tsx`. API/route evidence: Regulatory routes.
- **Database:** No capability-specific table found; `apps/insurance-portal-service/src/modules/tenant/regulatory-compliance/entities/premium-levy-return.entity.ts`. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build capital resources, requirements, thresholds, and evidence.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-101 — Liquidity Reporting (NOT IMPLEMENTED; P2)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/reporting/`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No dedicated Finance statement route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build liquidity measures and stress views tied to cash/investments.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-102 — Financial Consolidation (NOT IMPLEMENTED; P2)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/reporting/`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No dedicated Finance statement route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build entity consolidation, FX translation, and eliminations.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-103 — Finance Dashboards (PARTIALLY IMPLEMENTED; P2)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/finance.controller.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/pages/FinanceDashboardPage.tsx`. API/route evidence: /apps/finance/dashboard.
- **Database:** No dedicated structure verified; None found. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. No capability-specific test verified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Dashboard route exists; add validated GL, cash, AP, AR, and close metrics.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-104 — Report Exports (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/foundation/finance-foundation.controller.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/foundation/FinanceFoundationPage.tsx`. API/route evidence: /tenant/finance/foundation.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1797200000000-FinanceLedgerFoundation.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Journal CSV export exists; add governed statement, tax, and regulatory exports.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-105 — Finance Permissions (PARTIALLY IMPLEMENTED; P0)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/governance/finance-approvals/finance-approval.service.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/setup/FinanceSetupPage.tsx`. API/route evidence: /tenant/finance/foundation.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1796400000000-FinanceApprovalGovernance.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Permission decorators and scoped authorities exist; test every role and cross-scope denial.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-106 — Financial Approvals (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/governance/finance-approvals/finance-approval.service.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/setup/FinanceSetupPage.tsx`. API/route evidence: /tenant/finance/foundation.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1796400000000-FinanceApprovalGovernance.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Approval mandates and decisions exist; extend to all transaction classes.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-107 — Accounting Policies (PARTIALLY IMPLEMENTED; P0)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/accounting/posting-rules/finance-posting-policy.service.ts`.
- **Frontend/route:** No dedicated UI found; None found. API/route evidence: Journal posting via FinanceJournalService.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1797100000000-FinancePolicyGovernance.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Policy records and releases exist; approved active policy deployment is not evidenced.
- **Dependency/acceptance:** Approve policy, configure scoped book, and apply migrations before posting. Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-108 — Internal Financial Controls (PARTIALLY IMPLEMENTED; P0)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/governance/finance-approvals/finance-approval.service.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/setup/FinanceSetupPage.tsx`. API/route evidence: /tenant/finance/foundation.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1796400000000-FinanceApprovalGovernance.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Scoped approvals, locks, and audit tables exist; complete control matrix and monitoring.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-109 — Financial Audit Trail (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/governance/finance-approvals/finance-approval.service.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/setup/FinanceSetupPage.tsx`. API/route evidence: /tenant/finance/foundation.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1796400000000-FinanceApprovalGovernance.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Multiple immutable/audit event tables exist; provide unified searchable trail.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-110 — Financial Document Management (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/foundation/finance-setup/finance-setup.service.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/setup/FinanceSetupPage.tsx`. API/route evidence: /tenant/finance/setup.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1797400000000-FinanceSetupReviews.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Insurance documents are imported into setup; bind all financial artifacts and retention rules.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-111 — Source Evidence Registry (PARTIALLY IMPLEMENTED; P0)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/integrations/source-evidence/finance-source-attestations.service.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/setup/FinanceSetupPage.tsx`. API/route evidence: /tenant/finance/setup/source-attestations.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1798300000000-FinanceSourceAttestationRegistry.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Attestation/receipt registry exists; deployment worker identity and keys are unverified.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-112 — Finance Event Processing (PARTIALLY IMPLEMENTED; P0)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/integrations/finance-events/finance-outbox.processor.ts`.
- **Frontend/route:** No dedicated UI found; None found. API/route evidence: Internal outbox and intake.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1796600000000-FinanceIntegrationReliability.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Outbox processor exists; it handles quotation payment events only and requires monitoring.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-113 — Financial Integrations (PARTIALLY IMPLEMENTED; P0)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/integrations/finance-events/finance-outbox.processor.ts`.
- **Frontend/route:** No dedicated UI found; None found. API/route evidence: Internal outbox and intake.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1796600000000-FinanceIntegrationReliability.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Quotation/policy and source delivery integration exists; bank/provider/GL coverage incomplete.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-114 — Finance Data Migration (PARTIALLY IMPLEMENTED; P1)

- **Existing/backend:** Partial. Evidence: `apps/insurance-portal-service/src/modules/tenant/finance/foundation/finance-foundation.controller.ts`.
- **Frontend/route:** Present; `apps/insurance-portal-web/src/modules/tenant/finance/foundation/FinanceFoundationPage.tsx`. API/route evidence: /tenant/finance/foundation.
- **Database:** Migration/entity in repository (application unverified); `apps/insurance-portal-service/src/database/migrations/1797200000000-FinanceLedgerFoundation.ts`. Applied migration: not checked.
- **Permissions/tests:** Finance or source-module permission; exact role coverage unverified. Related tests found; capability coverage unverified.
- **Verified behavior:** Source-level registration or logic only; live behavior not verified.
- **Gap and corrective action:** Opening/cutover controls exist; build validated legacy balance migration and reconciliation.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.

## FIN-115 — Financial Close Monitoring (NOT IMPLEMENTED; P1)

- **Existing/backend:** No substantive capability-specific implementation found. Evidence: `apps/insurance-portal-service/src/modules/tenant/reporting/`.
- **Frontend/route:** No capability-specific UI found; None found. API/route evidence: No dedicated Finance statement route found.
- **Database:** No capability-specific table found; None found. Applied migration: not checked.
- **Permissions/tests:** No dedicated permission verified. No capability-specific test verified.
- **Verified behavior:** No substantive working capability verified.
- **Gap and corrective action:** Build close status dashboard, exceptions, overdue tasks, and signoff evidence.
- **Dependency/acceptance:** Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.
