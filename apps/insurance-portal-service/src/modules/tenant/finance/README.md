# Finance module

Finance is part of the Insurance Portal Service. It runs in the same NestJS
process and uses the same PostgreSQL database as the insurance modules. There is
no separate Finance service, database, connection or migration runner.

The standalone `apps/finance-service` (port 3102, `FINANCE_DATABASE_URL`) was
retired when it was consolidated into this module. Its unique code now lives in
`integrations/source-evidence/` and `accounting/general-ledger/independent-access/`.

## 1. Architecture

`FinanceModule` (`finance.module.ts`) is imported by `TenantModule` and composes
eleven NestJS modules. Dependencies point one way; there are no cycles inside
Finance.

```text
FinanceModule
├── FinanceFoundationModule          foundation/finance-foundation.module.ts
├── FinanceSetupModule               foundation/finance-setup/finance-setup.module.ts
├── FinanceAccountingModule          accounting/finance-accounting.module.ts
├── FinancePayablesModule            payables/finance-payables.module.ts
├── FinanceReconciliationModule      reconciliation/finance-reconciliation.module.ts
├── FinanceInsuranceIntegrationModule integrations/finance-insurance-integration.module.ts
├── FinanceReceivablesModule         receivables/finance-receivables.module.ts
├── FinancePaymentProvidersModule    integrations/payment-providers/finance-payment-providers.module.ts
├── FinanceSourceEvidenceModule      integrations/source-evidence/finance-source-evidence.module.ts
└── FinanceIndependentAccessModule   accounting/general-ledger/independent-access/finance-independent-access.module.ts
```

Operational dependency order:

```text
Accounting ← Payables ← InsuranceIntegration ← Receivables ← PaymentProviders
Accounting ← Reconciliation ← Receivables
Foundation ← Setup ← IndependentAccess        SourceEvidence (standalone)
```

`taxation/` and `governance/` hold code but no NestJS module of their own:
taxation is pure calculation functions, and the governance services (approvals,
accounting policies, financial controls) are providers of
`FinanceFoundationModule`.

## 2. Responsibilities

| Module | Owns | Main providers |
|---|---|---|
| Foundation | Legal entities, accounting books, scope memberships, configuration releases, chart of accounts, dimensions, currency contexts, ledger foundation, journal candidates, approvals, accounting policies, receivable/outgoing/operations controls, allocation scheduler | `FinanceLedgerFoundationService`, `FinanceJournalCandidateService`, `FinanceApprovalService`, `FinancePolicyService`, `FinanceAllocationSchedulerService` |
| Setup | Maker-checker Finance setup, evidence, portal identity for Finance scopes | `FinanceSetupService`, `FinancePortalIdentityService` |
| Accounting | Balanced journal posting, posting-policy eligibility, outbox writer | `FinanceJournalService`, `FinancePostingPolicyService`, `FinanceOutboxService` |
| Payables | Commission accrual | `CommissionAccrualService` |
| Reconciliation | Payment reconciliation batches and matching | `ReconciliationService` |
| InsuranceIntegration | Quotation invoices, payment projections onto quotations and policy transactions, outbox processor | `QuotationInvoiceService`, `QuotationPaymentProjectionService`, `PolicyTransactionPaymentProjectionService`, `FinanceOutboxProcessor` |
| Receivables | Invoices, payment transactions, receipts, allocations, refunds, balances; the single write path | `FinanceCommandService`, `BillingCommissionService`, `FinanceAutoReceiptService` |
| PaymentProviders | Provider adapters and signed webhooks | `ProviderWebhookService`, `PaymentProviderRegistry` |
| SourceEvidence | Signed company-source attestations, signing keys, key changes, delivery worker | `FinanceSourceAttestationsService`, `FinanceSourceKeyChangesService`, `FinanceSourceDeliveryService` |
| IndependentAccess | Book-scoped ledger reads and inactive journal candidates bound to a reviewed source association | `FinanceIndependentAccessService` |

One owner per concept: a **payment transaction** is a provider or manual
payment attempt; a **receipt** is confirmed money allocated to invoices; a
**journal** is an immutable posting; balances are derived, never stored as the
source of truth.

## 3. Database

- **One connection.** `TypeOrmModule.forRootAsync` in `app.module.ts`, configured
  by `DB_*` (see `.env.example`). Finance registers repositories with
  `TypeOrmModule.forFeature` and injects the shared `DataSource`; it never
  creates its own connection.
- **One migration history.** `src/database/migrations/*` via
  `src/database/data-source.ts` (`npm run db:migrate`, table `migrations`).
- **Required extension.** `deploy/backend/database-extensions.sql` (`pg_trgm`)
  must be applied by a DBA before migrating a new database.
- **Consolidation migrations.**
  - `1798300000000-FinanceSourceAttestationRegistry`
  - `1798400000000-FinanceSourceKeyChangeRegistry`

  These create the registries that only existed in the retired Finance database.
  They use new timestamps; the original `1798100000000-FinanceSourceKeyChanges`
  collided with the portal's `1798100000000-FinanceSourceAttestationOutbox`.
  The originals are archived, never registered, under
  `src/database/archive/finance-service/`.
- **Known pre-existing timestamp duplicates.** Each of these timestamps is used
  by two migrations with distinct class names: `1796000000000`
  (`FinanceScopeFoundations`, `UnderwriteCoverAccess`) and `1796100000000`
  (`FinanceConfigurationReviews`, `ClaimsFxGovernance`). TypeORM keys on the
  name, so they apply correctly. Do not reuse a timestamp again.

### Conventions

- Entities live in `<feature>/entities/*.entity.ts` and are discovered by the
  `**/*.entity.ts` glob. Moving a file does not rename its table; never rename
  Finance tables to match folders.
- Evidence tables are append-only. Migrations install `BEFORE UPDATE OR DELETE
  OR TRUNCATE` triggers that raise. Corrections are new rows: reversals, revoke
  rows, new revisions.
- A migration's `down()` refuses to drop a table that contains evidence.
- Never edit an applied migration. Add a new one with an unused timestamp.

## 4. Transaction boundaries

- **Single write path.** `FinanceCommandService` is the write path for
  invoices, receipts, allocations, refunds and commission payments. It opens a
  transaction, takes row locks (`SELECT … FOR UPDATE`) and calls
  balance checks, `FinanceJournalService`, `FinanceOutboxService` and the
  quotation/policy projections with the same `EntityManager`. Either everything
  commits or nothing does.
- **Posting needs an active transaction.**
  `FinancePostingPolicyService.requireEligible` refuses to run outside one,
  because period and policy checks rely on locks.
- **Double entry.** Journals must balance (debits = credits per currency) and
  are immutable once posted. Corrections are reversals that link back to the
  original.
- **Module boundaries don't move transactions.** Splitting providers across
  modules changes nothing here: every module injects the same `DataSource`, and
  transactions travel as an `EntityManager` argument.

## 5. Accounting events

- **Outbox in the same transaction.** Operational writes enqueue an event with
  `FinanceOutboxService.add(manager, …)` inside the business transaction.
  `event_key` is unique per company, and a repeated `add` returns the existing
  row, so retries cannot enqueue the same recognition twice.
- **Outbox delivery.** `FinanceOutboxProcessor` (cron `FINANCE_OUTBOX_CRON`,
  enabled by `FINANCE_OUTBOX_ENABLED`) claims batches with
  `FOR UPDATE SKIP LOCKED`. `next_attempt_at` works as a lease of
  `FINANCE_OUTBOX_LEASE_MINUTES`, so a crashed worker's rows become reclaimable.
  Failures retry up to `FINANCE_OUTBOX_MAX_ATTEMPTS` and then move to
  `DEAD_LETTER`; an unsupported event contract goes to `DEAD_LETTER` at once.
- **Journal posting is gated.** It is controlled by governed accounting-policy
  releases (`governance/accounting-policies`). With no deployed, activated
  policy, posting is held (`FINANCE_POSTING_HELD`): payments stay recorded and
  no journal is produced. There is no environment variable that bypasses this.

## 6. Source attestations and key management

These are signed statements of a company's branches and products, used as
evidence for dimension releases. They grant no posting authority.

1. **Keys.** A key administrator signs `FINANCE_SOURCE_KEY_CHANGE_V1` GRANT or
   REVOKE bodies offline. They are posted to
   `POST /api/v1/internal/finance/source-key-changes` with header
   `x-finance-key-admin-signature`. The endpoint is public, because the pinned
   Ed25519 signature *is* the authentication, and it verifies the body against
   `FINANCE_SOURCE_KEY_ADMIN_*`. Database triggers require a signed change row
   for every key insert and revocation, and keys can't be deleted.
2. **Producing.** The portal signs a `FINANCE_COMPANY_SOURCE_ATTESTATION_V1`
   with `FINANCE_SOURCE_ATTESTATION_*` and writes the immutable bytes to
   `finance_source_attestation_outbox`. This happens through the setup
   maker/checker API (`/tenant/finance/setup/source-attestations`).
3. **Registry.** `FinanceSourceAttestationsService.ingest` verifies the
   signature against an enabled, unrevoked, in-validity key. It requires
   consecutive revisions, stores the exact bytes append-only, and treats a
   repeat of identical bytes as idempotent (`reused: true`). Different bytes for
   an existing revision conflict.

## 7. Outbox, receipts, retries and idempotency

| Flow | Guarantee |
|---|---|
| Finance outbox | Unique `(company, event_key)`; leased `SKIP LOCKED` claims; bounded retries |
| Source delivery (`FinanceSourceDeliveryService`) | Runs only for `FINANCE_SOURCE_DELIVERY_WORKER_ID` holding an enabled `finance_source_delivery_authorities` row. Hands bytes to the registry **in-process** (`finance-source-in-process.transport.ts`, formerly HTTPS to port 3102), requires a receipt signed by `FINANCE_SOURCE_RECEIPT_*`, re-checks authority inside the recording transaction, and records `ACKNOWLEDGED` or `HELD` attempts append-only. Redelivery of stored bytes reconciles idempotently. |
| Provider webhooks | Signature-verified per provider; recorded once per `providerCode:eventId` (advisory lock plus unique row), so duplicates return `duplicate: true` |
| Legacy operations DTOs | Carry `idempotency_key` |

## 8. Insurance integration

Insurance modules own their lifecycle; Finance owns accounting interpretation.

- **Quotations** import `FinanceReceivablesModule` (`FinanceCommandService`)
  and `FinanceInsuranceIntegrationModule` (`QuotationInvoiceService`). Finance
  calls back into `QuotationLifecycleService` only through the payment
  projection.
- **Policy transactions.** Finance projects payments and refunds onto them
  through `PolicyTransactionLifecycleService` and
  `PolicyTransactionRefundProjectionService`.
- **Claims and reinsurance** import `FinanceAccountingModule` only, for
  `FinanceJournalService`.
- **Load-order cycles.** QuotationsModule↔Finance and
  PolicyTransactionsModule↔Finance are mutual module imports. They use
  `forwardRef` in `FinanceInsuranceIntegrationModule`, in
  `FinanceReceivablesModule` (towards the integration module and policy
  transactions) and in `QuotationsModule`. Provider graphs themselves are
  acyclic.

## 9. Authentication and authorization

- **Tenant routes.** All `/tenant/finance/**` routes use the portal JWT guard,
  `@TenantScoped()` and `@Permissions(FinancePermissions.*)`
  (`governance/finance-permissions/finance.permissions.ts`).
- **Scope checks.** Foundation and setup actions also resolve a Finance actor
  for the selected legal entity and book, then check scope memberships and
  configuration authorities. Maker and checker must differ.
- **Independent access.** `/tenant/finance/independent/**` re-resolves the
  portal identity in-process and checks an active `READ_DRAFT` membership, an
  effective reviewed source association owning exactly one company, and an
  identity binding. For prepare and review it re-checks identity and grants
  before returning.
- **Public endpoints.** Only `POST /tenant/finance/providers/:providerCode/webhook`
  and `POST /internal/finance/source-key-changes` are `@Public()`; both are
  authenticated by signatures over the raw body.
- **Legacy billing.** `/tenant/billing/**` is read-only; writes return 410.
- **Workers.** Each worker acts only as its configured subject UUID with a
  database authority row.

## 10. API routes

The paths below omit the `/api/v1` prefix.

| Prefix | Module | Notes |
|---|---|---|
| `/tenant/finance/invoices`, `/receipts`, `/payment-transactions`, `/refunds`, `/commission-payments`, `/commission-accruals`, `/journals`, `/reconciliation-batches`, `/reconciliation-items`, `/allocations` | Receivables (`finance.controller.ts`) | Operational API used by the web Finance pages |
| `/tenant/billing/{invoices,receipts,payment-transactions,commission-transactions,commission-payments}` | Receivables | Legacy, read-only |
| `/tenant/finance/providers/:providerCode/webhook` | PaymentProviders | Public, signed |
| `/tenant/finance/foundation/**` | Foundation | Ledger foundation, candidates, approvals, policies (30 routes) |
| `/tenant/finance/setup/**` | Setup | Setup, source maps, attestations, delivery workers, allocation reviews, independent identity (28 routes) |
| `/tenant/finance/independent/{session,journals,journals/export,allocation-previews,journal-candidates,journal-candidates/:id/validation}` | IndependentAccess | Formerly `/finance/*` on port 3102 |
| `/internal/finance/source-key-changes` | SourceEvidence | Formerly `/internal/source-key-changes` on port 3102 |

The consolidation added only the last two rows. Every route the portal exposed
before the consolidation is unchanged (verified by comparing the full route
table, 1,302 routes, before and after). The standalone service's
`/internal/company-source-attestations` ingest endpoint was **not** carried
over: ingestion is in-process only.

## 11. Development and testing

```bash
npm run start:dev:insurance-portal-service       # Finance starts with the portal
npx jest apps/insurance-portal-service/src/modules/tenant/finance   # unit specs
# Database integration tests: disposable PostgreSQL cluster per run.
# Needs a local PostgreSQL install (or FINANCE_TEST_PG_BIN); installs nothing.
node apps/insurance-portal-service/test/finance/run-isolated-postgres.cjs
node apps/insurance-portal-service/test/finance/run-isolated-postgres.cjs \
  --test-file finance-consolidated-independent-access.finance-integration.ts
```

- **Runner timeout.** The runner gives the whole suite 10 minutes; on slower
  machines run files individually with `--test-file`.
- **Key test files.**
  - `finance-consolidated-independent-access`: key changes over HTTP, the
    attestation registry and independent access through portal controllers.
  - `finance-recurring-allocation`: outbox → in-process delivery → signed
    receipts on one database.
- **Dated fixtures.** Several finance integration fixtures hard-code 2026
  dates; see section 13.

## 12. Migration and deployment

1. Back up the portal database.
2. Ensure `deploy/backend/database-extensions.sql` has been applied.
3. Run `npm run db:migrate`. On a database at the previous head, exactly the two
   consolidation migrations apply. Both only create new, empty tables, functions
   and triggers.
4. Deploy the portal. No separate Finance process, port or database is deployed.
5. Configure source-evidence keys and worker IDs only when enabling that
   feature (see `.env.example`).

**Rollback.** The `down()` of the two consolidation migrations refuses to run
if any evidence exists. Before enabling the feature, rolling back is safe.

## 13. Known limitations and inactive capabilities

- **Inactive by design.** These features require approved, activated policy
  releases and configured authorities before they do anything:
  - journal posting from operational events (held without an activated
    accounting policy);
  - recurring allocations (previews only; `activationAuthorized: false`);
  - outgoing cash and settlement simulators (none registered);
  - source-evidence delivery (no worker configured).
- **Not implemented here.** Bank reconciliation, fiscal-document issuance, tax
  reporting, supplier invoices and payment vouchers, claims and reinsurance
  settlement postings, and financial statements beyond the foundation trial
  balance. The target architecture names these areas, but no folders exist for
  them until code exists.
- **Dimension verification.** Dimensions are verified against the portal's own
  branch and product tables (`prepareSetupDimensionMaster`). The
  signed-attestation verifier (`FinanceSourceAttestationsService.verifyDimensions`)
  remains available but is not bound in the portal.
- **Retired Finance database not inspected.** No deploy script, environment
  template or CI job ever provisioned `FINANCE_DATABASE_URL`, and no records
  were migrated from it. If any environment did provision one outside this
  repository, it must be inspected and reconciled separately before being
  decommissioned.
- **Calendar-dependent tests.** Some finance integration tests hard-code
  late-2026 dates (for example LF15 uses `2026-11-20`, and contexts end
  `2026-11-25` or `2027-01-01`). They will need relative dates as the calendar
  passes them; LF14 has already been converted.
