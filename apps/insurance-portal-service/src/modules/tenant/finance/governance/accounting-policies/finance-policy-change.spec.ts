import { randomUUID } from 'node:crypto';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import type { EntityManager } from 'typeorm';
import { readPolicyChangeSource } from './finance-policy-change.source';
import {
  changeIssues,
  normalizePolicyChange,
  netPremiumDifference,
  signedChangeAmount,
} from './finance-policy-change.types';

function native() {
  const h = new ProductDefinitionHashService(),
    company = randomUUID(),
    policy = {
      id: randomUUID(),
      company_id: company,
      quotation_id: randomUUID(),
      customer_id: randomUUID(),
    },
    t: any = {
      id: randomUUID(),
      stage: 'APPLIED',
      submission_status: 'ACCEPTED',
      transaction_type: 'ENDORSEMENT',
      source_policy_id: policy.id,
      source_policy_version_id: randomUUID(),
      target_policy_version_id: randomUUID(),
      source_policy_version_no: 1,
      state_version: 3,
      currency_code: 'USD',
      effective_date: '2026-11-16',
      additional_premium: '118.00',
      return_premium: '0.00',
      net_premium_difference: '118.00',
      tax_difference: '18.00',
      pricing_snapshot: { label: 'native  pricing engine' },
    };
  const before = {
      id: t.source_policy_version_id,
      version_number: 1,
      policy_snapshot: { term: 'before' },
    },
    after = {
      id: t.target_policy_version_id,
      version_number: 2,
      policy_snapshot: { term: 'after' },
      supersedes_version_id: before.id,
      policy_transaction_id: t.id,
    };
  const invoice: any = {
    id: randomUUID(),
    source_record_id: t.id,
    currency: 'USD',
    pricing_result_hash: null,
    total_amount: '118.00',
    gross_amount: '118.00',
    discount_amount: '0.00',
    tax_amount: '0.00',
    charges_amount: '0.00',
  };
  t.active_invoice_id = invoice.id;
  const query = jest.fn(async (sql: string) =>
    sql.includes('FROM policy_transactions')
      ? [t]
      : sql.includes('FROM policies')
        ? [policy]
        : sql.includes('FROM policy_versions')
          ? [before, after]
          : sql.includes('FROM invoices')
            ? [invoice]
            : [],
  );
  const refresh = () => {
    t.pricing_snapshot_hash = h.hashDefinition(t.pricing_snapshot);
    Object.assign(before, {
      policy_snapshot_hash: h.hashDefinition(before.policy_snapshot),
    });
    Object.assign(after, {
      policy_snapshot_hash: h.hashDefinition(after.policy_snapshot),
    });
    invoice.pricing_result_hash = t.pricing_snapshot_hash;
  };
  refresh();
  const input = {
    companyId: company,
    transactionId: t.id,
    sourceRevision: 1,
    decimalScale: 2,
    originalBilling: { id: randomUUID(), hash: 'a'.repeat(64) },
    previousChange: null,
    correctionOf: null,
    effect: 'NORMAL' as const,
  };
  const read = () =>
    readPolicyChangeSource({ query } as unknown as EntityManager, input);
  const components = () => {
    t.pricing_snapshot.finance_components = {
      taxDifference: '18',
      feeDifference: '0',
      commissionDifference: '2',
      taxLines: [
        {
          code: 'SYNTHETIC-TAX',
          kind: 'TAX',
          amount: '17',
          ruleHash: 'b'.repeat(64),
        },
        {
          code: 'SYNTHETIC-LEVY',
          kind: 'LEVY',
          amount: '1',
          ruleHash: 'c'.repeat(64),
        },
      ],
      taxEvidenceHash: 'd'.repeat(64),
    };
    refresh();
  };
  return { t, before, after, invoice, query, read, components, refresh };
}
describe('B16 native policy evidence adapter and exact components', () => {
  it('does not infer net premium or zero taxes from the legacy gross-payable field', async () => {
    const f = native(),
      s = await f.read();
    expect(s.additionalPremium).toBe('118.000000000000');
    expect(s.taxDifference).toBeNull();
    expect(netPremiumDifference(s)).toBeNull();
    expect(changeIssues(s)).toContain('SOURCE_COMPONENT_BREAKDOWN_UNRESOLVED');
    expect(s.invoiceReconciliation).toBe('UNRESOLVED');
    expect(f.query.mock.calls.every(([sql]) => sql.startsWith('SELECT '))).toBe(
      true,
    );
  });
  it('matches separate native tax/levy evidence against corrected invoice totals', async () => {
    const f = native();
    f.components();
    f.invoice.gross_amount = '100';
    f.invoice.tax_amount = '18';
    const s = await f.read();
    expect(s.invoiceReconciliation).toBe('MATCHED');
    expect(netPremiumDifference(s)).toBe('100.000000000000');
    expect(s.taxLines).toHaveLength(2);
    expect(changeIssues(s)).toEqual([]);
  });
  it('holds tax-inclusive legacy endorsement invoices with a zero tax column', async () => {
    const f = native();
    f.components();
    expect((await f.read()).invoiceReconciliation).toBe('UNRESOLVED');
  });
  it('validates native hashes, applied status and term predecessor independently', async () => {
    const f = native();
    f.t.pricing_snapshot.label = 'tampered';
    await expect(f.read()).rejects.toThrow('hash');
    f.refresh();
    f.after.supersedes_version_id = randomUUID();
    await expect(f.read()).rejects.toThrow('hash');
    f.after.supersedes_version_id = f.before.id;
    f.t.stage = 'DRAFT';
    await expect(f.read()).rejects.toThrow('applied');
  });
  it('accepts an explicitly evidenced zero-rated component vector', async () => {
    const f = native();
    f.components();
    Object.assign(f.t.pricing_snapshot.finance_components, {
      taxDifference: '0',
      taxLines: [],
    });
    f.t.tax_difference = '0';
    f.invoice.tax_amount = '0';
    f.refresh();
    const s = await f.read();
    expect(s.taxDifference).toBe('0.000000000000');
    expect(s.invoiceReconciliation).toBe('MATCHED');
    expect(changeIssues(s)).toEqual([]);
  });
  it('refuses duplicate tax lines, imbalance, excess precision and missing schema fields', async () => {
    const f = native();
    f.components();
    const s = await f.read();
    expect(() =>
      normalizePolicyChange({
        ...s,
        taxLines: [s.taxLines![0], s.taxLines![0]],
      }),
    ).toThrow('Duplicate');
    expect(() => normalizePolicyChange({ ...s, taxDifference: '19' })).toThrow(
      'reconcile',
    );
    expect(() =>
      normalizePolicyChange({ ...s, taxEvidenceHash: undefined }),
    ).toThrow();
    expect(() => signedChangeAmount('0.001', 2)).toThrow();
    expect(() => signedChangeAmount('-0', 2)).toThrow();
    expect(signedChangeAmount('-0.01', 2)).toBe('-0.010000000000');
  });
});
