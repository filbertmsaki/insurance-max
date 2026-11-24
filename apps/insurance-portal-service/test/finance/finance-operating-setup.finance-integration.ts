import { FinanceGeneralLedgerWorkflows1799000000000 } from '../../src/database/migrations/1799000000000-FinanceGeneralLedgerWorkflows';
import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { MigrationInterface } from 'typeorm';
import { withFinanceTestDatabase } from '../support/finance-test-database';
import { installFinanceBaseline } from '../support/finance-baseline';
import { activateOperatingFixture } from '../support/finance-operating-setup-fixture';
import { FinanceSetupService } from '../../src/modules/tenant/finance/foundation/finance-setup/finance-setup.service';
import { FinancePostingPolicyService } from '../../src/modules/tenant/finance/accounting/posting-rules/finance-posting-policy.service';
import { withdrawBook } from '../../src/modules/tenant/finance/foundation/finance-setup/finance-operating-book';
import { FinanceOperatingSetup1798900000000 } from '../../src/database/migrations/1798900000000-FinanceOperatingSetup';

describe('FIN-01 on the application migration chain', () => {
  it(
    'gates ordinary writes on every operational table and preserves historical data and signed provider observations',
    () =>
      withFinanceTestDatabase(
        async ({ dataSource: db }) => {
          const q = db.createQueryRunner();
          const directory = join(__dirname, '../../src/database/migrations');
          try {
            await q.query(
              'CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public',
            );
            for (const file of readdirSync(directory)
              .filter((f) => /^\d+.*\.ts$/.test(f))
              .sort()) {
              if (file.startsWith('1798900000000')) break;
              if (file.startsWith('1786736437722-')) {
                await installFinanceBaseline(q);
                continue;
              }
              const module = jest.requireActual(join(directory, file));
              const cls = Object.values(module).find(
                (v: any) => typeof v === 'function' && v.prototype?.up,
              ) as new () => MigrationInterface;
              if (!cls) throw Error('Missing migration ' + file);
              await new cls().up(q);
            }
            const company = randomUUID(),
              customer = randomUUID(),
              openingInvoice = randomUUID();
            await q.query(
              "INSERT INTO companies(id,name,slug,identifier_prefix) VALUES($1,'Finance fixture','finance-fixture','FNX')",
              [company],
            );
            await q.query(
              "INSERT INTO customers(id,company_id,customer_no,display_name,customer_type,phone,country_code,region,district) VALUES($1,$2,'C1','Finance fixture','INDIVIDUAL','000000000','TZ','Dar es Salaam','Ilala')",
              [customer, company],
            );
            await q.query(
              "INSERT INTO invoices(id,company_id,insurer_company_id,customer_id,invoice_no,invoice_type) VALUES($1,$2,$2,$3,'HIST-1','PREMIUM')",
              [openingInvoice, company, customer],
            );
            await q.query(
              "INSERT INTO invoices(company_id,insurer_company_id,customer_id,invoice_no,invoice_type) VALUES($1,$1,$2,'FNX-D0-0001','PREMIUM')",
              [company, customer],
            );
            await q.query(
              "INSERT INTO generated_identifiers(identifier_type,identifier_value,company_id) VALUES('INVOICE','FNX-D0-0002',$1)",
              [company],
            );
            const migration = new FinanceOperatingSetup1798900000000();
            await migration.up(q);
            expect(
              await q.query(
                'SELECT invoice_no,payment_term_code FROM invoices WHERE id=$1',
                [openingInvoice],
              ),
            ).toEqual([{ invoice_no: 'HIST-1', payment_term_code: null }]);
            for (const table of [
              'invoices',
              'receipts',
              'receipt_allocations',
              'payment_transactions',
              'finance_refunds',
              'commission_transactions',
              'commission_payments',
              'finance_reconciliation_batches',
              'finance_journal_entries',
              'payment_references',
              'financial_reversals',
              'claim_reserves',
              'claim_discharge_vouchers',
              'claim_payments',
              'claim_disbursements',
              'claim_recoveries',
              'reinsurance_settlements',
              'reinsurance_claim_recoveries',
              'reinsurance_recovery_receipts',
            ]) {
              await expect(
                q.query('INSERT INTO ' + table + '(company_id) VALUES($1)', [
                  company,
                ]),
              ).rejects.toMatchObject({ code: 'P0101' });
            }
            await q.query(
              "INSERT INTO finance_provider_events(provider_code,provider_event_id,event_type,signature_valid,payload_hash,payload_redacted,status) VALUES('BANK','ev-1','PAYMENT',true,$1,'{}','RECEIVED')",
              ['a'.repeat(64)],
            );
            await q.query(
              "INSERT INTO payment_transactions(company_id,invoice_id,transaction_no,provider,provider_code,provider_reference,provider_event_id,internal_reference,provider_payload_hash,amount,currency,status) VALUES($1,$2,'PAY-1','BANK','BANK','BANK-1','ev-1','PAY-1',$3,10,'TZS','SUCCESS')",
              [company, openingInvoice, 'a'.repeat(64)],
            );
            await expect(
              q.query(
                "INSERT INTO payment_transactions(company_id,provider_code,provider_event_id,provider_payload_hash) VALUES($1,'BANK','ev-1',$2)",
                [company, 'b'.repeat(64)],
              ),
            ).rejects.toMatchObject({ code: 'P0101' });
            await migration.down(q);
            expect(
              await q.query('SELECT invoice_no FROM invoices WHERE id=$1', [
                openingInvoice,
              ]),
            ).toEqual([{ invoice_no: 'HIST-1' }]);
            await migration.up(q);
            const glMigration =
              new FinanceGeneralLedgerWorkflows1799000000000();
            await glMigration.up(q);
            await glMigration.down(q);
            expect(
              await q.query(
                "SELECT to_regclass('public.finance_gl_deployments') AS deployment",
              ),
            ).toEqual([{ deployment: null }]);
            expect(
              await q.query('SELECT invoice_no FROM invoices WHERE id=$1', [
                openingInvoice,
              ]),
            ).toEqual([{ invoice_no: 'HIST-1' }]);
            const { ids, actor, activation } = await db.transaction((m) =>
              activateOperatingFixture(m, company, customer),
            );
            expect(
              await db.query('SELECT finance_fin01_current($1) AS ready', [
                activation.id,
              ]),
            ).toEqual([{ ready: true }]);
            const inventory = await db.transaction((m) =>
              new FinanceSetupService(db).inventory(m, actor, {
                legalEntityId: ids[1],
                bookId: ids[2],
              }),
            );
            expect(inventory.company.id).toBe(company);
            expect(inventory.reportingEntity.legal_name).toBe(
              'Finance fixture',
            );
            expect(inventory.tanzaniaSource).toHaveProperty('profile');
            await expect(
              db.transaction((m) =>
                new FinancePostingPolicyService().requireEligible(m, {
                  companyId: company,
                  sourceType: 'INVOICE',
                  currency: 'TZS',
                  accountMappings: [],
                }),
              ),
            ).rejects.toMatchObject({
              response: { code: 'FINANCE_POSTING_HELD' },
            });
            const numbers = await Promise.all(
              Array.from({ length: 8 }, () =>
                db.query("SELECT finance_fin01_number($1,'INVOICE') AS n", [
                  activation.id,
                ]),
              ),
            );
            expect(numbers.map(([r]) => r.n).sort()).toEqual(
              Array.from(
                { length: 8 },
                (_, i) => 'FNX-D0-' + String(i + 3).padStart(4, '0'),
              ),
            );
            expect(
              await db.query(
                "SELECT count(*)::int AS count FROM generated_identifiers WHERE company_id=$1 AND identifier_type='INVOICE'",
                [company],
              ),
            ).toEqual([{ count: 9 }]);
            const [invoice] = await db.query(
              "INSERT INTO invoices(company_id,insurer_company_id,customer_id,invoice_no,invoice_type) VALUES($1,$1,$2,'NUM-2','PREMIUM') RETURNING payment_term_code,due_date-(statement_timestamp() AT TIME ZONE 'Africa/Dar_es_Salaam')::date AS days",
              [company, customer],
            );
            expect(invoice).toEqual({ payment_term_code: 'D14', days: 14 });
            const [receipt] = await db.query(
              "INSERT INTO receipts(company_id,customer_id,receipt_no,payment_method) VALUES($1,$2,'RC-2','CASH') RETURNING settlement_account_code",
              [company, customer],
            );
            expect(receipt.settlement_account_code).toBe('1111');
            await expect(
              db.query(
                "INSERT INTO receipts(company_id,customer_id,receipt_no,payment_method) VALUES($1,$2,'RC-3','CHEQUE')",
                [company, customer],
              ),
            ).rejects.toMatchObject({ code: 'P0101' });
            await expect(
              db.query(
                "INSERT INTO invoices(company_id,insurer_company_id,customer_id,invoice_no,invoice_type,currency) VALUES($1,$1,$2,'NUM-3','PREMIUM','USD')",
                [company, customer],
              ),
            ).rejects.toMatchObject({ code: 'P0101' });
            await expect(
              db.query(
                'INSERT INTO finance_journal_entries(company_id,journal_date) VALUES($1,current_date-5)',
                [company],
              ),
            ).rejects.toMatchObject({ code: 'P0101' });
            for (const table of [
              'claim_disbursements',
              'reinsurance_settlements',
            ]) {
              await expect(
                db.query(
                  'INSERT INTO ' +
                    table +
                    "(company_id,status,payment_method) VALUES($1,'PAID','CHEQUE')",
                  [company],
                ),
              ).rejects.toMatchObject({ code: 'P0101' });
            }
            const reviewer = randomUUID(),
              maker = randomUUID();
            await db.query(
              "INSERT INTO users(id,first_name,last_name,phone,email) VALUES($1,'Test','Reviewer','0000000001','checker@example.invalid'),($2,'Test','Maker','0000000002','maker@example.invalid')",
              [reviewer, maker],
            );
            const [membership] = await db.query(
              'INSERT INTO company_users(company_id,user_id) VALUES($1,$2) RETURNING id',
              [company, reviewer],
            );
            const [role] = await db.query(
              "INSERT INTO roles(name,display_name,company_id) VALUES('finance-checker','Finance Checker',$1) RETURNING id",
              [company],
            );
            await db.query(
              'INSERT INTO company_user_roles(company_user_id,role_id) VALUES($1,$2)',
              [membership.id, role.id],
            );
            const approve = (
              amount: string,
              importer: string,
              checker: string,
            ) =>
              db.query(
                "INSERT INTO finance_reconciliation_batches(company_id,batch_no,status,currency_code,approved_by,imported_by,statement_total,provider_code,statement_date) VALUES($1,$2,'APPROVED','TZS',$3,$4,$5,'BANK',current_date) RETURNING status",
                [company, randomUUID(), checker, importer, amount],
              );
            expect(await approve('1000', maker, reviewer)).toEqual([
              { status: 'APPROVED' },
            ]);
            await expect(
              approve('1000.01', maker, reviewer),
            ).rejects.toMatchObject({ code: 'P0101' });
            await expect(
              approve('1', reviewer, reviewer),
            ).rejects.toMatchObject({ code: 'P0101' });
            await expect(approve('1', reviewer, maker)).rejects.toMatchObject({
              code: 'P0101',
            });
            await db.query("UPDATE companies SET tin='CHANGED' WHERE id=$1", [
              company,
            ]);
            expect(
              await db.query('SELECT finance_fin01_current($1) AS ready', [
                activation.id,
              ]),
            ).toEqual([{ ready: false }]);
            await expect(
              db.query('UPDATE invoices SET notes=$2 WHERE id=$1', [
                openingInvoice,
                'Frozen',
              ]),
            ).rejects.toMatchObject({ code: 'P0101' });
            await db.transaction((m) =>
              withdrawBook(m, actor, ids, activation.id, 'Withdraw fixture'),
            );
            expect(
              await db.query(
                'SELECT finance_primary_setup_id FROM companies WHERE id=$1',
                [company],
              ),
            ).toEqual([{ finance_primary_setup_id: null }]);
          } finally {
            await q.release();
          }
        },
        process.env,
        'empty',
      ),
    120000,
  );
});
