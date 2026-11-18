import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  FINANCE_UUID,
  financeConfigurationHash,
} from '../../foundation/finance-configuration/finance-configuration.types';
import {
  validateIntegrationProfile,
  type IntegrationWorker,
  type IntegrationScope,
  type IntegrationProfile,
  type IntegrationLease,
} from './finance-integration.types';
export type IntegrationPermission =
  | 'PROCESS_INTAKE'
  | 'PROCESS_INBOX'
  | 'DELIVER_OUTBOX'
  | 'RECEIVE_OUTCOME'
  | 'READ_RECONCILIATION';
export function requireUuid(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !FINANCE_UUID.test(value))
    throw new BadRequestException('An exact integration UUID is required.');
}
export function integrationWorker(p: IntegrationWorker): IntegrationWorker {
  if (!p || p.kind !== 'WORKER')
    throw new ForbiddenException('A verified integration worker is required.');
  requireUuid(p.tenantId);
  requireUuid(p.subjectId);
  return Object.freeze({
    kind: 'WORKER',
    tenantId: p.tenantId.toLowerCase(),
    subjectId: p.subjectId.toLowerCase(),
  });
}
export function integrationScope(s: IntegrationScope): IntegrationScope {
  requireUuid(s?.legalEntityId);
  requireUuid(s?.bookId);
  return Object.freeze({
    legalEntityId: s.legalEntityId.toLowerCase(),
    bookId: s.bookId.toLowerCase(),
  });
}
export async function integrationGrant(
  m: EntityManager,
  p: IntegrationWorker,
  permission: IntegrationPermission,
  s?: IntegrationScope,
  lock = true,
  consumerId?: string,
) {
  if (permission === 'RECEIVE_OUTCOME' && !consumerId)
    throw new ForbiddenException('An exact consumer authority is required.');
  const params = [
    p.tenantId,
    p.subjectId,
    permission,
    ...(s ? [s.legalEntityId, s.bookId] : []),
    ...(consumerId ? [consumerId] : []),
  ];
  const query = `SELECT id FROM finance_integration_authorities WHERE tenant_id=$1 AND subject_id=$2 AND permission=$3 AND ${s ? 'legal_entity_id=$4 AND book_id=$5' : 'legal_entity_id IS NULL AND book_id IS NULL'} ${consumerId ? 'AND consumer_id=$6' : ''} AND state='ENABLED' AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp()) ORDER BY id LIMIT 1${lock ? ' FOR SHARE' : ''}`;
  const [grant] = await m.query(query, params);
  if (!grant)
    throw new ForbiddenException(
      'Current exact integration authority is required.',
    );
  return async () => {
    if (
      !(await m.query(query, params)).some(
        (r: { id: string }) => r.id === grant.id,
      )
    )
      throw new ForbiddenException(
        'Integration authority expired before completion.',
      );
  };
}
export async function integrationBook(
  m: EntityManager,
  p: IntegrationWorker,
  s: IntegrationScope,
  lock = true,
) {
  const [book] = await m.query(
    `SELECT b.id FROM finance_accounting_books b JOIN finance_legal_entities e ON e.id=b.legal_entity_id AND e.tenant_id=b.tenant_id WHERE b.tenant_id=$1 AND b.legal_entity_id=$2 AND b.id=$3 AND b.state='DRAFT' AND e.state='DRAFT'${lock ? ' FOR SHARE OF b,e' : ''}`,
    [p.tenantId, s.legalEntityId, s.bookId],
  );
  if (!book)
    throw new ForbiddenException(
      'The inactive integration book is unavailable.',
    );
}
export interface ProfileReference {
  tenant_id: string;
  legal_entity_id: string;
  book_id: string;
  profile_id: string;
  profile_hash: string;
}
export async function integrationProfile(
  m: EntityManager,
  r: ProfileReference,
): Promise<IntegrationProfile> {
  const [row] = await m.query(
    "SELECT * FROM finance_configuration_releases WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 AND release_hash=$5 AND kind='INTEGRATION_RULES' AND state='REVIEWED_INACTIVE' AND effective_from<=(statement_timestamp() AT TIME ZONE 'UTC')::date AND (effective_to IS NULL OR effective_to>(statement_timestamp() AT TIME ZONE 'UTC')::date) FOR SHARE",
    [r.tenant_id, r.legal_entity_id, r.book_id, r.profile_id, r.profile_hash],
  );
  if (!row)
    throw new ConflictException(
      'An exact current reviewed inactive integration profile is required.',
    );
  return validateIntegrationProfile(row.payload, row.dependency_refs);
}
export interface IntegrationAudit {
  tenantId: string | null;
  legalEntityId?: string;
  bookId?: string;
  kind: 'intake' | 'conflict' | 'inbox' | 'outbox' | 'receipt';
  id: string;
  action: string;
  version: number;
  leaseToken?: string;
  actor: string;
  hash: string;
  reason: string;
}
export async function integrationAudit(m: EntityManager, a: IntegrationAudit) {
  const ids = ['intake', 'conflict', 'inbox', 'outbox', 'receipt'].map(
    (kind) => (a.kind === kind ? a.id : null),
  );
  await m.query(
    'INSERT INTO finance_integration_audits(tenant_id,legal_entity_id,book_id,intake_id,conflict_id,inbox_id,outbox_id,receipt_id,action,version,lease_token,actor_subject_id,subject_hash,reason_code) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',
    [
      a.tenantId,
      a.legalEntityId ?? null,
      a.bookId ?? null,
      ...ids,
      a.action,
      a.version,
      a.leaseToken ?? null,
      a.actor,
      a.hash,
      a.reason,
    ],
  );
}
export function integrationSnapshot(
  row: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [
      k,
      v instanceof Date ? v.toISOString() : v,
    ]),
  );
}
export function channelHash(row: Record<string, unknown>) {
  return financeConfigurationHash(integrationSnapshot(row));
}
/** An approved replay adds a bounded attempt window without resetting history. */
export async function referenceAttemptCeiling(
  m: EntityManager,
  tenantId: string,
  lane: 'INTAKE' | 'OUTBOX',
  itemId: string,
  base: number,
): Promise<number> {
  const [r] = await m.query(
    "SELECT e.attempt_ceiling FROM finance_replay_executions e JOIN finance_replay_requests r ON r.id=e.request_id WHERE e.tenant_id=$1 AND e.lane=$2 AND e.item_id=$3 AND r.state='EXECUTED' ORDER BY e.after_version DESC LIMIT 1",
    [tenantId, lane, itemId],
  );
  return r?.attempt_ceiling ?? base;
}
export async function checkLease(
  m: EntityManager,
  table: 'finance_integration_intakes' | 'finance_reference_outbox',
  p: IntegrationWorker,
  lease: IntegrationLease,
  scope?: IntegrationScope,
) {
  const [row] = await m.query(
    `SELECT * FROM ${table} WHERE tenant_id=$1 AND id=$2 AND state='LEASED' AND lease_token=$3 AND version=$4 AND lease_subject_id=$5 AND lease_until>statement_timestamp() ${scope ? 'AND legal_entity_id=$6 AND book_id=$7' : ''} FOR UPDATE`,
    [
      p.tenantId,
      lease.id,
      lease.token,
      lease.version,
      p.subjectId,
      ...(scope ? [scope.legalEntityId, scope.bookId] : []),
    ],
  );
  if (!row)
    throw new ConflictException(
      'Integration lease is stale, expired or belongs to another worker.',
    );
  return row;
}
