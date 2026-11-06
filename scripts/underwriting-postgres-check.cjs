const { Client, Pool } = require('pg');
const { parse } = require('dotenv');
const { readFileSync, existsSync } = require('fs');
const { randomBytes } = require('crypto');
require('ts-node').register({ transpileOnly: true });
require('tsconfig-paths/register');
const { ProductPerformanceSnapshotService } = require('../apps/insurance-portal-service/src/modules/tenant/reporting/services/product-performance-snapshot.service');
const { QuotationsService } = require('../apps/insurance-portal-service/src/modules/tenant/quotations/quotations.service');
const { QuotationOfferValidity1795600000000 } = require('../apps/insurance-portal-service/src/database/migrations/1795600000000-QuotationOfferValidity');

(async () => {
  const envPath = 'apps/insurance-portal-service/.env';
  const localEnv = existsSync(envPath) ? parse(readFileSync(envPath)) : {};
  const username = process.env.DB_USERNAME || localEnv.DB_USERNAME;
  const password = process.env.DB_PASSWORD || localEnv.DB_PASSWORD;
  const name = `insurance_uwcheck_${randomBytes(8).toString('hex')}`;
  if (!/^insurance_uwcheck_[0-9a-f]{16}$/.test(name)) throw new Error('Invalid test database name');
  const connection = { host: '127.0.0.1', port: 5432, user: username, password, connectionTimeoutMillis: 3000 };
  const admin = new Client({ ...connection, database: 'postgres' });
  let created = false;
  let pool;
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    pool = new Pool({ ...connection, database: name });
    await pool.query(`
      CREATE TABLE quotations (id text, deleted_at timestamptz);
      INSERT INTO quotations VALUES ('legacy', NULL);
      CREATE TABLE policies (id text, company_id text, branch_id text, department_id text, created_by text,
        product_id text, currency text, total_premium numeric, ceded_premium numeric, total_commission numeric,
        start_date date, end_date date, issue_date date, deleted_at timestamptz);
      CREATE TABLE claims (id text, policy_id text, company_id text, currency_code text, paid_amount numeric,
        outstanding_reserve numeric, created_at timestamptz);
      CREATE TABLE invoices (id text, source_record_id text, source_type text, company_id text,
        currency text, paid_amount numeric, deleted_at timestamptz, quotation_id text, source_revision int,
        status text, total_amount numeric, pricing_result_hash text, created_at timestamptz DEFAULT now());
      CREATE TABLE receipts (id text, company_id text, currency text, status text, posted_at timestamptz, deleted_at timestamptz);
      CREATE TABLE receipt_allocations (id text, receipt_id text, invoice_id text, company_id text, status text, currency text, amount numeric);
      CREATE TABLE finance_refunds (id text, invoice_id text, company_id text, status text, amount numeric);
      CREATE TABLE product_performance_snapshots (company_id text, branch_id text, department_id text, user_id text,
        product_id text, currency text, snapshot_date date, period_start date, period_end date,
        gross_written_premium numeric, earned_premium numeric, premium_collected numeric, claims_incurred numeric,
        claims_paid numeric, outstanding_reserve numeric, ceded_premium numeric, commissions numeric,
        policies_count integer, claims_count integer, loss_ratio numeric);
      INSERT INTO policies VALUES
        ('p1','co','b',null,null,'product','TZS',365,0,0,'2026-01-01','2026-12-31','2026-01-01',null),
        ('p2','co','b',null,null,'product','USD',730,0,0,'2026-01-01','2026-12-31','2026-01-01',null);
      INSERT INTO claims VALUES ('c1','p2','co','USD',20,30,'2026-01-10');
      INSERT INTO invoices (id,source_record_id,source_type,company_id,currency,paid_amount) VALUES ('i1','p1','POLICY','co','TZS',50);
      INSERT INTO invoices (id,source_record_id,source_type,company_id,currency,paid_amount,quotation_id,source_revision,status,total_amount) VALUES ('iq','q1','QUOTATION','co','TZS',100,'q1',1,'PAID',100);
      INSERT INTO receipts VALUES ('r1','co','TZS','FULLY_ALLOCATED',now(),null);
      INSERT INTO receipt_allocations VALUES ('a1','r1','iq','co','ACTIVE','TZS',80);
    `);
    const migration = new QuotationOfferValidity1795600000000();
    const runner = { query: (sql, params) => pool.query(sql, params) };
    await migration.up(runner);
    const oldOffer = (await pool.query("SELECT offer_finalized_at, offer_expires_at FROM quotations WHERE id = 'legacy'")).rows[0];
    if (oldOffer.offer_finalized_at !== null || oldOffer.offer_expires_at !== null) throw new Error('Legacy quotation changed');
    await migration.down(runner);
    await migration.up(runner);
    const dataSource = { transaction: async (handler) => {
      const client = await pool.connect();
      try { await client.query('BEGIN'); const value = await handler({ query: (sql, params) => client.query(sql, params).then((r) => r.rows) }); await client.query('COMMIT'); return value; }
      catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    }};
    const service = new ProductPerformanceSnapshotService(dataSource);
    const args = { companyId:'co', periodStart:'2026-01-01', periodEnd:'2026-01-31', snapshotDate:'2026-02-01' };
    await service.refreshSnapshots(args);
    let rows = (await pool.query('SELECT currency, earned_premium, claims_paid, premium_collected FROM product_performance_snapshots ORDER BY currency')).rows;
    const tzs = rows.find((row) => row.currency === 'TZS');
    const usd = rows.find((row) => row.currency === 'USD');
    if (rows.length !== 2 || !tzs || !usd || Number(usd.claims_paid) !== 20 || Number(usd.premium_collected) !== 0 || Number(tzs.claims_paid) !== 0 || Number(tzs.premium_collected) !== 50 || Number(tzs.earned_premium) !== 31) throw new Error('Currency or earning mismatch');
    await pool.query("ALTER TABLE product_performance_snapshots ADD CONSTRAINT uw_test_reject CHECK (currency <> 'TZS') NOT VALID");
    let failed = false;
    try { await service.refreshSnapshots(args); } catch { failed = true; }
    if (!failed || Number((await pool.query('SELECT count(*) AS n FROM product_performance_snapshots')).rows[0].n) !== 2) throw new Error('Rollback check failed');
    await pool.query('ALTER TABLE product_performance_snapshots DROP CONSTRAINT uw_test_reject');
    await Promise.all([service.refreshSnapshots(args), service.refreshSnapshots(args)]);
    if (Number((await pool.query('SELECT count(*) AS n FROM product_performance_snapshots')).rows[0].n) !== 2) throw new Error('Concurrent refresh check failed');
    const quotation = { company_id:'co', id:'q1', workflow_revision:4, cover_note:{ currency_code:'TZS', total_premium_including_tax:'100' } };
    const target = { dataSource: { query: (sql, params) => pool.query(sql, params).then((result) => result.rows) }, resolveQuotationPricingResultHash: () => null };
    let blocked = false;
    try { await QuotationsService.prototype.assertPaymentReady.call(target, quotation); } catch { blocked = true; }
    if (!blocked) throw new Error('Unallocated invoice was accepted');
    await pool.query("INSERT INTO receipt_allocations VALUES ('a2','r1','iq','co','ACTIVE','TZS',20)");
    await QuotationsService.prototype.assertPaymentReady.call(target, quotation);
    await pool.query("INSERT INTO finance_refunds VALUES ('f1','iq','co','PAID',10)");
    blocked = false;
    try { await QuotationsService.prototype.assertPaymentReady.call(target, quotation); } catch { blocked = true; }
    if (!blocked) throw new Error('Refunded invoice was accepted');
    process.stdout.write('PASS: isolated PostgreSQL currency grouping, earned premium, snapshot rollback and concurrency, offer migration, and receipt-backed clearance\n');
  } finally {
    if (pool) await pool.end();
    if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
  }
})().catch((error) => { process.stderr.write(`Isolated PostgreSQL check failed (${error.code || 'test error'}): ${error.message}\n`); process.exitCode = 1; });
