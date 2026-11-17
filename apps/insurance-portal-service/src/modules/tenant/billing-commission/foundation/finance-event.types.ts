import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  canonicalFinanceJson,
  financeConfigurationHash,
  FINANCE_UUID,
} from './finance-configuration.types';
import {
  candidateCode,
  candidateRevision,
  candidateText,
} from './finance-journal-candidate.types';
import { approvalFields, APPROVAL_HASH } from './finance-approval.types';

/** Trusted transport/IAM identity, never constructed from an event body. */
export interface FinanceProducerPrincipal {
  readonly kind: 'WORKER';
  readonly tenantId: string;
  readonly subjectId: string;
  readonly producerId: string;
}
export interface FinanceEventContract {
  schema: 'FINANCE_EVENT_CONTRACT_V1';
  purpose: 'SOURCE_FACT_REFERENCE';
  eventType: string;
  schemaVersion: '1.0.0';
  producerId: string;
  sourceSystem: string;
  aggregateType: string;
  factKind: string;
  codec: 'SOURCE_SNAPSHOT_REFERENCE_V1';
}
export interface FinanceEventRoute {
  schema: 'FINANCE_EVENT_ROUTE_V1';
  contractId: string;
  contractHash: string;
  sourceAssociationId: string;
  sourceAssociationHash: string;
  sourceMapId: string;
  sourceMapHash: string;
}
export interface FinanceSourceEnvelope {
  event_id: string;
  delivery_id: string;
  event_type: string;
  schema_version: string;
  producer_id: string;
  key_id: string;
  tenant_id: string;
  source_system: string;
  source_company_id: string;
  aggregate: {
    type: string;
    id: string;
    revision: number;
    previous_revision: number | null;
  };
  occurred_at: string;
  source_reference: { kind: string; id: string; version: number };
  correlation_id: string;
  causation_id: string | null;
  ordering_key: string;
  payload: {
    snapshot_id: string;
    snapshot_hash: string;
    source_revision: number;
    dimensions?: {
      book_id: string;
      dimension_release_id: string;
      dimension_release_hash: string;
      source_association_id: string;
      source_association_hash: string;
      branch_id: string | null;
      product_id: string | null;
    }[];
  };
  payload_hash: string;
}
export const SOURCE_EVENT_TYPE =
  /^(source|measurement)\.[a-z][a-z0-9.-]{1,120}\.v1$/;
export const MAX_SOURCE_EVENT_BYTES = 262144;
const uuid = (v: unknown): v is string =>
  typeof v === 'string' && FINANCE_UUID.test(v);
const hash = (v: unknown): v is string =>
  typeof v === 'string' && APPROVAL_HASH.test(v);
function fail(message: string): never {
  throw new BadRequestException(message);
}
export function sourceByteHash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
export function validateEventContract(
  value: unknown,
  dependencies: string[],
): FinanceEventContract {
  const p: unknown = JSON.parse(canonicalFinanceJson(value));
  approvalFields(p, [
    'schema',
    'purpose',
    'eventType',
    'schemaVersion',
    'producerId',
    'sourceSystem',
    'aggregateType',
    'factKind',
    'codec',
  ]);
  if (
    p.schema !== 'FINANCE_EVENT_CONTRACT_V1' ||
    p.purpose !== 'SOURCE_FACT_REFERENCE' ||
    typeof p.eventType !== 'string' ||
    !SOURCE_EVENT_TYPE.test(p.eventType) ||
    p.schemaVersion !== '1.0.0' ||
    !candidateCode(p.producerId) ||
    !candidateCode(p.sourceSystem) ||
    !candidateCode(p.aggregateType) ||
    !candidateCode(p.factKind) ||
    p.codec !== 'SOURCE_SNAPSHOT_REFERENCE_V1' ||
    !['DEC-12', 'DEC-14'].every((d) => dependencies.includes(d))
  )
    fail(
      'An explicit supported source-reference contract and unresolved integration decisions are required.',
    );
  return p as unknown as FinanceEventContract;
}
export function validateEventRoute(
  value: unknown,
  dependencies: string[],
): FinanceEventRoute {
  const p: unknown = JSON.parse(canonicalFinanceJson(value));
  approvalFields(p, [
    'schema',
    'contractId',
    'contractHash',
    'sourceAssociationId',
    'sourceAssociationHash',
    'sourceMapId',
    'sourceMapHash',
  ]);
  if (
    p.schema !== 'FINANCE_EVENT_ROUTE_V1' ||
    !uuid(p.contractId) ||
    !hash(p.contractHash) ||
    !uuid(p.sourceAssociationId) ||
    !hash(p.sourceAssociationHash) ||
    !uuid(p.sourceMapId) ||
    !hash(p.sourceMapHash) ||
    !['DEC-12', 'DEC-14'].every((d) => dependencies.includes(d))
  )
    fail(
      'Exact reviewed contract/source versions and unresolved integration references are required.',
    );
  return {
    ...p,
    contractId: p.contractId.toLowerCase(),
    sourceAssociationId: p.sourceAssociationId.toLowerCase(),
    sourceMapId: p.sourceMapId.toLowerCase(),
  } as unknown as FinanceEventRoute;
}
/** Scan before JSON.parse so duplicate and escape-equivalent keys are not lost. */
export function parseSourceJson(bytes: Buffer): unknown {
  if (
    !Buffer.isBuffer(bytes) ||
    !bytes.length ||
    bytes.length > MAX_SOURCE_EVENT_BYTES ||
    (bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191)
  )
    fail('A bounded UTF-8 source body without BOM is required.');
  let raw: string;
  try {
    raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return fail('Source body must be valid UTF-8.');
  }
  let i = 0;
  const space = () => {
    while (/[\x20\t\r\n]/.test(raw[i] ?? '') && i < raw.length) i++;
  };
  const string = (): string => {
    const start = i;
    if (raw[i++] !== '"') return fail('Expected a JSON string.');
    while (i < raw.length) {
      const c = raw[i++];
      if (c === '"') {
        try {
          return JSON.parse(raw.slice(start, i));
        } catch {
          return fail('Invalid JSON string.');
        }
      }
      if (c === '\\') {
        if (raw[i] === 'u') i += 5;
        else i++;
      } else if (c.charCodeAt(0) < 32)
        return fail('Invalid JSON control character.');
    }
    return fail('Unterminated JSON string.');
  };
  const value = (depth: number): void => {
    if (depth > 24) fail('Source JSON nesting exceeds the supported bound.');
    space();
    if (raw[i] === '{') {
      i++;
      space();
      const seen = new Set<string>();
      if (raw[i] === '}') {
        i++;
        return;
      }
      while (i < raw.length) {
        space();
        const key = string();
        if (seen.has(key)) fail('Duplicate source JSON keys are not allowed.');
        seen.add(key);
        space();
        if (raw[i++] !== ':') fail('Invalid JSON object separator.');
        value(depth + 1);
        space();
        const separator = raw[i++];
        if (separator === '}') return;
        if (separator !== ',') fail('Invalid JSON object.');
      }
    } else if (raw[i] === '[') {
      i++;
      space();
      if (raw[i] === ']') {
        i++;
        return;
      }
      while (i < raw.length) {
        value(depth + 1);
        space();
        const separator = raw[i++];
        if (separator === ']') return;
        if (separator !== ',') fail('Invalid JSON array.');
      }
    } else if (raw[i] === '"') {
      string();
      return;
    } else {
      const token =
        /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(
          raw.slice(i),
        );
      if (!token) fail('Invalid source JSON token.');
      i += token[0].length;
      return;
    }
    fail('Incomplete source JSON value.');
  };
  value(0);
  space();
  if (i !== raw.length) fail('Trailing source JSON data is not allowed.');
  try {
    const parsed: unknown = JSON.parse(raw);
    canonicalFinanceJson(parsed);
    return parsed;
  } catch {
    return fail('Source body must contain exact finite JSON.');
  }
}
export function sourceOrderingKey(
  p: Pick<
    FinanceSourceEnvelope,
    'source_system' | 'source_company_id' | 'aggregate'
  >,
): string {
  return financeConfigurationHash({
    sourceSystem: p.source_system,
    sourceCompanyId: p.source_company_id,
    aggregateType: p.aggregate.type,
    aggregateId: p.aggregate.id,
  });
}
export function normalizeSourceEnvelope(bytes: Buffer): FinanceSourceEnvelope {
  const p = parseSourceJson(bytes);
  approvalFields(p, [
    'event_id',
    'delivery_id',
    'event_type',
    'schema_version',
    'producer_id',
    'key_id',
    'tenant_id',
    'source_system',
    'source_company_id',
    'aggregate',
    'occurred_at',
    'source_reference',
    'correlation_id',
    'causation_id',
    'ordering_key',
    'payload',
    'payload_hash',
  ]);
  if (
    ![p.event_id, p.delivery_id, p.key_id, p.tenant_id, p.correlation_id].every(
      uuid,
    ) ||
    (p.causation_id !== null && !uuid(p.causation_id)) ||
    typeof p.event_type !== 'string' ||
    !SOURCE_EVENT_TYPE.test(p.event_type) ||
    typeof p.schema_version !== 'string' ||
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(p.schema_version) ||
    !candidateCode(p.producer_id) ||
    !candidateCode(p.source_system) ||
    !candidateText(p.source_company_id, 200) ||
    typeof p.occurred_at !== 'string' ||
    !Number.isFinite(Date.parse(p.occurred_at)) ||
    new Date(p.occurred_at).toISOString() !== p.occurred_at ||
    !hash(p.ordering_key) ||
    !hash(p.payload_hash)
  )
    fail(
      'Explicit source identity, semantic schema version, timestamps and hashes are required.',
    );
  approvalFields(p.aggregate, ['type', 'id', 'revision', 'previous_revision']);
  if (
    !candidateCode(p.aggregate.type) ||
    !candidateText(p.aggregate.id) ||
    !candidateRevision(p.aggregate.revision) ||
    (p.aggregate.revision === 1
      ? p.aggregate.previous_revision !== null
      : p.aggregate.previous_revision !== Number(p.aggregate.revision) - 1)
  )
    fail('Source aggregate revisions must declare their exact predecessor.');
  approvalFields(p.source_reference, ['kind', 'id', 'version']);
  if (
    p.source_reference.kind !== p.aggregate.type ||
    p.source_reference.id !== p.aggregate.id ||
    p.source_reference.version !== p.aggregate.revision
  )
    fail('Source reference and aggregate revision must agree.');
  const dimensionsPresent =
    !!p.payload &&
    typeof p.payload === 'object' &&
    !Array.isArray(p.payload) &&
    Object.hasOwn(p.payload, 'dimensions');
  approvalFields(p.payload, [
    'snapshot_id',
    'snapshot_hash',
    'source_revision',
    ...(dimensionsPresent ? ['dimensions'] : []),
  ]);
  if (
    !candidateText(p.payload.snapshot_id) ||
    !hash(p.payload.snapshot_hash) ||
    p.payload.source_revision !== p.aggregate.revision ||
    financeConfigurationHash(p.payload) !== p.payload_hash
  )
    fail('Exact source snapshot hash and aggregate revision are required.');
  if (dimensionsPresent) {
    if (
      !Array.isArray(p.payload.dimensions) ||
      !p.payload.dimensions.length ||
      p.payload.dimensions.length > 20
    )
      fail('Signed dimension evidence must cover a bounded nonempty book set.');
    const books = new Set<string>();
    for (const dimension of p.payload.dimensions) {
      approvalFields(dimension, [
        'book_id',
        'dimension_release_id',
        'dimension_release_hash',
        'source_association_id',
        'source_association_hash',
        'branch_id',
        'product_id',
      ]);
      if (
        !uuid(dimension.book_id) ||
        !uuid(dimension.dimension_release_id) ||
        !hash(dimension.dimension_release_hash) ||
        !uuid(dimension.source_association_id) ||
        !hash(dimension.source_association_hash) ||
        (dimension.branch_id !== null && !uuid(dimension.branch_id)) ||
        (dimension.product_id !== null && !uuid(dimension.product_id)) ||
        (dimension.branch_id === null && dimension.product_id === null) ||
        books.has(dimension.book_id.toLowerCase())
      )
        fail(
          'Signed dimension evidence needs unique books and exact reviewed references.',
        );
      books.add(dimension.book_id.toLowerCase());
    }
  }
  for (const field of [
    'event_id',
    'delivery_id',
    'key_id',
    'tenant_id',
    'correlation_id',
  ])
    p[field] = (p[field] as string).toLowerCase();
  if (p.causation_id !== null) p.causation_id = p.causation_id.toLowerCase();
  const envelope = p as unknown as FinanceSourceEnvelope;
  if (sourceOrderingKey(envelope) !== envelope.ordering_key)
    fail('The source ordering key must identify this exact aggregate.');
  return envelope;
}
export function sourceEventHashes(
  p: FinanceSourceEnvelope,
  contract: FinanceEventContract,
) {
  const root = financeConfigurationHash({
    tenantId: p.tenant_id,
    sourceSystem: p.source_system,
    sourceCompanyId: p.source_company_id,
    aggregateType: p.aggregate.type,
    aggregateId: p.aggregate.id,
    factKind: contract.factKind,
  });
  const subject = {
    root,
    codec: contract.codec,
    aggregate: p.aggregate,
    occurredAt: p.occurred_at,
    sourceReference: p.source_reference,
    payload: p.payload,
  };
  const semantic = financeConfigurationHash(subject);
  return {
    root,
    semantic,
    subject,
    event: financeConfigurationHash({
      eventId: p.event_id,
      eventType: p.event_type,
      schemaVersion: p.schema_version,
      producerId: p.producer_id,
      semantic,
    }),
  };
}
