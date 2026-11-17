# FIN-03 scope-dimension rollout

Migration `1797700000000-FinanceDimensionScopeFences` adds checks for optional `TENANT`, `LEGAL_ENTITY` and `BOOK` dimensions on candidate and foundation ledger lines. If supplied, each must match the corresponding row scope UUID, ignoring case. Chart configuration remains responsible for requiring dimensions; other dimension values are not validated by this migration.

The checks are installed `NOT VALID`: PostgreSQL enforces them for new or updated rows, but existing rows are not certified. Before validating either constraint, audit the affected environment with the following read-only query (the table names are fixed, not user input):

```sql
SELECT 'candidate' AS source, count(*) AS inconsistent_lines
FROM finance_journal_candidate_lines
WHERE (dimensions ? 'TENANT' AND COALESCE(lower(dimensions->>'TENANT'), '') <> tenant_id::text)
   OR (dimensions ? 'LEGAL_ENTITY' AND COALESCE(lower(dimensions->>'LEGAL_ENTITY'), '') <> legal_entity_id::text)
   OR (dimensions ? 'BOOK' AND COALESCE(lower(dimensions->>'BOOK'), '') <> book_id::text)
UNION ALL
SELECT 'ledger', count(*)
FROM finance_foundation_lines
WHERE (dimensions ? 'TENANT' AND COALESCE(lower(dimensions->>'TENANT'), '') <> tenant_id::text)
   OR (dimensions ? 'LEGAL_ENTITY' AND COALESCE(lower(dimensions->>'LEGAL_ENTITY'), '') <> legal_entity_id::text)
   OR (dimensions ? 'BOOK' AND COALESCE(lower(dimensions->>'BOOK'), '') <> book_id::text);
```

Investigate and resolve any discrepancies through the approved financial correction process; do not silently rewrite immutable ledger history. Once each count is zero and the relevant change controls are satisfied, the database operator can validate the constraints:

```sql
ALTER TABLE finance_journal_candidate_lines VALIDATE CONSTRAINT "CK_fin_candidate_dimension_scope";
ALTER TABLE finance_foundation_lines VALIDATE CONSTRAINT "CK_fin_ledger_dimension_scope";
```

This migration does not enable production posting. Company dimension masters, approved allocation policies and branch balancing remain separate FIN-03 work.
