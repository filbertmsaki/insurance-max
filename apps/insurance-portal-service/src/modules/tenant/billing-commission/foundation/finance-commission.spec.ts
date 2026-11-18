import { randomUUID } from 'node:crypto';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import type { EntityManager } from 'typeorm';
import { readCommissionSource } from './finance-commission.source';
import {
  normalizeCommission,
  commissionIssues,
} from './finance-commission.types';

function native() {
  const company = randomUUID(),
    id = randomUUID(),
    party = randomUUID(),
    quote = randomUUID();
  const snapshot = {
    quotationId: quote,
    intermediaryCompanyId: party,
    commissionBase: '100.0000',
    commissionRate: '0.2000000000',
    commissionAmount: '20.0000',
    currencyCode: 'USD',
  };
  const c: any = {
    id,
    company_id: company,
    intermediary_company_id: party,
    quotation_id: quote,
    policy_id: null,
    status: 'ACCRUED',
    commission_snapshot: snapshot,
    commission_snapshot_hash: new ProductDefinitionHashService().hashDefinition(
      snapshot,
    ),
    net_premium: '100.0000',
    commission_rate: '0.2000000000',
    commission_amount: '20.0000',
    paid_amount: '0.0000',
    balance_amount: '20.0000',
  };
  const payments: any[] = [];
  const query = jest.fn(async (sql: string) =>
    sql.includes('FROM commission_transactions') ? [c] : payments,
  );
  const input = {
    companyId: company,
    commissionId: id,
    sourceRevision: 1,
    decimalScale: 2,
    originalBilling: { id: randomUUID(), hash: 'a'.repeat(64) },
    beneficiary: {
      mode: 'REFERENCED' as const,
      sourceSystem: 'SYNTHETIC_PORTAL',
      referenceId: party,
      version: '1',
      evidenceHash: 'b'.repeat(64),
      naturalPersonIds: [randomUUID()],
    },
    effectiveDate: '2026-11-17',
  };
  return {
    c,
    payments,
    query,
    input,
    read: () =>
      readCommissionSource({ query } as unknown as EntityManager, input),
  };
}
describe('B17 native commission evidence and inactive acquisition boundaries', () => {
  it('reuses the frozen native calculation and preserves absent tax as unresolved', async () => {
    const f = native(),
      s = await f.read();
    expect(s).toMatchObject({
      commissionDelta: '20.000000000000',
      taxDelta: null,
      withholdingDelta: null,
      payableDelta: null,
      calculation: { snapshot: f.c.commission_snapshot },
      acquisition: { classification: 'UNASSESSED' },
    });
    expect(commissionIssues(s)).toContain(
      'COMMISSION_TAX_BREAKDOWN_UNRESOLVED',
    );
    expect(f.query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(
      true,
    );
  });
  it('reconciles historical paid allocations separately from draft reservations', async () => {
    const f = native();
    f.c.paid_amount = '5.0000';
    f.c.balance_amount = '15.0000';
    for (const [amount, status] of [
      ['5.00', 'PAID'],
      ['3.00', 'APPROVED'],
    ])
      f.payments.push({
        id: randomUUID(),
        amount,
        item_status: 'ACTIVE',
        company_id: f.input.companyId,
        intermediary_company_id: f.c.intermediary_company_id,
        currency: 'USD',
        status,
      });
    expect(await f.read()).toMatchObject({
      legacyPaid: '5.000000000000',
      legacyReserved: '3.000000000000',
    });
  });
  it('rejects corrupted native calculation hashes', async () => {
    const f = native();
    f.c.commission_snapshot.commissionRate = '0.4';
    await expect(f.read()).rejects.toThrow('does not reconcile');
  });
  it('rejects stored commission amounts that differ from the native snapshot', async () => {
    const f = native();
    f.c.commission_amount = '21.0000';
    await expect(f.read()).rejects.toThrow('does not reconcile');
  });
  it('rejects missing values and excess currency precision without rounding', async () => {
    const f = native();
    f.c.paid_amount = null;
    await expect(f.read()).rejects.toThrow();
    f.c.paid_amount = '0.0001';
    await expect(f.read()).rejects.toThrow();
  });
  it('requires actual paid allocation evidence rather than assuming zero historical payments', async () => {
    const f = native();
    f.c.paid_amount = '5.0000';
    f.c.balance_amount = '15.0000';
    await expect(f.read()).rejects.toThrow('does not reconcile');
  });
  it('rejects legacy allocation with another company, party or currency', async () => {
    const f = native();
    f.payments.push({
      id: randomUUID(),
      amount: '1',
      item_status: 'ACTIVE',
      company_id: randomUUID(),
      intermediary_company_id: f.c.intermediary_company_id,
      currency: 'USD',
      status: 'DRAFT',
    });
    await expect(f.read()).rejects.toThrow('does not reconcile');
  });
  it('rejects payable totals that conceal withholding or duplicate tax', async () => {
    const s = await native().read();
    expect(() =>
      normalizeCommission({
        ...s,
        taxDelta: '2',
        withholdingDelta: '1',
        payableDelta: '23',
        taxEvidenceHash: 'c'.repeat(64),
      }),
    ).toThrow('reconcile');
  });
  it('does not accept an approved recognition mode or an unsupported attribution without evidence', async () => {
    const s = await native().read();
    expect(() =>
      normalizeCommission({
        ...s,
        acquisition: {
          classification: 'EXPENSE_AND_ASSET',
          evidenceHash: null,
          allocationReference: null,
        },
      }),
    ).toThrow('proposal');
    expect(() =>
      normalizeCommission({
        ...s,
        acquisition: {
          classification: 'PROPOSED_ATTRIBUTABLE',
          evidenceHash: null,
          allocationReference: null,
        },
      }),
    ).toThrow('evidence');
  });
  it('requires the exact party beneficiary and explicit policy-change evidence for clawbacks', async () => {
    const s = await native().read();
    expect(() => normalizeCommission({ ...s, partyId: randomUUID() })).toThrow(
      'party',
    );
    expect(() =>
      normalizeCommission({
        ...s,
        effect: 'POLICY_CHANGE',
        previous: { id: randomUUID(), hash: 'd'.repeat(64) },
        commissionDelta: '-2',
      }),
    ).toThrow('policy-change');
  });
});
