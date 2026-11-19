# Frontend and backend gaps

The web route/nav inventory is in `apps/insurance-portal-web/src/App.tsx:1126` and `apps/insurance-portal-web/src/components/layout/nav-config.ts:365`. Existing Finance UI covers foundation, setup, dashboard, invoices, payments, receipts, refunds, reconciliation, commissions, and journal lists/details. API calls are in `apps/insurance-portal-web/src/modules/tenant/finance/api.ts` plus foundation/setup clients. Browser workflows were not executed.

## Backend without a dedicated Finance page

- **FIN-13 Double-Entry Posting Engine:** Balanced posting code is guarded by approved release, active book, open period, and transaction.
- **FIN-14 Accounting Rules Engine:** Policy definitions and mapping checks exist; approved source-specific releases are not evidenced.
- **FIN-15 Accounting Events:** Event intake and previews exist; prove every production source event reaches exactly one accounting outcome.
- **FIN-31 Outstanding Premiums:** Invoice balance service exists; add aging and collections worklist UI.
- **FIN-34 Accounts Payable:** Outgoing obligation controls exist; full supplier AP subledger and aging are absent.
- **FIN-39 Payment Disbursements:** Outgoing intent and bank evidence controls exist; no concrete payment execution adapter is wired.
- **FIN-50 Claims Financial Accounting:** Claim controls and disbursement journals exist; complete reserve-to-GL recognition.
- **FIN-51 Claims Settlement Finance:** Claim disbursement service posts gated journals; verify payment provider and bank settlement.
- **FIN-52 Claims Recoveries:** Recovery receipt controls and journal path exist; complete recoverable subledger reconciliation.
- **FIN-53 Reinsurance Premium Accounting:** Reinsurance accounting service exists; validate ceded premium recognition and ledger bridge.
- **FIN-54 Reinsurance Claims Accounting:** Settlement journal path exists; reconcile claims recoverable recognition to cash.
- **FIN-92 Trial Balance:** Trial-balance endpoint exists; add dedicated report UI and live period validation.
- **FIN-98 Management Reporting:** Generic reporting exists; build finance KPIs tied to governed books.
- **FIN-107 Accounting Policies:** Policy records and releases exist; approved active policy deployment is not evidenced.
- **FIN-112 Finance Event Processing:** Outbox processor exists; it handles quotation payment events only and requires monitoring.
- **FIN-113 Financial Integrations:** Quotation/policy and source delivery integration exists; bank/provider/GL coverage incomplete.

## Screens and workflows to add or verify

- Aged AR and collection worklist, bank account and cash position, supplier AP, payment execution and bank statement import, tax reconciliation, trial balance and full statements, close workbench, IFRS 17 assumptions and rollforwards.
- Existing invoice, receipt, refund, commission, and reconciliation screens need live API, role, validation, error, and responsive checks; source presence alone does not prove they work.
- The dashboard sums only the first 100 invoices, receipts, refunds, and journals (`FinanceDashboardPage.tsx:13-50`), so its aggregate labels can understate actual totals. Replace client page sums with scoped aggregate endpoints.
- No `FRONTEND ONLY` capability was substantiated. Generic tax/regulatory pages are related modules, not a complete Finance backend.
