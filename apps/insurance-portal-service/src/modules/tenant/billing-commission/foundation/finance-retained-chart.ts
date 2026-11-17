import type { EntityManager } from 'typeorm';
/** A newly reviewed inactive proposal must not withdraw a separately approved live chart. */
export async function retainedChartAuthorized(
  manager: EntityManager,
  scope: string[],
  chartId: string,
  chartHash: string,
  date: string,
) {
  const [{ deployed }] = await manager.query(
    "SELECT to_regclass('public.finance_foundation_documents') IS NOT NULL deployed",
  );
  if (!deployed) return false;
  const [pin] = await manager.query(
    `SELECT r.id FROM finance_foundation_documents r JOIN finance_foundation_decisions e ON e.document_id=r.id JOIN finance_foundation_documents c ON c.id=r.parent_id WHERE r.tenant_id=$1 AND r.legal_entity_id=$2 AND r.book_id=$3 AND r.kind='RELEASE' AND r.mode='LIVE' AND e.state='APPROVED' AND c.payload->>'chartReleaseId'=$4 AND c.payload->>'chartReleaseHash'=$5 AND r.payload->>'activeFrom'<=$6 AND r.payload->>'activeTo'>$6 LIMIT 1`,
    [...scope, chartId, chartHash, date],
  );
  return !!pin;
}
