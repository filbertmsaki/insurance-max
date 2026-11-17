import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import {
  readClaimCaseSource,
  readClaimPayableSource,
  readClaimRecoverySource,
} from './finance-claims.source';
import {
  normalizeClaims,
  claimsIssues,
  licComparison,
  sealClaimsSource,
  type CaseVector,
} from './finance-claims.types';
function native() {
  const id = randomUUID(),
    company = randomUUID(),
    policy = randomUUID(),
    payee = randomUUID(),
    voucherId = randomUUID();
  const c: any = {
    id,
    company_id: company,
    policy_id: policy,
    currency_code: 'USD',
    status: 'PAYMENT_PENDING',
    approved_amount: '100.00',
    paid_amount: '80.00',
    outstanding_reserve: '0.00',
    gross_case_reserve: '75.00',
    coverage_status: 'CONFIRMED',
    tiramis_status: 'ACCEPTED',
  };
  const movements: any[] = [
    {
      id: randomUUID(),
      company_id: company,
      claim_id: id,
      currency_code: 'USD',
      signed_amount: '75.00',
    },
  ];
  const payments: any[] = [
    {
      id: randomUUID(),
      company_id: company,
      claim_id: id,
      currency_code: 'USD',
      payment_type: 'INDEMNITY',
      paid_amount: '70.00',
      status: 'PAID',
      disbursement_status: 'PAID',
      disbursement_currency: 'USD',
      disbursement_amount: '70.00',
    },
    {
      id: randomUUID(),
      company_id: company,
      claim_id: id,
      currency_code: 'USD',
      payment_type: 'LEGAL_FEE',
      paid_amount: '10.00',
      status: 'PAID',
      disbursement_status: 'PAID',
      disbursement_currency: 'USD',
      disbursement_amount: '10.00',
    },
  ];
  const vouchers: any[] = [
    {
      id: voucherId,
      company_id: company,
      claim_id: id,
      currency_code: 'USD',
      version: 1,
      claim_offer_amount: '100.00',
      status: 'ACCEPTED',
      offer_accepted: 'Y',
    },
  ];
  const payment: any = {
    id: randomUUID(),
    currency_code: 'USD',
    payee_id: payee,
    paid_amount: '20.00',
    payment_type: 'INDEMNITY',
    status: 'APPROVED',
    approved_by: randomUUID(),
    approved_at: '2026-11-17T10:00:00Z',
    discharge_voucher_id: voucherId,
  };
  const recovery: any = {
    id: randomUUID(),
    recovery_type: 'SALVAGE',
    expected_amount: '30.00',
    received_amount: '10.00',
    status: 'PARTIALLY_RECEIVED',
  };
  const query = jest.fn(async (sql: string) =>
    sql.includes('FROM claims WHERE')
      ? [c]
      : sql.includes('claim_reserve_movements')
        ? movements
        : sql.includes('SELECT * FROM claim_payments')
          ? [payment]
          : sql.includes('FROM claim_payments')
            ? payments
            : sql.includes('claim_discharge_vouchers')
              ? vouchers
              : sql.includes('claim_recoveries')
                ? [recovery]
                : [],
  );
  const m = {
      query,
      queryRunner: { isTransactionActive: true },
    } as unknown as EntityManager,
    input = {
      companyId: company,
      claimId: id,
      sourceRevision: 1,
      decimalScale: 2,
      effectiveDate: '2026-11-17',
      previous: null,
    };
  const beneficiary = {
      mode: 'REFERENCED' as const,
      sourceSystem: 'SYNTHETIC_PORTAL',
      referenceId: payee,
      version: '1',
      evidenceHash: 'b'.repeat(64),
      naturalPersonIds: [randomUUID()],
    },
    caseRef = { id: randomUUID(), hash: 'c'.repeat(64) };
  return {
    c,
    movements,
    payments,
    vouchers,
    payment,
    recovery,
    query,
    m,
    input,
    beneficiary,
    caseRef,
    read: () => readClaimCaseSource(m, input),
  };
}
describe('B18 native claims evidence and recognition boundaries', () => {
  it('freezes native PostgreSQL dates as reproducible UTC evidence', async () => {
    const f = native();
    f.c.loss_date = new Date('2026-11-16T12:30:00Z');
    f.payment.approved_at = new Date('2026-11-17T10:00:00Z');
    f.recovery.created_at = new Date('2026-11-17T11:00:00Z');
    expect((await f.read()).source.snapshot.native).toMatchObject({
      claim: { loss_date: '2026-11-16T12:30:00.000Z' },
    });
    expect(
      (
        await readClaimPayableSource(f.m, {
          ...f.input,
          paymentId: f.payment.id,
          caseRef: f.caseRef,
          beneficiary: f.beneficiary,
        })
      ).source.snapshot.native,
    ).toMatchObject({ payment: { approved_at: '2026-11-17T10:00:00.000Z' } });
    expect(
      (
        await readClaimRecoverySource(f.m, {
          ...f.input,
          recoveryId: f.recovery.id,
          caseRef: f.caseRef,
        })
      ).source.snapshot.native,
    ).toMatchObject({ recovery: { created_at: '2026-11-17T11:00:00.000Z' } });
  });
  it('requires a transaction-bound source read before capturing financial evidence', async () => {
    const f = native(),
      m = {
        query: f.query,
        queryRunner: { isTransactionActive: false },
      } as unknown as EntityManager;
    await expect(readClaimCaseSource(m, f.input)).rejects.toThrow(
      'transaction-bound',
    );
    expect(f.query).not.toHaveBeenCalled();
  });
  it('preserves an overpaid negative case outstanding instead of flooring it', async () => {
    const f = native(),
      s = await f.read();
    expect(s.data).toMatchObject({
      caseEstimateIncludingPaid: '75.000000000000',
      paidIndemnity: '70.000000000000',
      paidExpenses: '10.000000000000',
      caseOutstanding: '-5.000000000000',
      ibnr: null,
      fullLicTarget: null,
    });
    expect(f.query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(
      true,
    );
  });
  it('holds IBNR, expense, risk adjustment and discount until independent measurement exists', async () => {
    const s = await native().read();
    expect(licComparison(s.data as CaseVector)).toMatchObject({
      state: 'MEASUREMENT_COMPONENTS_UNRESOLVED',
      remainingMeasurementDelta: null,
      settlementExpenseEffects: 0,
      postingEffects: 0,
    });
  });
  it('compares a full target only to the existing case component without posting it again', async () => {
    const s = await native().read(),
      d = {
        ...s.data,
        caseOutstanding: '80.000000000000',
        ibnr: '10',
        expenseOutstanding: '5',
        riskAdjustment: '4',
        discount: '-8',
        fullLicTarget: '91',
      } as CaseVector;
    expect(licComparison(d)).toMatchObject({
      remainingMeasurementDelta: '11.000000000000',
      postingEffects: 0,
      state: 'MEASUREMENT_POLICY_HELD',
    });
  });
  it('rejects paid instructions without the matching confirmed disbursement', async () => {
    const f = native();
    f.payments[0].disbursement_status = 'REQUESTED';
    await expect(f.read()).rejects.toThrow('matching confirmed');
  });
  it('rejects mixed source currencies and unknown payment classifications', async () => {
    const f = native();
    f.movements[0].currency_code = 'EUR';
    await expect(f.read()).rejects.toThrow('currency');
    f.movements[0].currency_code = 'USD';
    f.payments[0].payment_type = 'UNKNOWN';
    await expect(f.read()).rejects.toThrow('component');
  });
  it('rejects missing amounts and excess source precision without rounding', async () => {
    const f = native();
    f.movements[0].signed_amount = null;
    await expect(f.read()).rejects.toThrow('unresolved');
    f.movements[0].signed_amount = '75.001';
    await expect(f.read()).rejects.toThrow();
  });
  it('preserves legacy ownership and missing tax evidence on native payables', async () => {
    const f = native(),
      s = await readClaimPayableSource(f.m, {
        ...f.input,
        paymentId: f.payment.id,
        caseRef: f.caseRef,
        beneficiary: f.beneficiary,
      });
    expect(s.data).toMatchObject({
      sourceApproved: true,
      writer: 'LEGACY_ACTIVE',
      legacyReserved: '20.000000000000',
      taxEvidenceHash: null,
    });
    expect(claimsIssues(s)).toContain('CLAIM_PAYMENT_TAX_UNRESOLVED');
  });
  it('does not invent an accepted discharge or redirect the native payee', async () => {
    const f = native();
    f.vouchers[0].offer_accepted = 'N';
    expect(
      (
        await readClaimPayableSource(f.m, {
          ...f.input,
          paymentId: f.payment.id,
          caseRef: f.caseRef,
          beneficiary: f.beneficiary,
        })
      ).data,
    ).toMatchObject({ sourceApproved: false });
    await expect(
      readClaimPayableSource(f.m, {
        ...f.input,
        paymentId: f.payment.id,
        caseRef: f.caseRef,
        beneficiary: { ...f.beneficiary, referenceId: randomUUID() },
      }),
    ).rejects.toThrow('payee');
  });
  it('preserves gross salvage evidence and holds an unestablished legal right or debtor', async () => {
    const f = native(),
      s = await readClaimRecoverySource(f.m, {
        ...f.input,
        recoveryId: f.recovery.id,
        caseRef: f.caseRef,
      });
    expect(s.data).toMatchObject({
      type: 'SALVAGE',
      expected: '30.000000000000',
      legacyReceived: '10.000000000000',
      debtorId: null,
      legalStatus: 'UNRESOLVED',
    });
    expect(claimsIssues(s)).toContain('RECOVERY_RIGHT_OR_DEBTOR_UNRESOLVED');
  });
  it('keeps native contribution and reinsurance classifications distinct', async () => {
    const f = native();
    f.recovery.recovery_type = 'CONTRIBUTION';
    expect(
      (
        await readClaimRecoverySource(f.m, {
          ...f.input,
          recoveryId: f.recovery.id,
          caseRef: f.caseRef,
        })
      ).data,
    ).toMatchObject({ type: 'CONTRIBUTION' });
    f.recovery.recovery_type = 'REINSURANCE';
    expect(
      claimsIssues(
        await readClaimRecoverySource(f.m, {
          ...f.input,
          recoveryId: f.recovery.id,
          caseRef: f.caseRef,
        }),
      ),
    ).toContain('REINSURANCE_RECOVERY_REQUIRES_B19');
  });
  it('rejects source hashes or a second financial vector that differs from signed evidence', async () => {
    const s = await native().read();
    expect(() =>
      normalizeClaims({ ...s, source: { ...s.source, hash: '0'.repeat(64) } }),
    ).toThrow('hash');
    expect(() =>
      normalizeClaims({ ...s, data: { ...s.data, approvedLimit: '900' } }),
    ).toThrow('projection');
  });
  it('rejects a clamped outstanding amount and unsupported implicit measurement defaults', async () => {
    const s = await native().read(),
      { source, ...base } = s;
    void source;
    expect(() =>
      sealClaimsSource(
        { ...base, data: { ...base.data, caseOutstanding: '0' } },
        {},
      ),
    ).toThrow('without flooring');
  });
});
