-- Insurance Max Finance review preflight. Read-only preparation only.
-- Run only against the separately verified intended target with an approved reader.
-- Protected invoice IDs are private. Populate the NULL rows from the secured manifest.
-- Empty placeholders must fail the operator gate; zero returned rows is NOT reconciliation.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';
SELECT current_database() AS database_name, inet_server_addr() AS server_address,
       current_user AS database_user, current_setting('transaction_read_only') AS read_only,
       current_setting('TimeZone') AS database_timezone, statement_timestamp() AS observed_at;
SELECT id, timestamp, name FROM migrations ORDER BY id;
WITH expected(name) AS (VALUES
  ('FinanceScopeFoundations1796000000000'),
  ('FinanceConfigurationReviews1796100000000'),
  ('FinanceChartSourceAuthorities1796200000000'),
  ('FinanceJournalCandidates1796300000000'),
  ('FinanceApprovalGovernance1796400000000'),
  ('FinanceEventContractPreviews1796500000000'),
  ('FinanceIntegrationReliability1796600000000'),
  ('FinanceOwnedExceptions1796700000000'),
  ('FinanceQuotationMemoranda1796800000000'),
  ('FinanceReceivableControls1797000000000'),
  ('FinancePolicyGovernance1797100000000'),
  ('FinanceLedgerFoundation1797200000000'))
SELECT e.name, EXISTS(SELECT 1 FROM migrations m WHERE m.name=e.name) AS already_applied
FROM expected e ORDER BY e.name;
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND (table_name LIKE 'finance_foundation_%'
 OR table_name LIKE 'finance_policy%' OR table_name IN ('finance_legal_entities',
 'finance_accounting_books','finance_configuration_releases','finance_confirmed_receipts'))
ORDER BY table_name;
WITH protected(label,id) AS (VALUES ('HIST-01',NULL::uuid),('HIST-02',NULL::uuid),
 ('HIST-03',NULL::uuid),('HIST-04',NULL::uuid))
SELECT label,CASE WHEN id IS NULL THEN 'BLOCKED_PRIVATE_ID_NOT_SET' ELSE 'READY_FOR_PRIVATE_HASH_COMPARISON' END AS protection_status FROM protected;
SELECT account_code,account_type,is_active FROM finance_accounts ORDER BY account_code;
SELECT 'invoices' AS population,count(*) FROM invoices UNION ALL
SELECT 'invoice_items',count(*) FROM invoice_items UNION ALL
SELECT 'receipts',count(*) FROM receipts UNION ALL
SELECT 'receipt_allocations',count(*) FROM receipt_allocations UNION ALL
SELECT 'finance_journal_entries',count(*) FROM finance_journal_entries UNION ALL
SELECT 'finance_journal_lines',count(*) FROM finance_journal_lines;
ROLLBACK;
-- Compare exact protected headers/items and all scoped source/control totals with the
-- secured SHA-256 manifest using the reviewed private snapshot tool. Counts alone
-- cannot certify integrity. This file performs no schema, grant or data mutation.
