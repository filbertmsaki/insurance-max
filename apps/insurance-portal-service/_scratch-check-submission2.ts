import { DataSource } from 'typeorm';

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'root',
    database: 'insurance_portal_db',
  });
  await ds.initialize();
  const rows = await ds.query(
    `select id, status, status_code, status_description, last_error,
            business_reference, source_module, source_record_id,
            tiramis_transaction_id, tiramis_request_id, submitted_at, last_event_at
     from portal_tira_submissions
     where source_record_id = $1 or business_reference = $2
     order by submitted_at desc`,
    ['0ac31691-b795-498e-be8a-f4ed729c772a', 'AICL-CXL-260910-00001'],
  );
  console.log(JSON.stringify(rows, null, 2));

  const events = await ds.query(
    `select event_type, source_service, status_code, status_description, error_message, occurred_at
     from portal_tira_submission_events
     where business_reference = $1
     order by occurred_at asc`,
    ['AICL-CXL-260910-00001'],
  );
  console.log('EVENTS', JSON.stringify(events, null, 2));
  await ds.destroy();
}
main().catch((e) => { console.error(e); process.exit(1); });
