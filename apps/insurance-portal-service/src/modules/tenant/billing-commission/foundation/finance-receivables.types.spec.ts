import { randomUUID } from 'node:crypto';
import {
  normalizeReceivableEvidence,
  receivableProfile,
  controlAmount,
  controlUnits,
  dueAgeing,
  receiptIdentity,
  receiptVector,
} from './finance-receivables.types';
const receipt = () => ({
  schema: 'FINANCE_RECEIVABLE_EVIDENCE_V1',
  kind: 'CONFIRMED_RECEIPT',
  id: randomUUID(),
  sourceRevision: 1,
  sourceCompanyId: randomUUID(),
  sourceAccountId: randomUUID(),
  bankTransactionId: 'Bank Ref 1',
  customerId: randomUUID(),
  currency: 'USD',
  decimalScale: 2,
  received: '118',
  bankSettled: '116',
  bankFee: '2',
  valueDate: '2026-11-15',
  bankEvidenceHash: 'a'.repeat(64),
  legacyAllocated: '10',
  legacyRefunded: '3',
  legacyReserved: '5',
  legacyEvidenceHash: 'b'.repeat(64),
});
const deps = ['DEC-01', 'DEC-02', 'DEC-05', 'DEC-12', 'DEC-14'];
const profile = () => ({
  schema: 'FINANCE_RECEIVABLE_CONTROLS_V1',
  purpose: 'INACTIVE_CONTROLS_ONLY',
  recognition: 'HELD_INACTIVE',
  cashAccounts: [
    {
      sourceAccountId: randomUUID(),
      sourceCompanyId: randomUUID(),
      currency: 'USD',
      decimalScale: 2,
    },
  ],
  ageingBands: [30, 60, 90],
});
describe('B14 exact inactive cash and receivable contracts', () => {
  it('conserves gross receipt, bank settlement and separate fee with explicit prior consumption', () => {
    const s = normalizeReceivableEvidence(receipt());
    expect(s).toMatchObject({
      received: '118.000000000000',
      bankSettled: '116.000000000000',
      bankFee: '2.000000000000',
      legacyAllocated: '10.000000000000',
    });
  });
  it.each([
    'received',
    'bankSettled',
    'bankFee',
    'legacyAllocated',
    'legacyRefunded',
    'legacyReserved',
    'legacyEvidenceHash',
  ])('never replaces missing %s with zero', (key) => {
    const s: any = receipt();
    delete s[key];
    expect(() => normalizeReceivableEvidence(s)).toThrow();
  });
  it.each([
    { bankSettled: '117' },
    { received: '0', bankSettled: '0', bankFee: '0' },
    { bankFee: '-2' },
    { received: 118 },
    { received: '118.001' },
    { currency: 'usd' },
    { decimalScale: 13 },
    { sourceRevision: 2 },
    { valueDate: '2026-02-30' },
  ])('rejects unsupported or inconsistent evidence %j', (patch) => {
    expect(() =>
      normalizeReceivableEvidence({ ...receipt(), ...patch }),
    ).toThrow();
  });
  it('retains confirmed cash evidence even when legacy consumption exceeds the receipt', () => {
    expect(
      normalizeReceivableEvidence({ ...receipt(), legacyAllocated: '150' }),
    ).toMatchObject({
      received: '118.000000000000',
      legacyAllocated: '150.000000000000',
    });
  });
  it('separates alias identity from exact economic component evidence', () => {
    const a = normalizeReceivableEvidence(receipt());
    if (a.kind !== 'CONFIRMED_RECEIPT') throw new Error();
    const b = { ...a, id: randomUUID() };
    expect(receiptIdentity(a)).toEqual(receiptIdentity(b));
    expect(receiptVector(a)).toEqual(receiptVector(b));
    expect(
      receiptIdentity({ ...a, currency: 'EUR', sourceCompanyId: randomUUID() }),
    ).toEqual(receiptIdentity(a));
    expect(receiptVector({ ...a, currency: 'EUR' })).not.toEqual(
      receiptVector(a),
    );
    expect(
      receiptVector({ ...b, bankEvidenceHash: 'd'.repeat(64) }),
    ).not.toEqual(receiptVector(a));
  });
  it('uses exact integer arithmetic beyond JavaScript money precision and preserves signed gaps', () => {
    const a = controlUnits('9007199254740993.01');
    expect(controlAmount(a - 1n)).toBe('9007199254740993.009999999999');
    expect(controlAmount(-32000000000000n)).toBe('-32.000000000000');
  });
  it('keeps the profile inactive and requires every scoped account declaration', () => {
    expect(receivableProfile(profile(), deps).recognition).toBe(
      'HELD_INACTIVE',
    );
    expect(() =>
      receivableProfile({ ...profile(), recognition: 'ACTIVE' }, deps),
    ).toThrow();
    expect(() => receivableProfile(profile(), deps.slice(1))).toThrow();
  });
  it.each([[60, 30], [30, 30], [], [0], [30, 36501]].map((bands) => [bands]))(
    'rejects ambiguous ageing bands %j',
    (bands) => {
      expect(() =>
        receivableProfile({ ...profile(), ageingBands: bands }, deps),
      ).toThrow();
    },
  );
  it('rejects duplicate owner/account declarations and mutable runtime values', () => {
    const p = profile();
    p.cashAccounts.push(p.cashAccounts[0]);
    expect(() => receivableProfile(p, deps)).toThrow();
    expect(() =>
      receivableProfile({ ...profile(), extra: true }, deps),
    ).toThrow();
  });
  it('does not invent a due date from billing age or a default credit term', () => {
    expect(dueAgeing('2026-11-15', null, [30, 60, 90])).toEqual({
      dueDate: null,
      daysPastDue: null,
      bucket: 'DUE_DATE_EVIDENCE_REQUIRED',
    });
  });
  it.each([
    ['2026-12-01', -16, 'NOT_DUE'],
    ['2026-11-15', 0, 'NOT_DUE'],
    ['2026-11-01', 14, 'UP_TO_30'],
    ['2026-10-15', 31, 'UP_TO_60'],
    ['2026-08-01', 106, 'OVER_90'],
  ])('ages from evidenced due date %s', (date, days, bucket) => {
    expect(dueAgeing('2026-11-15', date as string, [30, 60, 90])).toMatchObject(
      { daysPastDue: days, bucket },
    );
  });
});
