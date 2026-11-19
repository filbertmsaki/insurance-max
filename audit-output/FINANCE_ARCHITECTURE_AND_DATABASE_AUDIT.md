# Architecture and database audit

## Consolidation

- **Code-level single database: supported.** `FinanceModule` is imported by `tenant.module.ts:73`; `data-source.options.ts:17-43` reads portal `DB_*` and globs all portal entities plus `src/database/migrations`. Finance entities use default `TypeOrmModule.forFeature` or injected default `DataSource`. Portal migration scripts are in root `package.json`.
- **Live consolidation: not verified.** No connection to a safe target database was made. The `migrations` table, physical constraints, duplicate tables, and actual records were not inspected.
- **No separate active runtime found.** `package.json` start/build commands have portal and Tiramis only; archived files at `src/database/archive/finance-service/` refer to a retired `FINANCE_DATABASE_URL` but are outside the migration glob. A repository search found no active runtime dependency on it.
- **Authentication and isolation:** Finance controllers use `@TenantScoped`, `@Permissions`, `@CurrentUser`; foundation tables carry tenant/entity/book scope. Verify branch restrictions on every legacy read and cross-module repository access in end-to-end tests.

## Important architecture risks

- Two accounting representations coexist: legacy `finance_journal_entries` and canonical `finance_foundation_journals`. Posting policy holds the legacy path when the canonical foundation owns the book (`apps/insurance-portal-service/src/modules/tenant/finance/accounting/posting-rules/finance-posting-policy.service.ts:60`). Prove one authoritative outcome per source event.
- `forwardRef` cycles remain between Finance, quotations, and policy transactions (`apps/insurance-portal-service/src/modules/tenant/finance/integrations/finance-insurance-integration.module.ts:27`; `apps/insurance-portal-service/src/modules/tenant/finance/receivables/finance-receivables.module.ts:68`).
- Several services reach across modules and use raw SQL. Review transaction manager propagation, row locks, idempotency keys, and scoped foreign keys before release. The controlled command path is in `apps/insurance-portal-service/src/modules/tenant/finance/receivables/payment-transactions/finance-command.service.ts`.
- The legacy billing controller remains registered for some reads/writes, while its operations controller is deliberately not registered (`apps/insurance-portal-service/src/modules/tenant/finance/receivables/finance-receivables.module.ts:94`). Verify the read-only guard on each write route.
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
