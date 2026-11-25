import { FinanceLedgerPeriodAndBalances1799200000000 } from '../../src/database/migrations/1799200000000-FinanceLedgerPeriodAndBalances';
import { FinanceLedgerCompletion1799100000000 } from '../../src/database/migrations/1799100000000-FinanceLedgerCompletion';
import { FinanceGeneralLedgerWorkflows1799000000000 } from '../../src/database/migrations/1799000000000-FinanceGeneralLedgerWorkflows';
import {
  readNativeMovement,
  nativeComponents,
  reversalSources,
} from '../../src/modules/tenant/finance/accounting/general-ledger/finance-native-sources';
import { ReinsuranceRecoveryService } from '../../src/modules/tenant/reinsurance/services/reinsurance-recovery.service';
import { FinanceJournalService } from '../../src/modules/tenant/finance/accounting/journal-entries/finance-journal.service';
import { FinanceGlWorkflowsService } from '../../src/modules/tenant/finance/accounting/general-ledger/finance-gl-workflows.service';
import { exerciseGeneralLedger } from '../support/finance-general-ledger-workflow';
import { exerciseTradePayables } from '../support/finance-trade-payables-workflow';
import { exerciseInsurerPremium } from '../support/finance-insurer-premium-workflow';
import { randomUUID } from 'node:crypto';
import { FINANCE_DOCUMENT_TYPES } from '@insurance-max/contracts';
import { withNewCompany } from '../support/finance-new-company-session';
import {
  currencyContextPolicyHash,
  FOUNDATION_CHECKS,
} from '../../src/modules/tenant/finance/accounting/general-ledger/finance-ledger-foundation.types';

describe('FIN-01 first company through first live journals', () => {
  it.each(['BROKER', 'INSURER'])(
    '%s prepares and independently approves the primary book, issues the first invoice, records its receipt and posts each exactly once',
    async (profile) => {
      const insurer = profile === 'INSURER',
        basis = insurer ? 'IFRS' : 'STATUTORY';
      await withNewCompany(
        async ({
          db,
          app,
          call,
          company,
          customer,
          maker,
          checker,
          deputy,
          today,
          until,
          document,
        }) => {
          const monthStart = today.slice(0, 7) + '-01';
          const since = !insurer
            ? today
            : new Date(Date.parse(monthStart + 'T00:00:00Z') - 86400000)
                .toISOString()
                .slice(0, 7) + '-01';
          const reason = 'Company finance workflow acceptance',
            evidenceHash = document.hash;
          expect(await call(checker, 'foundation/scopes')).toEqual([]);
          const onboarding = {
            bookCode: 'PRIMARY',
            businessProfile: profile,
            preparerUserId: maker,
            approvalRole: 'FINANCE_REVIEWER',
            limits: { TZS: '25000000', USD: '100000' },
            validUntil: until,
            authorityReference: 'Board appointment 4',
            additionalCheckerUserIds: [deputy],
          };
          await call(maker, 'setup/onboarding', onboarding, 403);
          const book = await call(checker, 'setup/onboarding', onboarding);
          await call(checker, 'setup/onboarding', onboarding, 409);
          const scope = {
            legalEntityId: book.legalEntityId,
            bookId: book.bookId,
          };
          const query = new URLSearchParams(scope).toString();
          const read = () => call(checker, 'setup?' + query);
          const post = (
            user: string,
            path: string,
            body: Record<string, any> = {},
            status?: number,
          ) => call(user, path, { scope, reason, ...body }, status);
          const feeInput = {
            insurer_company_id: company,
            customer_id: customer,
            invoice_type: 'FEE',
            currency: 'TZS',
            items: [
              {
                item_type: 'FEE',
                item_name: 'Service',
                quantity: 1,
                unit_amount: 100,
                total_amount: 100,
              },
            ],
          };
          await expect(
            db.query('SELECT finance_fin01_primary($1)', [company]),
          ).rejects.toMatchObject({ code: 'P0101' });
          const held = await call(maker, 'invoices', feeInput, 409);
          expect(held.error.code).toBe('FINANCE_SETUP_REQUIRED');
          expect(
            await db.query('SELECT id FROM invoices WHERE company_id=$1', [
              company,
            ]),
          ).toHaveLength(0);
          const overview = await read();
          const people = overview.inventory.people;
          const pins: { id: string; hash: string }[] = [],
            configs: { id: string; hash: string }[] = [];
          const step = async (
            code: string,
            answers: Record<string, any>,
            purposes = ['BOARD_DECISION'],
          ) => {
            const body = {
              step: code,
              version: 1,
              purpose: 'COMPANY_SETUP',
              effectiveFrom: since,
              effectiveTo: until,
              answers,
              dependencies: pins,
              evidence: purposes.map((purpose) => ({ ...document, purpose })),
            };
            const row = await post(maker, 'setup/versions', { input: body });
            const path = 'setup/versions/' + row.id;
            await post(maker, path + '/submit', {
              subjectHash: row.subjectHash,
            });
            if (code === 'G04-01')
              await post(
                maker,
                path + '/review',
                { subjectHash: row.subjectHash, decision: 'REVIEW_INACTIVE' },
                403,
              );
            await post(checker, path + '/review', {
              subjectHash: row.subjectHash,
              decision: 'REVIEW_INACTIVE',
            });
            const pin = { id: row.id, hash: row.subjectHash };
            pins.push(pin);
            return pin;
          };
          const config = async (
            kind: string,
            payload?: any,
            extra: Record<string, any> = {},
          ) => {
            const input = {
              kind,
              key: kind,
              version: 1,
              effectiveFrom: since,
              effectiveTo: until,
              dependencyRefs: Array.from(
                { length: 15 },
                (_, i) => 'DEC-' + String(i + 1).padStart(2, '0'),
              ),
              payload,
              ...extra,
            };
            const row = await post(maker, 'setup/configurations', { input });
            const pin = { id: row.id, hash: row.release_hash };
            await post(maker, 'setup/configurations/' + row.id + '/submit', {
              subjectHash: pin.hash,
            });
            await post(checker, 'setup/configurations/' + row.id + '/review', {
              subjectHash: pin.hash,
              decision: 'REVIEW_INACTIVE',
            });
            configs.push(pin);
            return pin;
          };
          let product: { id: string; version: string; tax: string } | undefined;
          if (insurer) {
            const [cat] = await db.query(
              "INSERT INTO insurance_categories(company_id,code,name) VALUES($1,'PROPERTY','Property') RETURNING id",
              [company],
            );
            const [prod] = await db.query(
              "INSERT INTO insurance_products(company_id,category_id,product_code,product_name,lifecycle_status) VALUES($1,$2,'PROP','Property','ACTIVE') RETURNING id",
              [company, cat.id],
            );
            const [v] = await db.query(
              "INSERT INTO insurance_product_versions(company_id,product_id,version_number,status,product_name,business_line,effective_from,effective_to,definition_hash) VALUES($1,$2,1,'PUBLISHED','Property','GENERAL',$3,$4,$5) RETURNING id",
              [company, prod.id, since, until, evidenceHash],
            );
            await db.query(
              'UPDATE insurance_products SET current_version_id=$1 WHERE id=$2',
              [v.id, prod.id],
            );
            const [tax] = await db.query(
              "INSERT INTO taxes(company_id,tax_code,tax_name,tax_rate,is_active) VALUES($1,'TST','Fixture tax',0,true) RETURNING id",
              [company],
            );
            product = { id: prod.id, version: v.id, tax: tax.id };
          }
          await step(
            'G04-01',
            {
              jurisdictionCode: 'TZ',
              productIds: product ? [product.id] : [],
              noOwnProducts: !product,
              legalScopeReason: product
                ? 'Licensed general insurance product.'
                : 'Licensed broker with no own products.',
            },
            [
              'LICENCE',
              'TIN',
              'REGISTRATION',
              'ASSOCIATION',
              'TIRA_MAINTENANCE',
            ],
          );
          await step('G04-02', {
            preparerBindingId: people.find(
              (p: any) => p.source_user_id === maker,
            ).binding_id,
            reviewerBindingId: people.find(
              (p: any) => p.source_user_id === checker,
            ).binding_id,
            appointmentReference: 'Board appointment 4',
            segregationOfDuties: reason,
          });
          const currencies = {
            functionalCurrency: 'TZS',
            transactionCurrencies: ['TZS', 'USD'],
            presentationCurrencies: ['TZS'],
            currencyScales: { TZS: 2, USD: 2 },
            maximumRateAgeDays: 1,
            rateSources: ['BANK'],
            roundingMode: 'REJECT_IMBALANCED',
          };
          const assessment = await step('G04-03', {
            ...currencies,
            bookRole: 'PRIMARY',
            accountingBasis: basis,
            functionalCurrencyRationale: reason,
          });
          const yearEnd = new Date(Date.parse(until + 'T00:00:00Z') - 86400000)
            .toISOString()
            .slice(5, 10);
          const tomorrow = new Date(Date.parse(today + 'T00:00:00Z') + 86400000)
            .toISOString()
            .slice(0, 10);
          await step('G04-04', {
            calendarCode: 'FIRST',
            fiscalYearEnd: yearEnd,
            timezone: 'Africa/Dar_es_Salaam',
            closeProcedure: reason,
            reopeningProcedure: reason,
            periods: [
              ...(since < monthStart
                ? [{ code: 'PREVIOUS', from: since, to: monthStart }]
                : []),
              ...(since < monthStart && monthStart < today
                ? [{ code: 'CURRENT', from: monthStart, to: today }]
                : []),
              { code: 'FIRST', from: today, to: tomorrow },
              {
                code: 'YEAR-END-ADJ',
                kind: 'ADJUSTMENT',
                from: today,
                to: tomorrow,
              },
              { code: 'NEXT', from: tomorrow, to: until },
            ],
          });
          const map = await post(maker, 'setup/source-maps', {
            input: {
              version: 1,
              legalRole: profile,
              effectiveFrom: since,
              effectiveTo: until,
            },
          });
          await post(
            checker,
            'setup/source-maps/' + map.map.id + '/read-mandate',
            { subjectHash: map.hash },
          );
          await step('G04-05', {
            sourceMapIds: [map.map.id],
            cutoffDate: since,
            populationEvidenceHash: evidenceHash,
            reconciliationProcedure: reason,
          });
          const branches = await db.query(
            "INSERT INTO branches(company_id,name,code,status) VALUES($1,'Ledger HQ','GLHQ','active'),($1,'Ledger Coast','GLCOAST','active') RETURNING id",
            [company],
          );
          const accounts = [
            ['1100', 'Cash', 'ASSET'],
            ['1200', 'Receivables', 'ASSET'],
            ['4100', 'Fees', 'INCOME'],
            ['611004', 'Internet Expense', 'EXPENSE'],
            ['112001', 'CRDB Bank TZS', 'ASSET'],
            ['213001', 'Accrued Expenses', 'LIABILITY'],
            ['114001', 'Prepaid Expenses', 'ASSET'],
            ['113900', 'Branch Clearing', 'ASSET'],
            ['511003', 'Claim Recoveries', 'EXPENSE'],
            ['113003', 'Reinsurance receivables', 'ASSET'],
            ['112009', 'Deposits in transit', 'ASSET'],
            ['121002', 'Computer Equipment', 'ASSET'],
            ['211001', 'Trade Payables', 'LIABILITY'],
            ...(insurer
              ? [
                  ['221001', 'Insurance contract liabilities', 'LIABILITY'],
                  ['411001', 'Insurance revenue', 'INCOME'],
                ]
              : []),
          ];
          const roleCodes = [
            'CASH',
            'AR',
            'FEES',
            'INTERNET',
            'CRDB',
            'ACCRUED',
            'PREPAID',
            'CLEARING',
            'CLAIM_RECOVERY',
            'CEDED_RECEIVABLE',
            'TRANSIT',
            'COMPUTERS',
            'TRADE_AP',
            ...(insurer ? ['LRC', 'INSURANCE_REVENUE'] : []),
          ];
          const chart = await config('ACCOUNT_ROLES', {
            schema: 'FINANCE_CHART_V1',
            chartCode: 'TZ',
            supportedProfiles: [profile],
            accounts: accounts.map(([code, name, type]) => ({
              code,
              name,
              type,
              normalBalance: ['ASSET', 'EXPENSE'].includes(type) ? 'DR' : 'CR',
              posting: true,
              control: false,
              parentCode: null,
            })),
            roles: accounts.map(([accountCode, , accountType], i) => ({
              accountCode,
              accountType,
              code: roleCodes[i],
              requiredDimensions: ['CURRENCY'],
              dependencyRefs: ['DEC-05', 'DEC-15'],
            })),
            legacy: {
              mode: 'SCOPED_INVENTORY',
              sourceMapId: map.map.id,
              dispositions: [],
              emptyInventoryReason: 'New company with no legacy accounts.',
            },
          });
          const [itDepartment] = await db.query(
            "INSERT INTO departments(company_id,code,name) VALUES($1,'IT','Information Technology') RETURNING id",
            [company],
          );
          const dim = await config('DIMENSIONS', {
            schema: 'FINANCE_DIMENSIONS_V1',
            companyMaster: {
              schema: 'FINANCE_COMPANY_DIMENSION_MASTER_V1',
              branchIds: branches.map((x: { id: string }) => x.id),
              productIds: product ? [product.id] : [],
            },
            activationAuthorized: false,
            definitions: ['TENANT', 'LEGAL_ENTITY', 'BOOK'].map((code) => ({
              code,
              label: code,
              valueType: 'ID',
              required: true,
              source: 'Company scope',
            })),
          });
          await step('G04-06', {
            chartReleaseId: chart.id,
            chartReleaseHash: chart.hash,
            dimensionReleaseId: dim.id,
            dimensionReleaseHash: dim.hash,
            mappingReview: reason,
            businessDimensionsReviewed: true,
            departmentIds: [itDepartment.id],
            costCentres: [{ code: 'HQ', name: 'Head office' }],
          });
          const components = [
            ['INVOICE_ISSUED', 'INVOICE', 'AR', 'FEES'],
            ['RECEIPT_POSTED', 'RECEIPT', 'CASH', 'AR'],
            ['INVOICE_WRITTEN_OFF', 'INVOICE_WRITE_OFF', 'INTERNET', 'AR'],
            ['REFUND_PAID', 'REFUND', 'AR', 'CASH'],
            ['COMMISSION_ACCRUED', 'COMMISSION_ACCRUAL', 'INTERNET', 'ACCRUED'],
            [
              'COMMISSION_PAYMENT_PAID',
              'COMMISSION_PAYMENT',
              'ACCRUED',
              'CASH',
            ],
            [
              'CLAIM_DISBURSEMENT_PAID',
              'CLAIM_DISBURSEMENT',
              'ACCRUED',
              'CASH',
            ],
            [
              'RECOVERY_RECEIPT_RECORDED',
              'CLAIM_RECOVERY_RECEIPT',
              'CASH',
              'CLAIM_RECOVERY',
            ],
            [
              'REINSURANCE_SETTLEMENT_PAID',
              'REINSURANCE_SETTLEMENT',
              'ACCRUED',
              'CASH',
            ],
          ];
          const glKinds = [
            'MANUAL',
            'RECURRING',
            'ACCRUAL',
            'ACCRUAL_SETTLEMENT',
            'PREPAYMENT',
            'PREPAYMENT_RELEASE',
            'INTERBRANCH',
            'ALLOCATION',
            'REVALUATION',
          ];
          await config('POSTING_RULES', {
            schema: 'FINANCE_POSTING_RULES_V1',
            activationAuthorized: false,
            productMapping: {
              schema: 'FINANCE_PRODUCT_MAPPING_V1',
              activationAuthorized: false,
              entries: product
                ? [
                    {
                      productId: product.id,
                      productVersionId: product.version,
                      disposition: 'IN_SCOPE',
                      reason,
                      riskIds: [],
                      ruleKeys: ['PREMIUM_MEMO', 'PAA_RELEASE'],
                    },
                  ]
                : [],
            },
            rules: [
              ...(insurer
                ? [
                    {
                      sourceEvent: 'INVOICE_ISSUED',
                      economicEffectKey: 'PREMIUM_MEMO',
                      layer: 'BILLING_MEMORANDUM',
                      postingAuthority: 'FINANCE',
                      enabled: false,
                      financialPosting: false,
                      policyReferences: ['AP-07.01'],
                      unresolvedDecisions: [],
                    },
                    {
                      sourceEvent: 'PREMIUM_RECEIPT_POSTED',
                      economicEffectKey: 'PREMIUM_COLLECTION',
                      layer: 'OPERATIONAL',
                      postingAuthority: 'FINANCE',
                      enabled: false,
                      financialPosting: true,
                      policyReferences: ['AP-08.01'],
                      unresolvedDecisions: [],
                      debitRoles: ['CASH'],
                      creditRoles: ['LRC'],
                    },
                    {
                      sourceEvent: 'IFRS17_MEASUREMENT_APPROVED',
                      economicEffectKey: 'PAA_RELEASE',
                      layer: 'IFRS17_MEASUREMENT',
                      measurementSource: 'IFRS17_ENGINE',
                      postingAuthority: 'FINANCE',
                      enabled: false,
                      financialPosting: true,
                      policyReferences: ['AP-23.02'],
                      unresolvedDecisions: [],
                      debitRoles: ['LRC'],
                      creditRoles: ['INSURANCE_REVENUE'],
                    },
                  ]
                : []),
              ...components.map(([sourceEvent, economicEffectKey, dr, cr]) => ({
                sourceEvent,
                economicEffectKey,
                layer: 'OPERATIONAL',
                postingAuthority: 'FINANCE',
                enabled: false,
                financialPosting: true,
                policyReferences: ['AP-08.01'],
                unresolvedDecisions: [],
                debitRoles:
                  economicEffectKey === 'REINSURANCE_SETTLEMENT'
                    ? [dr, 'CASH']
                    : [dr],
                creditRoles:
                  economicEffectKey === 'REINSURANCE_SETTLEMENT'
                    ? [cr, 'CEDED_RECEIVABLE']
                    : [cr],
              })),
              ...glKinds.map((kind) => ({
                sourceEvent: kind,
                economicEffectKey: kind,
                layer: 'OPERATIONAL',
                postingAuthority: 'FINANCE',
                enabled: false,
                financialPosting: true,
                policyReferences: ['AP-04.02'],
                unresolvedDecisions: [],
                debitRoles: roleCodes,
                creditRoles: roleCodes,
              })),
            ],
          });
          await config('CURRENCY_RULES', {
            schema: 'FINANCE_CURRENCY_RULES_V1',
            activationAuthorized: false,
            ...currencies,
            assessmentReference: assessment.id + '/' + assessment.hash,
            fxOwnership: 'ONE_OWNER_PER_EXPOSURE',
          });
          await config('TAX_RULES', {
            schema: 'FINANCE_TAX_RULES_V1',
            activationAuthorized: false,
            sourceTaxCatalogue: product
              ? 'LEGACY_TAXES'
              : 'NO_SOURCE_TAX_RULES',
            applicabilityReason: reason,
            calculationOwner: 'EXISTING_SOURCE_TAX_ENGINE',
            missingBreakdownTreatment: 'BLOCK_POSTING',
            preserveCustomerPayable: true,
            sourceTaxRuleIds: product ? [product.tax] : [],
          });
          const assoc = await config('SOURCE_ASSOCIATIONS', undefined, {
            sourceMapIds: [map.map.id],
          });
          await config('APPROVAL_RULES', {
            schema: 'FINANCE_APPROVAL_PROFILE_V1',
            purpose: 'JOURNAL_CANDIDATE_ONLY',
            roleCode: 'FINANCE_REVIEWER',
            requiredCheckers: 2,
            ttlSeconds: 86400,
          });
          const contract = await config('EVENT_CONTRACTS', {
            schema: 'FINANCE_EVENT_CONTRACT_V1',
            purpose: 'SOURCE_FACT_REFERENCE',
            eventType: 'source.policy.terms-snapshotted.v1',
            schemaVersion: '1.0.0',
            producerId: 'INSURANCE_PORTAL_FINANCE',
            sourceSystem: 'INSURANCE_PORTAL_FINANCE',
            aggregateType: 'POLICY',
            factKind: 'POLICY_TERMS',
            codec: 'SOURCE_SNAPSHOT_REFERENCE_V1',
          });
          await config('EVENT_ROUTES', {
            schema: 'FINANCE_EVENT_ROUTE_V1',
            contractId: contract.id,
            contractHash: contract.hash,
            sourceAssociationId: assoc.id,
            sourceAssociationHash: assoc.hash,
            sourceMapId: map.map.id,
            sourceMapHash: map.hash,
          });
          await config('INTEGRATION_RULES', {
            schema: 'FINANCE_INTEGRATION_RULES_V1',
            purpose: 'INACTIVE_REFERENCE_ONLY',
            handler: 'HOLD_REFERENCE_V1',
            leaseSeconds: 30,
            maxAttempts: 3,
            retryDelaySeconds: 0,
            consumerId: 'REFERENCE_CONSUMER',
          });
          await config('EXCEPTION_RULES', {
            schema: 'FINANCE_EXCEPTION_RULES_V1',
            purpose: 'INACTIVE_REFERENCE_ONLY',
            replayTtlSeconds: 300,
            additionalAttempts: 1,
            maxReplaysPerItem: 2,
            proposedOwnerDueSeconds: null,
            proposedEscalationSeconds: null,
          });
          await config('QUOTATION_BILLING_RULES', {
            schema: 'FINANCE_QUOTATION_BILLING_RULES_V1',
            purpose: 'MEMORANDUM_ONLY',
            recognition: 'HELD_INACTIVE',
            maxLines: 10,
          });
          await config('RECEIVABLE_CONTROLS', {
            schema: 'FINANCE_RECEIVABLE_CONTROLS_V1',
            purpose: 'INACTIVE_CONTROLS_ONLY',
            recognition: 'HELD_INACTIVE',
            cashAccounts: [
              {
                sourceAccountId: randomUUID(),
                sourceCompanyId: company,
                currency: 'TZS',
                decimalScale: 2,
              },
            ],
            ageingBands: [30, 60, 90],
          });
          await step(
            'G04-07',
            {
              configurationPins: configs,
              consumerVerification: reason,
              numbering: FINANCE_DOCUMENT_TYPES.map((documentType, i) => ({
                documentType,
                prefix: 'D' + i,
                width: 4,
                reset: 'YEAR',
              })),
              paymentTerms: ['CUSTOMER', 'SUPPLIER'].map((party) => ({
                party,
                code: party,
                label: party,
                days: party === 'SUPPLIER' ? 30 : 15,
                isDefault: true,
              })),
              paymentMethods: [
                {
                  method: 'CASH',
                  direction: 'BOTH',
                  accountCode: '1100',
                  referenceRequired: false,
                },
                {
                  method: 'BANK_TRANSFER',
                  direction: 'OUTGOING',
                  accountCode: '112001',
                  referenceRequired: true,
                },
              ],
              approvalLimits: [
                'REFUND',
                'COMMISSION_PAYMENT',
                'COMMISSION_ACCRUAL',
                'RECONCILIATION',
                'CLAIM_PAYMENT',
                'REINSURANCE_SETTLEMENT',
              ].map((action) => ({
                action,
                currency: 'TZS',
                role: insurer ? 'INSURANCE_ADMIN' : 'BROKER_ADMIN',
                maximum: '10000',
              })),
            },
            ['TAX_APPLICABILITY'],
          );
          const ctx: any = {
            schema: 'FINANCE_CURRENCY_CONTEXT_V1',
            version: 1,
            sourceCompanyId: company,
            basis,
            functionalCurrency: 'TZS',
            presentationCurrencies: ['TZS'],
            currencyScales: { TZS: 2, USD: 2 },
            effectiveFrom: since,
            effectiveTo: until,
            rateSources: ['BANK'],
            maxRateAgeDays: 1,
            roundingMode: 'REJECT_IMBALANCED',
            chartReleaseId: chart.id,
            chartReleaseHash: chart.hash,
            policyPins: [],
            unresolvedDecisions: [],
            assessmentReference: reason,
            assessmentEvidenceHash: evidenceHash,
            allowedComponents: components.map(
              ([sourceEventType, component, dr, cr]) => ({
                origin: 'INSURANCE_PORTAL_FINANCE',
                component,
                factKind: component,
                sourceEventType,
                owner: 'FINANCE',
                policyCode: 'AP-08.01',
                effect: [
                  'INVOICE',
                  'INVOICE_WRITE_OFF',
                  'COMMISSION_ACCRUAL',
                ].includes(component)
                  ? 'ORDINARY'
                  : 'CASH',
                debitRoles:
                  component === 'REINSURANCE_SETTLEMENT' ? [dr, 'CASH'] : [dr],
                creditRoles:
                  component === 'REINSURANCE_SETTLEMENT'
                    ? [cr, 'CEDED_RECEIVABLE']
                    : [cr],
                sourceMapping: {
                  amountPath: '/amount',
                  currencyPath: '/currency',
                  datePath: '/transactionDate',
                  companyPath: '/companyId',
                  aggregatePath: '/sourceId',
                },
              }),
            ),
          };
          if (insurer)
            ctx.allowedComponents.push(
              {
                ...ctx.allowedComponents[0],
                component: 'PREMIUM_MEMO',
                effect: 'BILLING_MEMORANDUM',
                policyCode: 'AP-07.01',
                debitRoles: [],
                creditRoles: [],
              },
              {
                ...ctx.allowedComponents[0],
                component: 'PREMIUM_COLLECTION',
                effect: 'CASH',
                sourceEventType: 'PREMIUM_RECEIPT_POSTED',
                factKind: 'RECEIPT',
                debitRoles: ['CASH'],
                creditRoles: ['LRC'],
              },
              {
                ...ctx.allowedComponents[0],
                origin: 'IFRS17_ENGINE',
                component: 'PAA_RELEASE',
                effect: 'INSURANCE_MEASUREMENT',
                owner: 'IFRS17_ENGINE',
                policyCode: 'AP-23.02',
                factKind: 'IFRS17_MEASUREMENT',
                sourceEventType: 'IFRS17_MEASUREMENT_APPROVED',
                debitRoles: ['LRC'],
                creditRoles: ['INSURANCE_REVENUE'],
              },
            );
          for (const component of glKinds) {
            ctx.allowedComponents.push({
              origin: 'FIN02_GL',
              component,
              owner: 'FINANCE',
              effect: 'ORDINARY',
              policyCode: 'AP-04.02',
              sourceEventType: null,
              factKind: null,
              sourceMapping: null,
              debitRoles: roleCodes,
              creditRoles: roleCodes,
            });
          }
          const policies = new Map<string, { id: string; hash: string }>();
          for (const policyCode of [
            'AP-01.01',
            'AP-02.01',
            'AP-03.01',
            'AP-04.01',
            'AP-04.02',
            'AP-05.01',
            'AP-06.01',
            'AP-06.02',
            'AP-33.01',
            'AP-20.01',
            'AP-20.04',
            'AP-31.01',
            'AP-32.01',
            'AP-08.01',
            ...(insurer ? ['AP-07.01', 'AP-23.02'] : []),
          ]) {
            const definition = {
              schema: 'FINANCE_POLICY_V1',
              policyCode,
              version: 1,
              profile,
              description: reason,
              treatment: reason,
              accountingLayer:
                policyCode === 'AP-23.02'
                  ? 'IFRS17_MEASUREMENT'
                  : policyCode === 'AP-07.01'
                    ? 'OPERATIONAL'
                    : 'CONTROL',
              effectiveFrom: since,
              effectiveTo: until,
              configuration: {
                currencyContextHash: currencyContextPolicyHash(ctx),
                businessProfile: profile,
              },
              decisionReferences: [],
              unresolvedDecisions: [],
              dependencyPolicyHashes: [],
              evidenceReferences: [
                'document:' +
                  document.documentId +
                  ':' +
                  document.id +
                  ':' +
                  evidenceHash,
              ],
            };
            const p = await call(maker, 'setup/policies', {
              scope,
              definition,
            });
            const pin = { id: p.id, hash: p.definitionHash };
            policies.set(policyCode, pin);
            ctx.policyPins.push(pin);
            await post(maker, 'setup/policies/' + p.id + '/configure', {
              subjectHash: pin.hash,
              evidenceHash,
            });
            for (const action of ['VALIDATE', 'APPROVE'])
              await post(
                checker,
                'setup/policies/' + p.id + '/inactive-decisions',
                { subjectHash: pin.hash, evidenceHash, action },
              );
          }
          const deferred = (a: { id: string }) => ({
            id: a.id,
            reason,
            disposition: 'DEFERRED',
          });
          await step('G04-08', {
            decisionSelections: overview.catalog.decisions.map(deferred),
            policyDecisions: overview.catalog.policies.map(
              (x: { id: string }) => {
                const p = policies.get(x.id);
                return p
                  ? {
                      id: x.id,
                      reason,
                      disposition: 'PROPOSED_TREATMENT',
                      selection: reason,
                      policyVersionId: p.id,
                      policyVersionHash: p.hash,
                    }
                  : deferred(x);
              },
            ),
          });
          await step('G04-09', {
            environment: 'ISOLATED_COPY',
            result: 'PASS',
            checksPassed: 9,
            paidInvoicesUnchanged: true,
            existingAccessUnchanged: true,
            policyActivations: 0,
            bookActivations: 0,
            sourceFinancialWrites: 0,
            reconciliationEvidenceHash: evidenceHash,
          });
          const final = await step('G04-10', {
            acceptedScope: 'INACTIVE_SETUP_REVIEW',
            activationAuthorized: false,
            completionStatement: reason,
            remainingRestrictions: 'Independent book release required.',
          });
          const ledgerDoc = async (path: string, input: any) => {
            const d = await post(maker, 'foundation/' + path, {
              input,
              version: 1,
            });
            await post(checker, 'foundation/documents/' + d.id + '/reviews', {
              subjectHash: d.subjectHash,
              evidenceHash,
              decision: 'REVIEWED',
            });
            return d;
          };
          const context = await ledgerDoc('currency-contexts', ctx),
            contextPin = {
              contextId: context.id,
              contextHash: context.subjectHash,
            };
          const openingInput = {
            ...contextPin,
            date: since,
            balances: accounts.map(([accountCode]) => ({
              accountCode,
              signedBalance:
                insurer && accountCode === '1200'
                  ? '150000'
                  : insurer && accountCode === '113900'
                    ? '-150000'
                    : insurer && accountCode === '121002'
                      ? '6000'
                      : insurer && accountCode === '211001'
                        ? '-6000'
                        : '0',
            })),
            sourceReference: reason,
            sourceEvidenceHash: evidenceHash,
            explicitZeroReason: insurer
              ? null
              : 'New company with no historic balances.',
          };
          await post(checker, 'foundation/periods', {
            input: {
              code: 'VALIDATION',
              mode: 'VALIDATION',
              from: since,
              to: until,
            },
            evidenceHash,
          });
          const val = await ledgerDoc('openings', {
            ...openingInput,
            mode: 'VALIDATION',
          });
          const accept = await ledgerDoc('acceptances', {
            ...contextPin,
            openingId: val.id,
            openingHash: val.subjectHash,
            from: since,
            to: until,
            checks: FOUNDATION_CHECKS.map((code) => ({
              code,
              evidenceHash,
              reference: reason,
            })),
            compatibilityEvidenceHash: evidenceHash,
            historicalProtectionHash: evidenceHash,
            scopeReference: reason,
          });
          // Date the insurer's cutover at the start of the prior month. Move the
          // book clock back to the session date before exercising the scheduler.
          const queryDatabase = db.query.bind(db);
          const cutoverClock = insurer
            ? jest
                .spyOn(db, 'query')
                .mockImplementation((sql, parameters, runner) =>
                  sql === 'SELECT statement_timestamp()::date::text today'
                    ? queryDatabase(
                        'SELECT $1::date::text today',
                        [since],
                        runner,
                      )
                    : queryDatabase(sql, parameters, runner),
                )
            : undefined;
          const opening = await ledgerDoc('openings', {
            ...openingInput,
            mode: 'LIVE',
          });
          const release = await post(maker, 'foundation/releases', {
            version: 1,
            input: {
              ...contextPin,
              acceptanceId: accept.id,
              acceptanceHash: accept.subjectHash,
              activeFrom: since,
              activeTo: until,
              sourceReconciliationHash: evidenceHash,
              openingId: opening.id,
              openingHash: opening.subjectHash,
              historicalProtectionHash: evidenceHash,
              authorityReference: reason,
            },
          });
          cutoverClock?.mockRestore();
          await post(
            checker,
            'foundation/releases/' + release.id + '/approval',
            {
              subjectHash: release.subjectHash,
              evidenceHash,
            },
          );
          await post(checker, 'setup/operating/activate', {
            setupId: final.id,
            setupHash: final.hash,
            releaseId: release.id,
            releaseHash: release.subjectHash,
          });
          for (const p of policies.values())
            await post(checker, 'foundation/policies/' + p.id + '/decisions', {
              action: 'ACTIVATE',
              subjectHash: p.hash,
              evidenceHash: accept.subjectHash,
            });
          await post(
            checker,
            'foundation/releases/' + release.id + '/deployments',
            { subjectHash: release.subjectHash, action: 'ENABLE' },
          );
          const fields = await call(maker, 'document-dimensions/invoice');
          expect(
            fields.find((f: { code: string }) => f.code === 'COST_CENTRE')
              ?.options,
          ).toContainEqual({ value: 'HQ', label: 'Head office' });
          const reversal = await db.query(
            "SELECT finance_fin01_number((finance_fin01_primary($1)).id,'FINANCIAL_REVERSAL') reference",
            [company],
          );
          expect(reversal[0].reference).toMatch(
            new RegExp(
              '^[A-Z0-9]+-D' +
                FINANCE_DOCUMENT_TYPES.indexOf('FINANCIAL_REVERSAL') +
                today.slice(0, 4) +
                '-0001$',
            ),
          );
          const draft = await call(maker, 'invoices', feeInput);
          await expect(
            db.query('UPDATE invoices SET gross_amount=99.999 WHERE id=$1', [
              draft.id,
            ]),
          ).rejects.toMatchObject({ code: 'P0101' });
          const invoice = draft.id;
          const issue = {
            expected_state_version: draft.state_version,
            idempotency_key: 'first-invoice',
            finance_dimensions: { COST_CENTRE: 'HQ', BRANCH: branches[0].id },
          };
          await call(
            maker,
            'invoices/' + invoice + '/issue',
            { ...issue, finance_dimensions: { COST_CENTRE: 'UNAPPROVED' } },
            409,
          );
          expect(
            (
              await db.query('SELECT status FROM invoices WHERE id=$1', [
                invoice,
              ])
            )[0].status,
          ).toBe('DRAFT');
          const [issued, issuedAgain] = await Promise.all([
            call(maker, 'invoices/' + invoice + '/issue', issue),
            call(maker, 'invoices/' + invoice + '/issue', issue),
          ]);
          expect(issuedAgain.journal_candidate_id).toBe(
            issued.journal_candidate_id,
          );
          expect(issued.status).toBe('ISSUED');
          expect(issued.accounting_status).toBe('AWAITING_APPROVAL');
          await call(
            maker,
            'invoices/' + invoice + '/issue',
            { ...issue, notes: 'Different instruction' },
            409,
          );
          expect(
            (await call(maker, 'invoices/' + invoice + '/issue', issue)).id,
          ).toBe(invoice);
          const paymentInput = {
            invoice_id: invoice,
            customer_id: customer,
            provider_code: 'MANUAL',
            payment_reference: 'FIRSTCOLLECTION',
            payment_method: 'CASH',
            currency_code: 'TZS',
            amount: 100,
            payer_name: 'Customer One',
            idempotency_key: 'first-payment',
          };
          const [payment, paymentRetry] = await Promise.all([
            call(maker, 'payment-transactions/manual', paymentInput),
            call(maker, 'payment-transactions/manual', paymentInput),
          ]);
          expect(paymentRetry.id).toBe(payment.id);
          const receiptInput = {
            payment_transaction_id: payment.id,
            invoice_id: invoice,
            allocation_amount: 100,
            idempotency_key: 'first-receipt',
          };
          const receipts = await Promise.all([
            call(maker, 'receipts/post', receiptInput),
            call(maker, 'receipts/post', receiptInput),
          ]);
          expect(receipts[0].id).toBe(receipts[1].id);
          expect(receipts[0].accounting_status).toBe('AWAITING_APPROVAL');
          expect(
            await db.query(
              'SELECT 1 FROM receipt_allocations WHERE receipt_id=$1 AND invoice_id=$2',
              [receipts[0].id, invoice],
            ),
          ).toHaveLength(1);
          const [settled] = await db.query(
            'SELECT balance_amount FROM invoices WHERE id=$1',
            [invoice],
          );
          expect(Number(settled.balance_amount)).toBe(0);
          const pending = await call(
            checker,
            'foundation/operating-postings?' + query,
          );
          expect(pending).toHaveLength(2);
          expect(
            pending.every((p: { lines: unknown[] }) => p.lines.length === 2),
          ).toBe(true);
          for (const p of pending) {
            const path =
                'foundation/operating-postings/' + p.candidateId + '/approve',
              input = { subjectHash: p.hash };
            await post(maker, path, input, 403);
            const firstVote = await post(deputy, path, input);
            expect(firstVote.remainingApprovals).toBe(1);
            expect((await post(deputy, path, input)).remainingApprovals).toBe(
              1,
            );
            const results = await Promise.all([
              post(checker, path, input),
              post(checker, path, input),
            ]);
            expect(results[0].journalId).toBe(results[1].journalId);
            await post(maker, path, input, 403);
          }
          const journals = await db.query(
            `SELECT p.source_type,j.financial_effects,count(l.line_key)::int lines,sum(l.transaction_debit)::float dr,sum(l.transaction_credit)::float cr
   FROM finance_operating_postings p JOIN finance_foundation_journals j ON j.candidate_id=p.candidate_id AND j.mode='LIVE' JOIN finance_foundation_lines l ON l.journal_id=j.id
   WHERE p.company_id=$1 GROUP BY p.source_type,j.id ORDER BY p.source_type`,
            [company],
          );
          const [counts] = await db.query(
            `SELECT (SELECT count(*)::int FROM invoices WHERE company_id=$1) AS invoices,
          (SELECT count(*)::int FROM receipts WHERE company_id=$1) AS receipts,(SELECT count(*)::int FROM payment_transactions WHERE company_id=$1) AS payments,
          (SELECT count(*)::int FROM finance_foundation_journals WHERE book_id=$2 AND mode='LIVE') AS live`,
            [company, scope.bookId],
          );
          expect(counts).toEqual({
            invoices: 1,
            receipts: 1,
            payments: 1,
            live: 2,
          });
          expect(journals).toEqual(
            ['INVOICE', 'RECEIPT'].map((source_type) => ({
              source_type,
              financial_effects: 1,
              lines: 2,
              dr: 100,
              cr: 100,
            })),
          );
          const postedLines = await db.query(
            `SELECT p.source_type, l.account_code, l.transaction_debit::float AS debit,
            l.transaction_credit::float AS credit, l.dimensions->>'COST_CENTRE' AS cost_centre
           FROM finance_operating_postings p
           JOIN finance_foundation_journals j ON j.candidate_id=p.candidate_id AND j.mode='LIVE'
           JOIN finance_foundation_lines l ON l.journal_id=j.id
           WHERE p.company_id=$1 ORDER BY p.source_type,l.account_code`,
            [company],
          );
          expect(postedLines).toEqual([
            {
              source_type: 'INVOICE',
              account_code: '1200',
              debit: 100,
              credit: 0,
              cost_centre: 'HQ',
            },
            {
              source_type: 'INVOICE',
              account_code: '4100',
              debit: 0,
              credit: 100,
              cost_centre: 'HQ',
            },
            {
              source_type: 'RECEIPT',
              account_code: '1100',
              debit: 100,
              credit: 0,
              cost_centre: 'HQ',
            },
            {
              source_type: 'RECEIPT',
              account_code: '1200',
              debit: 0,
              credit: 100,
              cost_centre: 'HQ',
            },
          ]);
          expect(
            await db.query(
              'SELECT 1 FROM finance_journal_entries WHERE company_id=$1',
              [company],
            ),
          ).toHaveLength(0);
          expect(
            (await call(maker, 'invoices/' + invoice + '/issue', issue))
              .accounting_status,
          ).toBe('POSTED');
          expect(
            (await call(maker, 'receipts/post', receiptInput))
              .accounting_status,
          ).toBe('POSTED');
          expect(
            await call(checker, 'foundation/operating-postings?' + query),
          ).toEqual([]);
          for (const type of [
            ...nativeComponents.map((c) => c.kind),
            ...Object.keys(reversalSources),
          ]) {
            await expect(
              readNativeMovement(db.manager, company, 'Africa/Dar_es_Salaam', {
                sourceType: type,
                sourceId: randomUUID(),
                sourceEventId: 'recovery-receipt:' + randomUUID(),
                description: 'Validate deployed source schema',
                currencyCode: 'TZS',
                lines: [],
              }),
            ).rejects.toThrow('matching effective source record');
          }
          await exerciseGeneralLedger({
            since,
            monthStart,
            netOpening: insurer ? 150000 : 0,
            runDue: () => app.get(FinanceGlWorkflowsService).runDue(),
            post,
            call,
            query,
            maker,
            checker,
            deputy,
            today,
            until,
            document,
            branches,
            scope,
            contextPin,
            db,
            journal: app.get(FinanceJournalService),
            cededRecoveries: app.get(ReinsuranceRecoveryService),
            company,
            feeInput,
            paymentInput,
            receiptInput,
            invoiceId: invoice,
            receiptId: receipts[0].id,
            openingId: opening.id,
            openingHash: opening.subjectHash,
          });
          await exerciseTradePayables({
            openingOnly: insurer,
            call,
            post,
            maker,
            checker,
            deputy,
            company,
            scope,
            today,
            document,
            db,
            branch: branches[0].id,
            department: itDepartment.id,
          });
          if (insurer)
            await exerciseInsurerPremium({
              call,
              post,
              maker,
              checker,
              deputy,
              company,
              scope,
              contextPin,
              today,
              feeInput,
              issue,
              query,
              db,
              paymentInput,
              receiptInput,
            });
          const reader = db.createQueryRunner();
          try {
            const { inventory } = jest.requireActual(
              '../../../../scripts/finance-gl-inventory.cjs',
            );
            const report = await inventory({
              query: async (sql: string, params?: unknown[]) => ({
                rows: await reader.query(sql, params),
              }),
            });
            expect(
              report.companies.find((c: { id: string }) => c.id === company),
            ).toMatchObject({
              required: [],
              missingNativeRules: [],
              missingVoucherRules: [],
              deployment: 'ENABLE',
              accounting: { overlaps: 0 },
            });
            await expect(
              new FinanceLedgerPeriodAndBalances1799200000000().down(reader),
            ).rejects.toThrow(
              'Preserve adjustment, schedule and balance history',
            );
            await expect(
              new FinanceLedgerCompletion1799100000000().down(reader),
            ).rejects.toThrow('Preserve FIN-02 corrections');
            await expect(
              new FinanceGeneralLedgerWorkflows1799000000000().down(reader),
            ).rejects.toThrow('Preserve recorded FIN-02 history');
          } finally {
            await reader.release();
          }
        },
        insurer,
      );
    },
    480000,
  );
});
