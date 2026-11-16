import { randomUUID } from 'node:crypto';
import {
  operationsProfile,
  operationsScope,
  operationsEvidence,
  operationsSubject,
  replayReference,
} from './finance-operations.types';
const policy = () => ({
  schema: 'FINANCE_EXCEPTION_RULES_V1',
  purpose: 'INACTIVE_REFERENCE_ONLY',
  replayTtlSeconds: 60,
  additionalAttempts: 1,
  maxReplaysPerItem: 2,
  proposedOwnerDueSeconds: null,
  proposedEscalationSeconds: null,
});
const deps = ['DEC-11', 'DEC-12', 'DEC-14'];
describe('Inactive exception control inputs (B12)', () => {
  it('accepts explicit bounds without choosing an operating SLA', () => {
    expect(
      operationsProfile(policy(), deps).proposedOwnerDueSeconds,
    ).toBeNull();
  });
  it.each(['replayTtlSeconds', 'additionalAttempts', 'maxReplaysPerItem'])(
    'rejects a missing bound %s',
    (key) => {
      const p: Record<string, unknown> = policy();
      delete p[key];
      expect(() => operationsProfile(p, deps)).toThrow();
    },
  );
  it.each([0, -1, 1.5, 101])(
    'rejects an invalid additional attempt budget %s',
    (n) => {
      expect(() =>
        operationsProfile({ ...policy(), additionalAttempts: n }, deps),
      ).toThrow();
    },
  );
  it('requires all unresolved control decisions', () => {
    expect(() => operationsProfile(policy(), ['DEC-12', 'DEC-14'])).toThrow();
  });
  it('rejects a financial handler or unknown fields', () => {
    expect(() =>
      operationsProfile({ ...policy(), purpose: 'POST_PAYMENTS' }, deps),
    ).toThrow();
    expect(() =>
      operationsProfile({ ...policy(), activate: true }, deps),
    ).toThrow();
  });
  it('copies profile and evidence inputs', () => {
    const p = policy(),
      r = operationsProfile(p, deps);
    p.additionalAttempts = 7;
    expect(r.additionalAttempts).toBe(1);
    const e = { referenceId: 'e', version: '1', hash: 'a'.repeat(64) },
      v = operationsEvidence(e);
    e.version = '2';
    expect(v.version).toBe('1');
  });
  it('rejects source scope with book selectors', () => {
    expect(() =>
      operationsScope({ kind: 'SOURCE', bookId: randomUUID() }),
    ).toThrow();
  });
  it('requires an exact book scope', () => {
    expect(() =>
      operationsScope({ kind: 'BOOK', bookId: randomUUID() }),
    ).toThrow();
    expect(operationsScope({ kind: 'SOURCE' })).toEqual({ kind: 'SOURCE' });
  });
  it('requires versioned remediation and exact subject references', () => {
    expect(() =>
      operationsEvidence({ referenceId: 'x', hash: 'a'.repeat(64) }),
    ).toThrow();
    expect(() =>
      operationsSubject({ id: randomUUID(), version: 0, hash: 'a'.repeat(64) }),
    ).toThrow();
    expect(() => replayReference({ id: randomUUID(), hash: 'bad' })).toThrow();
  });
});
