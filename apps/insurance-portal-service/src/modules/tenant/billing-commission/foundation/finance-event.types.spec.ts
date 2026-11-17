import { randomUUID } from 'node:crypto';
import {
  normalizeSourceEnvelope,
  parseSourceJson,
  validateEventContract,
  validateEventRoute,
  sourceEventHashes,
} from './finance-event.types';
import {
  syntheticSourceEnvelope,
  refreshSourceEnvelope,
} from '../../../../../test/support/finance-event-fixture';
const contract = () => ({
  schema: 'FINANCE_EVENT_CONTRACT_V1',
  purpose: 'SOURCE_FACT_REFERENCE',
  eventType: 'source.policy.terms-snapshotted.v1',
  schemaVersion: '1.0.0',
  producerId: 'SYNTHETIC_PORTAL',
  sourceSystem: 'SYNTHETIC_PORTAL',
  aggregateType: 'POLICY',
  factKind: 'POLICY_TERMS',
  codec: 'SOURCE_SNAPSHOT_REFERENCE_V1',
});
describe('Exact source-event contract and raw JSON boundaries', () => {
  it('separates schema version, aggregate revision, event, delivery and economic source identities', () => {
    const p = syntheticSourceEnvelope(),
      c = validateEventContract(contract(), ['DEC-12', 'DEC-14']),
      first = sourceEventHashes(p, c);
    const copy = JSON.parse(JSON.stringify(p));
    copy.event_id = randomUUID();
    copy.delivery_id = randomUUID();
    copy.correlation_id = randomUUID();
    copy.key_id = randomUUID();
    const second = sourceEventHashes(copy, c);
    expect(first.semantic).toBe(second.semantic);
    expect(first.root).toBe(second.root);
    expect(first.event).not.toBe(second.event);
    expect(normalizeSourceEnvelope(Buffer.from(JSON.stringify(p)))).toEqual(p);
  });
  it.each([
    '{"a":1,"a":2}',
    '{"a":1,"\\u0061":2}',
    '{"x":{"z":1,"z":2}}',
    '{"a":1} false',
    '{"a":NaN}',
    '{"a":1e999}',
    '{"a":01}',
    '{"a":1,}',
    '[1,]',
    '"unterminated',
    '{"a":"bad\nstring"}',
  ])('rejects ambiguous or invalid JSON %s', (raw) => {
    expect(() => parseSourceJson(Buffer.from(raw))).toThrow();
  });
  it('rejects invalid UTF-8, BOM, excessive nesting and excessive body size', () => {
    for (const bytes of [
      Buffer.from([0xc3, 0x28]),
      Buffer.concat([Buffer.from([239, 187, 191]), Buffer.from('{}')]),
      Buffer.from('['.repeat(26) + '0' + ']'.repeat(26)),
      Buffer.alloc(262145, 32),
    ])
      expect(() => parseSourceJson(bytes)).toThrow();
  });
  it.each([
    [
      'target book injection',
      (p: ReturnType<typeof syntheticSourceEnvelope>) =>
        Object.assign(p, { book_id: randomUUID() }),
    ],
    [
      'posting payload',
      (p: ReturnType<typeof syntheticSourceEnvelope>) =>
        Object.assign(p.payload, { debit: '100' }),
    ],
    [
      'payload hash drift',
      (p: ReturnType<typeof syntheticSourceEnvelope>) => {
        p.payload.snapshot_id = 'changed';
      },
    ],
    [
      'source revision drift',
      (p: ReturnType<typeof syntheticSourceEnvelope>) => {
        p.payload.source_revision = 2;
        refreshSourceEnvelope(p);
      },
    ],
    [
      'implicit predecessor',
      (p: ReturnType<typeof syntheticSourceEnvelope>) => {
        p.aggregate.revision = 2;
        p.source_reference.version = 2;
        p.payload.source_revision = 2;
        refreshSourceEnvelope(p);
      },
    ],
    [
      'schema/revision conflation',
      (p: ReturnType<typeof syntheticSourceEnvelope>) => {
        p.schema_version = '1';
      },
    ],
    [
      'wrong partition',
      (p: ReturnType<typeof syntheticSourceEnvelope>) => {
        p.ordering_key = 'b'.repeat(64);
      },
    ],
    [
      'unsupported posting event',
      (p: ReturnType<typeof syntheticSourceEnvelope>) => {
        p.event_type = 'finance.journal.post.v1';
      },
    ],
  ])('rejects %s', (_name, change) => {
    const p = syntheticSourceEnvelope();
    change(p);
    expect(() =>
      normalizeSourceEnvelope(Buffer.from(JSON.stringify(p))),
    ).toThrow();
  });
  it.each([
    { schemaVersion: '2.0.0' },
    { codec: 'RUN_JOURNAL' },
    { purpose: 'POST' },
    { activate: true },
  ])('holds unsupported contract %j', (override) => {
    expect(() =>
      validateEventContract({ ...contract(), ...override }, [
        'DEC-12',
        'DEC-14',
      ]),
    ).toThrow();
  });
  it('requires integration/identity decisions and exact versioned route references', () => {
    expect(() => validateEventContract(contract(), ['DEC-12'])).toThrow();
    const route = {
      schema: 'FINANCE_EVENT_ROUTE_V1',
      contractId: randomUUID(),
      contractHash: 'a'.repeat(64),
      sourceAssociationId: randomUUID(),
      sourceAssociationHash: 'b'.repeat(64),
      sourceMapId: randomUUID(),
      sourceMapHash: 'c'.repeat(64),
    };
    expect(validateEventRoute(route, ['DEC-12', 'DEC-14'])).toEqual(route);
    expect(() =>
      validateEventRoute({ ...route, bookId: randomUUID() }, [
        'DEC-12',
        'DEC-14',
      ]),
    ).toThrow();
  });
});
