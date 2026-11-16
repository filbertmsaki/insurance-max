import { randomUUID } from 'node:crypto';
import {
  cashAmount,
  cashEconomicKey,
  cashEvidenceVector,
  normalizeCashEvidence,
  normalizeCashOutcome,
  normalizePaymentPlan,
  type FundingEvidence,
} from './finance-outgoing.types';
const funding = (): FundingEvidence => ({
  schema: 'FINANCE_OUTGOING_EVIDENCE_V1',
  kind: 'FUNDING',
  id: randomUUID(),
  sourceRevision: 1,
  sourceCompanyId: randomUUID(),
  sourceAccountId: randomUUID(),
  currency: 'USD',
  decimalScale: 2,
  providerCode: 'SIMULATOR',
  providerAccountReference: 'OPAQUE-REFERENCE',
  available: '100',
  clearedBalance: '130',
  legacyReserved: '10',
  legacyCommitted: '10',
  unavailable: '10',
  asOf: '2026-11-16',
  sourceEvidenceHash: 'a'.repeat(64),
});
describe('B15 exact outgoing-cash contracts', () => {
  it('reconciles funding components without rounding or inventing zero balances', () => {
    expect(normalizeCashEvidence(funding())).toMatchObject({
      available: '100.000000000000',
      legacyReserved: '10.000000000000',
    });
    expect(() =>
      normalizeCashEvidence({ ...funding(), available: '101' }),
    ).toThrow('reconcile');
    const missing: any = funding();
    delete missing.legacyReserved;
    expect(() => normalizeCashEvidence(missing)).toThrow();
  });
  it.each(['1.001', '1e3', '-1', ' 1', '1,000', 1, NaN, undefined])(
    'rejects malformed/overprecision money: %s',
    (v) => {
      expect(() => cashAmount(v, 2)).toThrow();
    },
  );
  it('supports configured currency precision and exact genuine zero fees', () => {
    expect(cashAmount('1000', 0, true)).toBe('1000.000000000000');
    expect(cashAmount('0', 0)).toBe('0.000000000000');
    expect(() => cashAmount('0', 2, true)).toThrow('positive');
    expect(() => cashAmount('1000000000000000000', 2)).toThrow('capacity');
  });
  it('aliases cannot change the cash economic identity or capacity vector', () => {
    const f = normalizeCashEvidence(funding()),
      alias = { ...f, id: randomUUID() };
    expect(cashEconomicKey(alias)).toBe(cashEconomicKey(f));
    expect(cashEvidenceVector(alias)).toBe(cashEvidenceVector(f));
    expect(
      cashEvidenceVector({ ...f, available: '99' } as FundingEvidence),
    ).not.toBe(cashEvidenceVector(f));
  });
  it('freezes exact payment references, beneficiary and expiry', () => {
    const plan = {
      commandKey: 'unique-payment',
      fundingId: randomUUID(),
      fundingHash: 'a'.repeat(64),
      obligationId: randomUUID(),
      obligationHash: 'b'.repeat(64),
      beneficiaryHash: 'c'.repeat(64),
      amount: '50',
      maximumFee: '2',
      expiresAt: '2026-11-16T20:00:00.000Z',
    };
    expect(normalizePaymentPlan(plan, 2).amount).toBe('50.000000000000');
    expect(() =>
      normalizePaymentPlan({ ...plan, approvedBy: 'admin' }, 2),
    ).toThrow();
    expect(() =>
      normalizePaymentPlan({ ...plan, expiresAt: 'tomorrow' }, 2),
    ).toThrow();
  });
  it('requires positive referenced confirmation and definitive zero-cash failure', () => {
    const result = {
      executionKey: 'stable',
      providerCode: 'SIMULATOR',
      providerAccountReference: 'opaque',
      beneficiaryHash: 'b'.repeat(64),
      currency: 'USD',
      amount: '50',
      fee: '1',
      state: 'CONFIRMED',
      providerPaymentId: 'provider-1',
      evidenceHash: 'c'.repeat(64),
    };
    expect(normalizeCashOutcome(result, 2).amount).toBe('50.000000000000');
    expect(() =>
      normalizeCashOutcome({ ...result, providerPaymentId: null }, 2),
    ).toThrow('Confirmed');
    expect(() =>
      normalizeCashOutcome({ ...result, state: 'FAILED_FINAL' }, 2),
    ).toThrow('no funds');
    expect(
      normalizeCashOutcome(
        {
          ...result,
          state: 'FAILED_FINAL',
          amount: '0',
          fee: '0',
          providerPaymentId: null,
        },
        2,
      ).state,
    ).toBe('FAILED_FINAL');
  });
});
