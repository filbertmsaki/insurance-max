# Finance implementation audit — executive summary

Scope: repository at 18 November 2026. All 115 requested capabilities were classified once. Denominator for every percentage is 115. This is a static code and isolated unit-test audit; no production database, policy release, credentials, or running UI was inspected. `NOT VERIFIED` means an apparently connected path could not be proven operational. `INACTIVE` means an explicit gate or inactive preview is present; it does not imply production flags are currently off.

| Status | Count | Share |
|---|---:|---:|
| IMPLEMENTED | 0 | 0.0% |
| PARTIALLY IMPLEMENTED | 58 | 50.4% |
| BACKEND ONLY | 2 | 1.7% |
| FRONTEND ONLY | 0 | 0.0% |
| INACTIVE | 1 | 0.9% |
| BROKEN | 0 | 0.0% |
| NOT IMPLEMENTED | 51 | 44.3% |
| NOT VERIFIED | 3 | 2.6% |
| NOT APPLICABLE | 0 | 0.0% |

No capability meets the strict `IMPLEMENTED` standard because live migration state, approved accounting policy, complete workflow, and runtime behavior are unverified. This does **not** mean the code is absent. The strongest operational candidates are invoice, receipt, and payment reconciliation workflows, classified `NOT VERIFIED` pending complete database end-to-end and deployment inspection. The full isolated PostgreSQL run timed out after 600 seconds and logged three stale module-registration assertions; see the test report.

## Key findings

- Finance is imported into the portal tenant module (`apps/insurance-portal-service/src/modules/tenant/tenant.module.ts:73`), and the portal data source loads portal entities and migrations (`apps/insurance-portal-service/src/database/data-source.options.ts:40`). No active `FINANCE_DATABASE_URL` runtime reference was found. Live database consolidation remains unverified.
- Posting is intentionally held unless a unique active policy release, active book/entity, open period, and transaction are present (`apps/insurance-portal-service/src/modules/tenant/finance/accounting/posting-rules/finance-posting-policy.service.ts:22`). The canonical foundation also requires a reviewed opening (`apps/insurance-portal-service/src/database/migrations/1797200000000-FinanceLedgerFoundation.ts:208`).
- Provider registry has an interface and webhook, but no concrete adapter registration was found (`apps/insurance-portal-service/src/modules/tenant/finance/integrations/payment-providers/payment-provider.registry.ts:9`). Outgoing controls use an empty simulator binding (`apps/insurance-portal-service/src/modules/tenant/finance/foundation/finance-foundation.module.ts:57`).
- The 14 IFRS 17 capabilities, general financial statements, supplier AP, budget, assets, investment, and treasury features lack substantive Finance implementation.

## Direct answers

1. Fully implemented: **0**.
2. Partially implemented: **58**.
3. Inactive: **1** (FIN-18's scheduler produces inactive previews). Other posting paths are *gated*, but deployment state was not inspected, so they are not counted inactive.
4. Broken: **0 confirmed**. Runtime failures remain possible.
5. Completely missing: **51**.
6. Ready for actual use: **none verified for production**. Invoice, receipt, and payment reconciliation paths are the nearest candidates, pending deployment and accounting signoff.
7. Backend needing dedicated frontend: FIN-31 and FIN-92 are classified `BACKEND ONLY`; additional partial workflows are listed in the frontend gap report.
8. Database changes: all 51 missing capabilities need schema design or explicit reuse decisions; new finance statements, AP, bank, investment, fixed asset, and IFRS 17 subledgers are the largest groups. Existing migration files also need live application verification.
9. Critical incomplete workflows: premium-to-GL, provider collection, claims/reinsurance-to-GL, outgoing settlement, bank-to-GL, and close.
10. Implement first: P0 policy/cutover and single-ledger controls, payment/bank adapters, and source-to-GL reconciliation.
11. Single database: **consolidated in source configuration**, **not verified against a live database**.
12. Operational completion requires approved accounting policies, applied migrations, configured adapters and workers, reconciled opening balances, end-to-end controls, missing subledgers and reports, and deployment validation.

See the matrix, detailed findings, architecture report, and roadmap for evidence and required work.
