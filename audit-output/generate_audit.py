"""Read-only audit report assembly from the inspected repository evidence."""
from pathlib import Path
from collections import Counter
import csv, json

OUT = Path(__file__).parent
BASE = 'apps/insurance-portal-service/src/modules/tenant/finance/'
WEB = 'apps/insurance-portal-web/src/modules/tenant/finance/'
MIG = 'apps/insurance-portal-service/src/database/migrations/'

# Each line: id|name|primary status|evidence key|specific remaining requirement.
DATA = '''
01|Finance Setup|PARTIALLY IMPLEMENTED|setup|Reviewed setup exists; approve and deploy real company configuration and verify live scope.
02|Chart of Accounts|PARTIALLY IMPLEMENTED|foundation|Draft and retained chart controls exist; validate accepted chart and live account mappings.
03|Accounting Dimensions|PARTIALLY IMPLEMENTED|foundation|Reviewed dimension master exists; prove all source events populate governed dimensions.
04|Accounting Books|PARTIALLY IMPLEMENTED|foundation|Book entity and scope selection exist; certify active books and source-company mapping.
05|Accounting Periods|PARTIALLY IMPLEMENTED|foundation|Period documents and fences exist; verify close calendar and reopening controls in a deployed book.
06|Currency Management|PARTIALLY IMPLEMENTED|foundation|Currency contexts exist; validate functional and presentation currency policy for every book.
07|Exchange Rate Management|PARTIALLY IMPLEMENTED|foundation|Rate documents exist; add or verify approved rate source, effective-date coverage, and exception handling.
08|Opening Balances|PARTIALLY IMPLEMENTED|foundation|Opening and review workflow exists; certify a reconciled cutover opening for live posting.
09|Financial Numbering|PARTIALLY IMPLEMENTED|receivables|Invoice and journal identifiers exist; verify all finance document sequences and gap controls.
10|Finance Master Data|PARTIALLY IMPLEMENTED|setup|Legal entity and source maps exist; complete bank, supplier, tax, and accounting master data.
11|General Ledger|PARTIALLY IMPLEMENTED|foundation|Canonical ledger tables and reads exist; deployment and policy release must authorize live posting.
12|Journal Management|PARTIALLY IMPLEMENTED|foundation|Candidates, approvals, validations, and journal reads exist; finish controlled operational journal workflow.
13|Double-Entry Posting Engine|PARTIALLY IMPLEMENTED|posting|Balanced posting code is guarded by approved release, active book, open period, and transaction.
14|Accounting Rules Engine|PARTIALLY IMPLEMENTED|posting|Policy definitions and mapping checks exist; approved source-specific releases are not evidenced.
15|Accounting Events|PARTIALLY IMPLEMENTED|events|Event intake and previews exist; prove every production source event reaches exactly one accounting outcome.
16|Recurring Journals|NOT IMPLEMENTED|accounting|Build scheduled recurring journal templates, approvals, execution, and reversal policy.
17|Accruals and Prepayments|NOT IMPLEMENTED|accounting|Build governed accrual and amortization schedules with period posting.
18|Financial Allocations|INACTIVE|allocation|Allocation worker produces inactive previews only; release reviewed posting workflow after policy validation.
19|Intercompany Accounting|NOT IMPLEMENTED|accounting|Build paired company entries, due-to/due-from, elimination, and reconciliation.
20|Period-End Closing|PARTIALLY IMPLEMENTED|foundation|Period fences exist; add a complete close checklist, tie-outs, and signoff workflow.
21|Financial Adjustments|PARTIALLY IMPLEMENTED|foundation|Journal candidates and reversals exist; define controlled adjustment types and approvals.
22|Premium Billing|PARTIALLY IMPLEMENTED|quotation|Quotation and endorsement invoice paths exist; reconcile all premium changes to invoices and ledger.
23|Invoice Management|NOT VERIFIED|receivables|API and UI are present; live create/issue/void behavior and migration state were not verified.
24|Accounts Receivable|PARTIALLY IMPLEMENTED|receivables|Balances and controlled receivable requests exist; complete aged subledger and GL tie-out.
25|Premium Collections|PARTIALLY IMPLEMENTED|receivables|Manual/provider payment paths exist; no concrete provider adapter is registered.
26|Payment Transactions|PARTIALLY IMPLEMENTED|receivables|Transaction API/UI exists; verify provider settlement, idempotency, and live payment state.
27|Receipt Management|NOT VERIFIED|receivables|Post/reverse APIs and UI exist; live runtime and migration state were not verified.
28|Receipt Allocation|PARTIALLY IMPLEMENTED|receivables|Allocation and reversal paths exist; prove multi-invoice and suspense handling with GL reconciliation.
29|Credit and Debit Notes|NOT IMPLEMENTED|receivables|Build governed credit/debit note documents and tax/ledger effects.
30|Refund Management|PARTIALLY IMPLEMENTED|receivables|Request/approve/pay/cancel APIs and UI exist; verify provider execution and accounting reversal.
31|Outstanding Premiums|BACKEND ONLY|receivables|Invoice balance service exists; add aging and collections worklist UI.
32|Installment Management|NOT IMPLEMENTED|receivables|Build installment schedules, due dates, allocation, arrears, and policy consequences.
33|Broker and Agent Receivables|NOT IMPLEMENTED|receivables|Build intermediary subledger, statements, allocation, and settlement reconciliation.
34|Accounts Payable|PARTIALLY IMPLEMENTED|outgoing|Outgoing obligation controls exist; full supplier AP subledger and aging are absent.
35|Supplier Management|NOT IMPLEMENTED|outgoing|Build supplier master with beneficiary validation, approvals, and change audit.
36|Supplier Invoices|NOT IMPLEMENTED|outgoing|Build invoice capture, duplicate checks, matching, approvals, and AP posting.
37|Expense Management|NOT IMPLEMENTED|outgoing|Build expense coding, evidence, approval, tax, and posting.
38|Payment Vouchers|NOT IMPLEMENTED|outgoing|Build numbered vouchers linked to approved obligations and payment evidence.
39|Payment Disbursements|PARTIALLY IMPLEMENTED|outgoing|Outgoing intent and bank evidence controls exist; no concrete payment execution adapter is wired.
40|Petty Cash|NOT IMPLEMENTED|outgoing|Build custodian balances, imprest replenishment, receipts, and reconciliation.
41|Employee Reimbursements|NOT IMPLEMENTED|outgoing|Build claims, evidence, approval, beneficiary checks, and payment.
42|Budget Management|NOT IMPLEMENTED|outgoing|Build versioned budgets by period, company, branch, and dimension.
43|Budgetary Controls|NOT IMPLEMENTED|outgoing|Build commitment and spend checks against approved budgets.
44|Fixed Assets|NOT IMPLEMENTED|outgoing|Build asset register, capitalization, depreciation, disposal, and GL tie-out.
45|Procurement Finance|NOT IMPLEMENTED|outgoing|Build purchase-order matching, commitments, accruals, and supplier settlement.
46|Policy Financial Ledger|PARTIALLY IMPLEMENTED|policy|Policy payment projections exist; build a complete policy-level financial subledger.
47|Premium Adjustments|PARTIALLY IMPLEMENTED|policy|Endorsement repricing and return-premium paths exist; prove every adjustment and tax reversal ties out.
48|Commission Accounting|PARTIALLY IMPLEMENTED|commission|Accrual and reviewed movement controls exist; complete policy-approved posting and reconciliation.
49|Commission Settlement|PARTIALLY IMPLEMENTED|commission|Settlement commands and UI exist; verify external execution and cash reconciliation.
50|Claims Financial Accounting|PARTIALLY IMPLEMENTED|claims|Claim controls and disbursement journals exist; complete reserve-to-GL recognition.
51|Claims Settlement Finance|PARTIALLY IMPLEMENTED|claims|Claim disbursement service posts gated journals; verify payment provider and bank settlement.
52|Claims Recoveries|PARTIALLY IMPLEMENTED|claims|Recovery receipt controls and journal path exist; complete recoverable subledger reconciliation.
53|Reinsurance Premium Accounting|PARTIALLY IMPLEMENTED|reinsurance|Reinsurance accounting service exists; validate ceded premium recognition and ledger bridge.
54|Reinsurance Claims Accounting|PARTIALLY IMPLEMENTED|reinsurance|Settlement journal path exists; reconcile claims recoverable recognition to cash.
55|Reinsurance Statements|NOT IMPLEMENTED|reinsurance|Build treaty/facultative statements with balances, cash calls, and counterpart confirmation.
56|Insurance Technical Balances|NOT IMPLEMENTED|reinsurance|Build premium, claims, reserve, commission, and ceded technical balance rollforwards.
57|Insurance Financial Reconciliation|PARTIALLY IMPLEMENTED|reconciliation|Payment batches exist; add cross-ledger insurance source-to-GL reconciliation.
58|IFRS 17 Configuration|NOT IMPLEMENTED|ifrs|Build approved IFRS 17 policies, portfolios, methods, assumptions, and disclosures.
59|Contract Classification|NOT IMPLEMENTED|ifrs|Build insurance contract and investment component classification.
60|Contract Grouping|NOT IMPLEMENTED|ifrs|Build portfolios, annual cohorts, and profitability groups.
61|Measurement Models|NOT IMPLEMENTED|ifrs|Build GMM, PAA, and VFA eligibility and measurement.
62|Insurance Cash Flows|NOT IMPLEMENTED|ifrs|Build fulfilment cash-flow projections and experience adjustments.
63|Discount Rate Management|NOT IMPLEMENTED|ifrs|Build governed yield curves, locked rates, and sensitivity history.
64|Risk Adjustment|NOT IMPLEMENTED|ifrs|Build risk adjustment methodology, calculation, and disclosure.
65|Contractual Service Margin|NOT IMPLEMENTED|ifrs|Build initial CSM, rollforward, and coverage-unit release.
66|Liability for Remaining Coverage|NOT IMPLEMENTED|ifrs|Build LRC measurement and reconciliation.
67|Liability for Incurred Claims|NOT IMPLEMENTED|ifrs|Build LIC measurement including discounting and risk adjustment.
68|Loss Components|NOT IMPLEMENTED|ifrs|Build onerous group loss component recognition and reversal.
69|Reinsurance Held Measurement|NOT IMPLEMENTED|ifrs|Build reinsurance held groups and recovery components.
70|IFRS 17 Accounting Engine|NOT IMPLEMENTED|ifrs|Build subledger journal generation and audited reconciliation.
71|IFRS 17 Reporting|NOT IMPLEMENTED|ifrs|Build IFRS 17 rollforwards, disclosures, and statement mapping.
72|Bank Account Management|NOT IMPLEMENTED|treasury|Build scoped bank account master, signatories, and account validation.
73|Cash Management|PARTIALLY IMPLEMENTED|reconciliation|Receipts and disbursement evidence exist; build daily cash position and controls.
74|Bank Reconciliation|PARTIALLY IMPLEMENTED|reconciliation|Reconciliation batches exist; verify bank statement import and GL bank-account tie-out.
75|Payment Reconciliation|NOT VERIFIED|reconciliation|Matching, approval, and posting APIs/UI exist; live statement and settlement verification is absent.
76|Treasury Management|NOT IMPLEMENTED|treasury|Build liquidity positions, transfers, limits, and approval controls.
77|Cash Flow Forecasting|NOT IMPLEMENTED|treasury|Build forecast drivers, horizons, and variance tracking.
78|Investment Accounting|NOT IMPLEMENTED|treasury|Build investment positions, income, impairment, and ledger events.
79|Investment Valuation|NOT IMPLEMENTED|treasury|Build valuation inputs, fair-value hierarchy, and controls.
80|Foreign Exchange Accounting|PARTIALLY IMPLEMENTED|foundation|Rate and currency context exist; legacy posting holds nonfunctional-currency journals.
81|Bank Integration|NOT IMPLEMENTED|treasury|Build signed bank statement and payment transport adapters with reconciliation.
82|Tax Configuration|PARTIALLY IMPLEMENTED|tax|Tax catalog and setup rules exist; approve effective-dated finance tax policy.
83|Tax Calculation|PARTIALLY IMPLEMENTED|tax|Premium and endorsement tax calculations exist; verify all product and reversal cases.
84|VAT Management|PARTIALLY IMPLEMENTED|tax|Invoice tax breakdown exists; build VAT ledger, returns, and reconciliation.
85|Withholding Tax|NOT IMPLEMENTED|tax|Build withholding rules, certificates, remittance, and ledger reporting.
86|Corporate Income Tax|NOT IMPLEMENTED|tax|Build current/deferred tax, computations, and return support.
87|Insurance Levies|PARTIALLY IMPLEMENTED|regulatory|Levy assessment and premium levy return services exist; validate current rules and remittance.
88|Stamp Duty|PARTIALLY IMPLEMENTED|tax|Tax catalog can represent stamp duty; verify calculation, accounting, and statutory remittance.
89|Fiscal Documents|NOT IMPLEMENTED|tax|Build fiscal document numbering, issuance, corrections, and TRA integration as applicable.
90|Tax Reconciliation|NOT IMPLEMENTED|tax|Build tax subledger-to-GL and return reconciliation.
91|Tax Reporting|PARTIALLY IMPLEMENTED|regulatory|Premium levy return exists; build complete tax return set and exports.
92|Trial Balance|BACKEND ONLY|foundation|Trial-balance endpoint exists; add dedicated report UI and live period validation.
93|Income Statement|NOT IMPLEMENTED|reporting|Build governed P&L mapping, comparative periods, and drilldown.
94|Balance Sheet|NOT IMPLEMENTED|reporting|Build position statement mapping and balancing controls.
95|Cash Flow Statement|NOT IMPLEMENTED|reporting|Build IAS 7 cash-flow classification and reconciliation.
96|Statement of Changes in Equity|NOT IMPLEMENTED|reporting|Build equity movement rollforward and comparative statement.
97|Financial Statement Notes|NOT IMPLEMENTED|reporting|Build disclosure schedules and source traceability.
98|Management Reporting|PARTIALLY IMPLEMENTED|reporting|Generic reporting exists; build finance KPIs tied to governed books.
99|Regulatory Reporting|PARTIALLY IMPLEMENTED|regulatory|Regulatory workbench and returns exist; validate Finance mappings and TIRA templates.
100|Solvency and Capital Monitoring|NOT IMPLEMENTED|regulatory|Build capital resources, requirements, thresholds, and evidence.
101|Liquidity Reporting|NOT IMPLEMENTED|reporting|Build liquidity measures and stress views tied to cash/investments.
102|Financial Consolidation|NOT IMPLEMENTED|reporting|Build entity consolidation, FX translation, and eliminations.
103|Finance Dashboards|PARTIALLY IMPLEMENTED|dashboard|Dashboard route exists; add validated GL, cash, AP, AR, and close metrics.
104|Report Exports|PARTIALLY IMPLEMENTED|foundation|Journal CSV export exists; add governed statement, tax, and regulatory exports.
105|Finance Permissions|PARTIALLY IMPLEMENTED|governance|Permission decorators and scoped authorities exist; test every role and cross-scope denial.
106|Financial Approvals|PARTIALLY IMPLEMENTED|governance|Approval mandates and decisions exist; extend to all transaction classes.
107|Accounting Policies|PARTIALLY IMPLEMENTED|posting|Policy records and releases exist; approved active policy deployment is not evidenced.
108|Internal Financial Controls|PARTIALLY IMPLEMENTED|governance|Scoped approvals, locks, and audit tables exist; complete control matrix and monitoring.
109|Financial Audit Trail|PARTIALLY IMPLEMENTED|governance|Multiple immutable/audit event tables exist; provide unified searchable trail.
110|Financial Document Management|PARTIALLY IMPLEMENTED|setup|Insurance documents are imported into setup; bind all financial artifacts and retention rules.
111|Source Evidence Registry|PARTIALLY IMPLEMENTED|evidence|Attestation/receipt registry exists; deployment worker identity and keys are unverified.
112|Finance Event Processing|PARTIALLY IMPLEMENTED|events|Outbox processor exists; it handles quotation payment events only and requires monitoring.
113|Financial Integrations|PARTIALLY IMPLEMENTED|events|Quotation/policy and source delivery integration exists; bank/provider/GL coverage incomplete.
114|Finance Data Migration|PARTIALLY IMPLEMENTED|foundation|Opening/cutover controls exist; build validated legacy balance migration and reconciliation.
115|Financial Close Monitoring|NOT IMPLEMENTED|reporting|Build close status dashboard, exceptions, overdue tasks, and signoff evidence.
'''.strip()

EVIDENCE = {
'setup': (BASE+'foundation/finance-setup/finance-setup.service.ts', WEB+'setup/FinanceSetupPage.tsx', MIG+'1797400000000-FinanceSetupReviews.ts', '/tenant/finance/setup'),
'foundation': (BASE+'foundation/finance-foundation.controller.ts', WEB+'foundation/FinanceFoundationPage.tsx', MIG+'1797200000000-FinanceLedgerFoundation.ts', '/tenant/finance/foundation'),
'posting': (BASE+'accounting/posting-rules/finance-posting-policy.service.ts', '', MIG+'1797100000000-FinancePolicyGovernance.ts', 'Journal posting via FinanceJournalService'),
'accounting': (BASE+'accounting/finance-accounting.module.ts', '', '', 'No dedicated route found'),
'allocation': (BASE+'accounting/allocations/finance-allocation-scheduler.service.ts', WEB+'setup/AllocationReview.tsx', MIG+'1797800000000-FinanceRecurringAllocationPreviews.ts', '/tenant/finance/setup/allocation-previews'),
'events': (BASE+'integrations/finance-events/finance-outbox.processor.ts', '', MIG+'1796600000000-FinanceIntegrationReliability.ts', 'Internal outbox and intake'),
'receivables': (BASE+'finance.controller.ts', WEB+'api.ts', BASE+'receivables/invoices/entities/invoice.entity.ts', '/tenant/finance'),
'quotation': (BASE+'integrations/quotation-finance/quotation-invoice.service.ts', WEB+'pages/FinanceInvoicesPage.tsx', BASE+'receivables/invoices/entities/invoice.entity.ts', '/tenant/finance/invoices'),
'outgoing': (BASE+'payables/outgoing-payments/finance-outgoing.service.ts', '', MIG+'1797500000000-FinanceOutgoingCashControls.ts', 'Foundation API only'),
'policy': ('apps/insurance-portal-service/src/modules/tenant/policy-transactions/services/policy-transaction-invoice.service.ts', WEB+'pages/FinanceInvoicesPage.tsx', BASE+'receivables/invoices/entities/invoice.entity.ts', 'Policy transaction routes'),
'commission': (BASE+'payables/commission-controls/finance-commission.service.ts', WEB+'pages/FinanceCommissionPaymentsPage.tsx', MIG+'1797700000000-FinanceCommissionControls.ts', '/tenant/finance/commission-*'),
'claims': ('apps/insurance-portal-service/src/modules/tenant/claims/services/claim-disbursement.service.ts', '', MIG+'1797900000000-FinanceClaimsControls.ts', 'Claims finance routes'),
'reinsurance': ('apps/insurance-portal-service/src/modules/tenant/reinsurance/services/reinsurance-settlement.service.ts', '', '', 'Reinsurance routes'),
'reconciliation': (BASE+'reconciliation/payment-reconciliation/reconciliation.service.ts', WEB+'pages/FinanceReconciliationPage.tsx', BASE+'reconciliation/reconciliation-batches/entities/finance-reconciliation-batch.entity.ts', '/tenant/finance/reconciliation-batches'),
'ifrs': (BASE+'finance.module.ts', '', '', 'No IFRS 17 Finance route found'),
'treasury': (BASE+'finance.module.ts', '', '', 'No treasury Finance route found'),
'tax': (BASE+'taxation/tax-calculation/premium-invoice-tax.ts', 'apps/insurance-portal-web/src/modules/tenant/taxes/TaxesPage.tsx', 'apps/insurance-portal-service/src/modules/tenant/taxes/entities/tax.entity.ts', '/tenant/taxes'),
'regulatory': ('apps/insurance-portal-service/src/modules/tenant/regulatory-compliance/services/premium-levy-return.service.ts', 'apps/insurance-portal-web/src/modules/tenant/regulatory/pages/RegulatoryWorkbenchPage.tsx', 'apps/insurance-portal-service/src/modules/tenant/regulatory-compliance/entities/premium-levy-return.entity.ts', 'Regulatory routes'),
'reporting': ('apps/insurance-portal-service/src/modules/tenant/reporting/', '', '', 'No dedicated Finance statement route found'),
'dashboard': (BASE+'finance.controller.ts', WEB+'pages/FinanceDashboardPage.tsx', '', '/apps/finance/dashboard'),
'governance': (BASE+'governance/finance-approvals/finance-approval.service.ts', WEB+'setup/FinanceSetupPage.tsx', MIG+'1796400000000-FinanceApprovalGovernance.ts', '/tenant/finance/foundation'),
'evidence': (BASE+'integrations/source-evidence/finance-source-attestations.service.ts', WEB+'setup/FinanceSetupPage.tsx', MIG+'1798300000000-FinanceSourceAttestationRegistry.ts', '/tenant/finance/setup/source-attestations'),
}

rows=[]
for line in DATA.splitlines():
    no,name,status,key,gap=line.split('|',4)
    code=f'FIN-{no}'
    be,fe,db,api=EVIDENCE[key]
    if status=='NOT IMPLEMENTED':
        backend='No substantive capability-specific implementation found'
        frontend='No capability-specific UI found'
        database='No capability-specific table found'
    else:
        backend='Partial' if status in ('PARTIALLY IMPLEMENTED','INACTIVE') else 'Present (runtime unverified)'
        frontend='Present' if fe else 'No dedicated UI found'
        database='Migration/entity in repository (application unverified)' if db else 'No dedicated structure verified'
    tests='Related tests found; capability coverage unverified' if key in {'setup','foundation','posting','allocation','events','receivables','quotation','commission','claims','reconciliation','tax','regulatory','governance','evidence'} and status!='NOT IMPLEMENTED' else 'No capability-specific test verified'
    priority='P0' if int(no) in {11,13,14,22,25,28,39,46,50,51,53,54,57,74,75,80,105,107,108,111,112,113} else ('P1' if int(no)<58 or int(no) in {82,83,84,87,88,89,90,91,92,93,94,95,99,104,106,109,110,114,115} else 'P2')
    rows.append(dict(code=code,name=name,status=status,key=key,backend=backend,frontend=frontend,database=database,tests=tests,priority=priority,gap=gap,backend_file=be,frontend_file=fe,database_file=db,api=api))
assert len(rows)==115 and len({r['code'] for r in rows})==115

def put(name,body): (OUT/name).write_text(body.strip()+'\n',encoding='utf-8')
def link(p): return f'`{p}`' if p else 'None found'
counts=Counter(r['status'] for r in rows)
statuses=['IMPLEMENTED','PARTIALLY IMPLEMENTED','BACKEND ONLY','FRONTEND ONLY','INACTIVE','BROKEN','NOT IMPLEMENTED','NOT VERIFIED','NOT APPLICABLE']
count_table='\n'.join(f'| {s} | {counts[s]} | {counts[s]/115:.1%} |' for s in statuses)
put('FINANCE_AUDIT_EXECUTIVE_SUMMARY.md',f'''# Finance implementation audit — executive summary

Scope: repository at 18 November 2026. All 115 requested capabilities were classified once. Denominator for every percentage is 115. This is a static code and isolated unit-test audit; no production database, policy release, credentials, or running UI was inspected. `NOT VERIFIED` means an apparently connected path could not be proven operational. `INACTIVE` means an explicit gate or inactive preview is present; it does not imply production flags are currently off.

| Status | Count | Share |
|---|---:|---:|
{count_table}

No capability meets the strict `IMPLEMENTED` standard because live migration state, approved accounting policy, complete workflow, and runtime behavior are unverified. This does **not** mean the code is absent. The strongest operational candidates are invoice, receipt, and payment reconciliation workflows, classified `NOT VERIFIED` pending complete database end-to-end and deployment inspection. The full isolated PostgreSQL run timed out after 600 seconds and logged three stale module-registration assertions; see the test report.

## Key findings

- Finance is imported into the portal tenant module (`apps/insurance-portal-service/src/modules/tenant/tenant.module.ts:73`), and the portal data source loads portal entities and migrations (`apps/insurance-portal-service/src/database/data-source.options.ts:40`). No active `FINANCE_DATABASE_URL` runtime reference was found. Live database consolidation remains unverified.
- Posting is intentionally held unless a unique active policy release, active book/entity, open period, and transaction are present (`{EVIDENCE['posting'][0]}:22`). The canonical foundation also requires a reviewed opening (`{MIG}1797200000000-FinanceLedgerFoundation.ts:208`).
- Provider registry has an interface and webhook, but no concrete adapter registration was found (`{BASE}integrations/payment-providers/payment-provider.registry.ts:9`). Outgoing controls use an empty simulator binding (`{BASE}foundation/finance-foundation.module.ts:57`).
- The 14 IFRS 17 capabilities, general financial statements, supplier AP, budget, assets, investment, and treasury features lack substantive Finance implementation.

## Direct answers

1. Fully implemented: **{counts['IMPLEMENTED']}**.
2. Partially implemented: **{counts['PARTIALLY IMPLEMENTED']}**.
3. Inactive: **{counts['INACTIVE']}** (FIN-18's scheduler produces inactive previews). Other posting paths are *gated*, but deployment state was not inspected, so they are not counted inactive.
4. Broken: **{counts['BROKEN']} confirmed**. Runtime failures remain possible.
5. Completely missing: **{counts['NOT IMPLEMENTED']}**.
6. Ready for actual use: **none verified for production**. Invoice, receipt, and payment reconciliation paths are the nearest candidates, pending deployment and accounting signoff.
7. Backend needing dedicated frontend: FIN-31 and FIN-92 are classified `BACKEND ONLY`; additional partial workflows are listed in the frontend gap report.
8. Database changes: all 51 missing capabilities need schema design or explicit reuse decisions; new finance statements, AP, bank, investment, fixed asset, and IFRS 17 subledgers are the largest groups. Existing migration files also need live application verification.
9. Critical incomplete workflows: premium-to-GL, provider collection, claims/reinsurance-to-GL, outgoing settlement, bank-to-GL, and close.
10. Implement first: P0 policy/cutover and single-ledger controls, payment/bank adapters, and source-to-GL reconciliation.
11. Single database: **consolidated in source configuration**, **not verified against a live database**.
12. Operational completion requires approved accounting policies, applied migrations, configured adapters and workers, reconciled opening balances, end-to-end controls, missing subledgers and reports, and deployment validation.

See the matrix, detailed findings, architecture report, and roadmap for evidence and required work.''')

matrix='''# Finance implementation matrix

`Present` means code exists, not that the deployed system was proven to work. `Migration/entity` means checked into source, not applied. Tests column does not imply a pass for that capability. All runtime and production readiness flags are `No` and `Unknown`, respectively, until a deployment audit.

| Code | Finance capability | Backend | Frontend | Database | Tests | Overall status | Priority |
|---|---|---|---|---|---|---|---|
'''
for r in rows: matrix+=f"| {r['code']} | {r['name']} | {r['backend']} | {r['frontend']} | {r['database']} | {r['tests']} | {r['status']} | {r['priority']} |\n"
put('FINANCE_IMPLEMENTATION_MATRIX.md',matrix)

detailed='''# Detailed capability findings

Evidence paths below are starting points for the capability, not proof of every subfeature. A path to a parent module for a missing capability establishes that the capability was searched within the registered Finance surface. No database migration was assumed applied. All runtime verification is `No`; production ready is `Unknown` for every capability. Permissions are `FinancePermissions`/scoped authority where present; missing capabilities have no verified dedicated permission.

'''
for r in rows:
    no=int(r['code'][4:]); missing=r['status']=='NOT IMPLEMENTED'
    detailed+=f"## {r['code']} — {r['name']} ({r['status']}; {r['priority']})\n\n"
    detailed+=f"- **Existing/backend:** {r['backend']}. Evidence: {link(r['backend_file'])}.\n"
    detailed+=f"- **Frontend/route:** {r['frontend']}; {link(r['frontend_file'])}. API/route evidence: {r['api']}.\n"
    detailed+=f"- **Database:** {r['database']}; {link(r['database_file'])}. Applied migration: not checked.\n"
    detailed+=f"- **Permissions/tests:** {'No dedicated permission verified' if missing else 'Finance or source-module permission; exact role coverage unverified'}. {r['tests']}.\n"
    detailed+=f"- **Verified behavior:** {'No substantive working capability verified' if missing else 'Source-level registration or logic only; live behavior not verified'}.\n"
    detailed+=f"- **Gap and corrective action:** {r['gap']}\n"
    detailed+=f"- **Dependency/acceptance:** {'Approve policy, configure scoped book, and apply migrations before posting. ' if no in {11,13,14,18,22,25,28,39,46,48,49,50,51,52,53,54,57,74,75,80,107} else ''}Demonstrate the named workflow end to end for two companies and branches, with denial of cross-scope access, balanced or reconciled amounts where relevant, negative-path tests, and evidence in an isolated PostgreSQL environment.\n\n"
put('FINANCE_DETAILED_FINDINGS.md',detailed)

groups=[('Foundation',1,10),('Accounting',11,21),('Receivables',22,33),('Payables',34,45),('Insurance accounting',46,57),('IFRS 17',58,71),('Treasury',72,81),('Taxation',82,91),('Reporting',92,104),('Governance',105,115)]
missing='# Missing modules and capabilities\n\nAbsence is based on repository discovery, registered Finance modules, route inventory, and related source modules. These are implementation gaps, not a claim that the business scope has been approved.\n\n'
for title,a,b in groups:
    subset=[r for r in rows if a<=int(r['code'][4:])<=b and r['status']=='NOT IMPLEMENTED']
    missing+=f'## {title}\n\n'
    missing+='\n'.join(f"- **{r['code']} {r['name']}:** {r['gap']}" for r in subset) if subset else 'No capability classified as wholly missing.'
    missing+='\n\n'
put('FINANCE_MISSING_MODULES.md',missing)

part='# Partial, inactive, and broken functionality\n\n## Partially implemented\n\n'
part+='\n'.join(f"- **{r['code']} {r['name']}:** {r['gap']} Evidence: {link(r['backend_file'])}." for r in rows if r['status']=='PARTIALLY IMPLEMENTED')
part+='\n\n## Inactive or held\n\n'
part+='\n'.join(f"- **{r['code']} {r['name']}:** {r['gap']} Evidence: {link(r['backend_file'])}." for r in rows if r['status']=='INACTIVE')
part+='\n\n## Broken\n\nNo capability was classified `BROKEN`: the three observed PostgreSQL integration failures compare an obsolete expectation of no `FinanceFoundationController` against the current intentionally registered controller, so they establish test drift, not a failing finance transaction. The full run timed out before a complete Jest summary. See the test report. Do not enable posting before accounting policy and cutover validation.\n'
put('FINANCE_PARTIAL_AND_INACTIVE.md',part)

front='''# Frontend and backend gaps

The web route/nav inventory is in `apps/insurance-portal-web/src/App.tsx:1126` and `apps/insurance-portal-web/src/components/layout/nav-config.ts:365`. Existing Finance UI covers foundation, setup, dashboard, invoices, payments, receipts, refunds, reconciliation, commissions, and journal lists/details. API calls are in `apps/insurance-portal-web/src/modules/tenant/finance/api.ts` plus foundation/setup clients. Browser workflows were not executed.

## Backend without a dedicated Finance page

'''
front+='\n'.join(f"- **{r['code']} {r['name']}:** {r['gap']}" for r in rows if r['status']=='BACKEND ONLY' or (r['status']=='PARTIALLY IMPLEMENTED' and not r['frontend_file']))
front+='''

## Screens and workflows to add or verify

- Aged AR and collection worklist, bank account and cash position, supplier AP, payment execution and bank statement import, tax reconciliation, trial balance and full statements, close workbench, IFRS 17 assumptions and rollforwards.
- Existing invoice, receipt, refund, commission, and reconciliation screens need live API, role, validation, error, and responsive checks; source presence alone does not prove they work.
- The dashboard sums only the first 100 invoices, receipts, refunds, and journals (`FinanceDashboardPage.tsx:13-50`), so its aggregate labels can understate actual totals. Replace client page sums with scoped aggregate endpoints.
- No `FRONTEND ONLY` capability was substantiated. Generic tax/regulatory pages are related modules, not a complete Finance backend.
'''
put('FINANCE_FRONTEND_BACKEND_GAPS.md',front)

put('FINANCE_ARCHITECTURE_AND_DATABASE_AUDIT.md',f'''# Architecture and database audit

## Consolidation

- **Code-level single database: supported.** `FinanceModule` is imported by `tenant.module.ts:73`; `data-source.options.ts:17-43` reads portal `DB_*` and globs all portal entities plus `src/database/migrations`. Finance entities use default `TypeOrmModule.forFeature` or injected default `DataSource`. Portal migration scripts are in root `package.json`.
- **Live consolidation: not verified.** No connection to a safe target database was made. The `migrations` table, physical constraints, duplicate tables, and actual records were not inspected.
- **No separate active runtime found.** `package.json` start/build commands have portal and Tiramis only; archived files at `src/database/archive/finance-service/` refer to a retired `FINANCE_DATABASE_URL` but are outside the migration glob. A repository search found no active runtime dependency on it.
- **Authentication and isolation:** Finance controllers use `@TenantScoped`, `@Permissions`, `@CurrentUser`; foundation tables carry tenant/entity/book scope. Verify branch restrictions on every legacy read and cross-module repository access in end-to-end tests.

## Important architecture risks

- Two accounting representations coexist: legacy `finance_journal_entries` and canonical `finance_foundation_journals`. Posting policy holds the legacy path when the canonical foundation owns the book (`{EVIDENCE['posting'][0]}:60`). Prove one authoritative outcome per source event.
- `forwardRef` cycles remain between Finance, quotations, and policy transactions (`{BASE}integrations/finance-insurance-integration.module.ts:27`; `{BASE}receivables/finance-receivables.module.ts:68`).
- Several services reach across modules and use raw SQL. Review transaction manager propagation, row locks, idempotency keys, and scoped foreign keys before release. The controlled command path is in `{BASE}receivables/payment-transactions/finance-command.service.ts`.
- The legacy billing controller remains registered for some reads/writes, while its operations controller is deliberately not registered (`{BASE}receivables/finance-receivables.module.ts:94`). Verify the read-only guard on each write route.
- Provider registry has no concrete `register` call outside its own method; webhook integration cannot be considered configured. `OUTGOING_SIMULATORS` is bound to an empty array in foundation module.
- Source delivery and allocation worker IDs and attestation keys are blank examples in `.env.example:324-352`. The outbox defaults enabled (`src/config/env.validation.ts:206`), but deployment state and health are unknown.

## Premium collection trace

Quotation approval and invoice creation connect through `integrations/quotation-finance/quotation-invoice.service.ts`; issue/payment reference/payment confirmation/receipt/allocation are exposed by `finance.controller.ts:96-206` and orchestrated by `receivables/payment-transactions/finance-command.service.ts`. Quotation payment projection and outbox delivery are in `integrations/quotation-finance/quotation-payment-projection.service.ts` and `integrations/finance-events/finance-outbox.processor.ts`. Journal posting is in `accounting/journal-entries/finance-journal.service.ts` and held by `accounting/posting-rules/finance-posting-policy.service.ts`. The chain is connected in source, but a concrete provider adapter, approved release and cutover opening, deployed database state, and invoice-to-GL reconciliation were not established. A paid quotation is therefore not proof of recognized revenue or an authorized ledger posting.

Claims, reinsurance, commission, and outgoing cash have analogous source-to-control paths, but their settlement and ledger tie-outs remain unproven. Verify one accounting authority per event before activating any bridge.

## Data integrity checks needed

Run migration status against an approved disposable clone; inspect actual indexes/FKs and duplicate journal sources; reconcile invoice, receipt, claim, commission, reinsurance, and bank balances to the authorized ledger. No migration was applied during this audit.

## Standards and regulatory scope

| Standard or rule set | Source evidence | Remaining validation |
|---|---|---|
| IFRS 17 | No Finance IFRS 17 engine/measurement routes | Contract groups, cash flows, RA, CSM, LRC/LIC, reinsurance held, disclosures, accounting policy approval |
| IFRS 9 | No investment subledger | Classification, expected credit loss, fair value, impairment policy |
| IAS 21 | Currency/rate foundation and legacy FX hold | Functional currency, translation, realized/unrealized differences |
| IAS 12 | Tax catalog/calculation | Current/deferred income tax and reconciliation |
| IAS 16 | No asset module | Register, depreciation, impairment, disposal |
| IAS 7 | No Finance cash flow statement | Classification and cash reconciliation |
| IFRS 13 | No investment valuation module | Valuation hierarchy, market data, sensitivities |
| Statement presentation | Trial balance read only; statements absent | Approved mappings, comparative statements, notes |
| Tanzania/TIRA | Regulatory compliance services and workbench | Validate current templates, levies, solvency, and submission evidence with qualified local counsel/accountant |
| Tanzania/TRA | Tax configuration and calculation | Validate current VAT, withholding, fiscal document, and return obligations with qualified local counsel/accountant |

This is implementation coverage, not a legal or accounting compliance opinion. Regulatory interpretation and policy approval remain pending.
''')

put('FINANCE_TEST_COVERAGE.md','''# Finance test coverage and quality

The repository includes Finance unit specs under `src/modules/tenant/finance`, Finance integration specs under `test/finance`, and web tests under `src/modules/tenant/finance`. The integration runner (`test/finance/run-isolated-postgres.cjs`) creates a disposable PostgreSQL environment; it was not run as part of this source-level audit. The isolated unit test command and its actual result are recorded below after execution.

| Measure | Result |
|---|---|
| Test files discovered | 40 backend unit specs, 31 Finance PostgreSQL integration specs, 9 Finance web test files |
| Tests executed | 40 backend Finance unit suites, 504 tests |
| Passed / failed / skipped | 504 / 0 / 0 |
| Integration tests | Full 31-file run attempted in private PostgreSQL 17.4; timed out at 600 seconds. At least 3 failed assertions logged; complete pass/fail/skip counts unavailable. |
| Focused integration test | 1 suite, 4 tests passed; 0 failed/skipped in private PostgreSQL 17.4 |
| Frontend tests | 9 files, 63 tests passed; 0 failed |

Backend command: `npx jest --runInBand --no-cache --silent --testPathPatterns='apps/insurance-portal-service/src/modules/tenant/finance/.*\\.spec\\.ts$'`. Result: exit 0, 40 suites passed, 504 tests passed, 48.603 seconds. Web command from `apps/insurance-portal-web`: `npm test -- --run src/modules/tenant/finance`. Result: exit 0, 9 files passed, 63 tests passed, 19.90 seconds.

Full integration command: `node apps/insurance-portal-service/test/finance/run-isolated-postgres.cjs --evidence-dir audit-output/integration-evidence`. Private database started and stopped successfully; Jest exceeded the 600-second runner limit (`testProcessErrorCode: ETIMEDOUT`). Retained `jest-run.log` records three failed assertions in `finance-configuration.finance-integration.ts:634`, `finance-journal-candidate.finance-integration.ts:574`, and `finance-scope.finance-integration.ts:474`. Each expects `FinanceFoundationModule` controllers to equal `[]`, while `finance-foundation.module.ts` registers `FinanceFoundationController`. These are test drift relative to current module registration; no financial calculation failure was proven by these assertions. Full suite counts, other failures, skips, and regressions are unknown. Pre-existing versus newly introduced cannot be determined without a prior baseline. Evidence: `audit-output/integration-evidence/cluster-lifecycle.json` and `jest-run.log`.

Focused integration command: `node apps/insurance-portal-service/test/finance/run-isolated-postgres.cjs --test-file finance-database.finance-integration.ts --evidence-dir audit-output/integration-database-evidence`. Result: exit 0, one suite and four tests passed, zero failed/skipped; private cluster stopped. Evidence: `audit-output/integration-database-evidence/jest-results.json` and `cluster-lifecycle.json`.

Capability test presence in the matrix means a related test file exists. It does not prove complete coverage. Missing modules have no capability-specific tests. Priority negative cases: cross-tenant/company/branch isolation; duplicate provider/webhook delivery; over-allocation; concurrent refund; balanced journal and reversal; closed-period posting; stale source revision; payment/claim/reinsurance cash mismatch.
''')

phases=[('P0 — protect financial integrity','FIN-11, 13-15, 22-28, 39, 46, 48-54, 57, 74-75, 80, 105, 107-108, 111-113','Approve scoped policies/openings and verify one journal authority; register real payment/bank adapters; tie source events, cash, and GL.','Release only after isolated PostgreSQL, migration, concurrency, negative-path, and amount reconciliation tests.'),('P1 — operational subledgers','FIN-01-10, 12, 20-21, 29-34, 46-57, 72-75, 82-84, 87-92, 99, 104, 106, 109-110, 114-115','Finish AR/AP, claims/reinsurance/commission reconciliations, bank master, tax returns, trial balance UI, close controls.','Every source document traces to approved subledger and GL with maker/checker evidence.'),('P2 — statements and management','FIN-16-19, 35-45, 58-71, 76-79, 81, 85-86, 89-90, 93-98, 100-103','Build remaining AP, budget, asset, treasury, IFRS 17, consolidation, and financial reporting modules in dependency order.','Approved accounting interpretations and independently reconciled statements/reports.')]
road='# Prioritized implementation roadmap\n\nDo not activate live posting or recognition until accounting policy, scope, opening balances, and safeguards have been approved and independently verified. Each phase requires backend, frontend, database migration, configuration, test, and acceptance review.\n\n'
for title,ids,work,accept in phases:
    road+=f'## {title}\n\n- **Capabilities:** {ids}.\n- **Backend/frontend/database:** {work} Implement matched APIs and screens; add versioned migrations and scoped constraints for new records.\n- **Dependencies/configuration:** Portal DB migrations, signed authority and source evidence, approved policy and rate/tax configuration, provider credentials where applicable.\n- **Tests:** Unit rules, disposable PostgreSQL integration, authorization, concurrency, failure/retry, reconciliation, UI workflow, and export checks.\n- **Acceptance:** {accept}\n- **Risk:** duplicate journals, cross-scope access, wrong tax or insurance recognition, unreconciled cash.\n\n'
put('FINANCE_IMPLEMENTATION_ROADMAP.md',road)

with (OUT/'FINANCE_CAPABILITY_MATRIX.csv').open('w',newline='',encoding='utf-8') as f:
    fields=['code','name','backend','frontend','database','tests','status','priority','gap','backend_file','frontend_file','database_file','api']
    writer=csv.DictWriter(f,fieldnames=fields); writer.writeheader(); writer.writerows([{k:r[k] for k in fields} for r in rows])
print(dict(counts),len(rows))
