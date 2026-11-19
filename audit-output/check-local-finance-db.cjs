// Read-only inspection of the configured local development portal database.
const path = require('node:path');
const { config } = require('dotenv');
const { Client } = require('pg');

config({
  path: path.resolve(__dirname, '../apps/insurance-portal-service/.env'),
  quiet: true,
});
const host = process.env.DB_HOST;
const database = process.env.DB_DATABASE || process.env.DB_NAME;
if (!['localhost', '127.0.0.1', '::1'].includes(host) ||
    process.env.NODE_ENV === 'production' ||
    process.env.APP_ENV === 'production') {
  throw new Error('This inspection is restricted to a local development database.');
}
const client = new Client({
  host,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database,
  connectionTimeoutMillis: 5000,
  application_name: 'finance_p0_read_only_inspection',
});
(async () => {
  await client.connect();
  await client.query('BEGIN READ ONLY');
  try {
    const migrations = await client.query('SELECT count(*)::int AS n FROM migrations');
    const journals = await client.query('SELECT count(*)::int AS n FROM finance_journal_entries');
    const duplicateSources = await client.query(`
      SELECT count(*)::int AS n FROM (
        SELECT company_id, source_type, source_event_id
        FROM finance_journal_entries GROUP BY 1,2,3 HAVING count(*) > 1
      ) duplicates`);
    const unbalanced = await client.query(`
      SELECT count(*)::int AS n FROM (
        SELECT j.id FROM finance_journal_entries j
        LEFT JOIN finance_journal_lines l ON l.journal_entry_id=j.id
        GROUP BY j.id
        HAVING count(l.id)<2 OR coalesce(sum(l.debit),0)<>coalesce(sum(l.credit),0)
           OR coalesce(sum(l.debit),0)<=0
      ) invalid`);
    console.log(JSON.stringify({
      database, migrations: migrations.rows[0].n,
      journals: journals.rows[0].n,
      duplicateSourceKeys: duplicateSources.rows[0].n,
      unbalancedJournals: unbalanced.rows[0].n,
    }));
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
