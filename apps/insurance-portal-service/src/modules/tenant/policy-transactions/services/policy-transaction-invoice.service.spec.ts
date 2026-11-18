import Decimal from 'decimal.js';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import {
  endorsementTaxHarness,
  endorsementTaxData,
} from '../../../../../test/support/endorsement-tax-fixture';
import {
  buildEndorsementInvoiceTax,
  freezeEndorsementRiskCharges,
  validatedEndorsementInvoiceTax,
  policyPricingHashMatches,
} from '../../finance/taxation/tax-calculation/endorsement-invoice-tax';
const h = new ProductDefinitionHashService();
describe('Endorsement invoice tax correction', () => {
  it('stores net and calculated tax instead of putting the inclusive payable in gross', async () => {
    const f = endorsementTaxHarness(),
      i = await f.create();
    expect(i).toMatchObject({
      gross_amount: '100.00',
      discount_amount: '0.00',
      tax_amount: '18.00',
      charges_amount: '0.00',
      total_amount: '118.00',
    });
    expect(i.items).toHaveLength(4);
    expect(validatedEndorsementInvoiceTax(i).tax).toBe('18.00');
    expect(
      i.items
        .reduce((s: any, v: any) => s.plus(v.total_amount), new Decimal(0))
        .toFixed(2),
    ).toBe('118.00');
  });
  it.each(['EXCLUSIVE', 'INCLUSIVE'] as const)(
    'uses the shared %s calculation with original rates and bases',
    async (basis) => {
      const f = endorsementTaxHarness();
      f.setRisks(
        [
          f.risk(
            f.result(basis === 'INCLUSIVE' ? '118' : '100', f.rules, basis),
          ),
        ],
        [
          f.risk(
            f.result(basis === 'INCLUSIVE' ? '236' : '200', f.rules, basis),
          ),
        ],
      );
      f.refresh();
      const i = await f.create(),
        b = validatedEndorsementInvoiceTax(i);
      expect(b).toMatchObject({ net: '100.00', tax: '18.00', total: '118.00' });
      expect(b.lines[0].charges[0].basis).toBe(basis);
    },
  );
  it('retains multiple taxes, levies, stamp duty and fees separately', async () => {
    const f = endorsementTaxHarness(),
      rules = [
        ...f.rules,
        {
          ...f.rules[0],
          code: 'LEVY',
          category: 'LEVY',
          rate: '0.02',
          account: '4210',
        },
        {
          ...f.rules[0],
          code: 'STAMP',
          category: 'STAMP_DUTY',
          rate: '0.01',
          account: '4210',
        },
        {
          ...f.rules[0],
          code: 'FEE',
          category: 'FEE',
          rate: '0.01',
          account: '4300',
        },
      ];
    f.setRisks(
      [f.risk(f.result('100', rules))],
      [f.risk(f.result('200', rules))],
    );
    f.refresh();
    const i = await f.create();
    expect(i).toMatchObject({
      gross_amount: '100.00',
      tax_amount: '21.00',
      charges_amount: '1.00',
      total_amount: '122.00',
    });
    expect(validatedEndorsementInvoiceTax(i)).toMatchObject({
      tax: '18.00',
      levies: '3.00',
      fees: '1.00',
    });
    expect(i.items).toHaveLength(10);
  });
  it.each(['exempt', 'zero rated', 'explicit no tax'])(
    'accepts genuinely calculated zero for %s',
    async (mode) => {
      const f = endorsementTaxHarness(),
        rules =
          mode === 'explicit no tax'
            ? []
            : mode === 'zero rated'
              ? f.rules.map((r) => ({ ...r, rate: '0' }))
              : f.rules;
      f.setRisks(
        [f.risk(f.result('100', rules, 'EXCLUSIVE', mode === 'exempt'))],
        [f.risk(f.result('200', rules, 'EXCLUSIVE', mode === 'exempt'))],
      );
      f.refresh();
      const i = await f.create();
      expect(i).toMatchObject({
        tax_amount: '0.00',
        gross_amount: '100.00',
        total_amount: '100.00',
      });
      expect(validatedEndorsementInvoiceTax(i).tax).toBe('0.00');
    },
  );
  it('never turns missing charge evidence into zero tax', async () => {
    const f = endorsementTaxHarness();
    delete f.transaction.pricing_snapshot.sourceRiskPricing[0].chargeEvidence;
    f.refresh();
    await expect(f.create()).rejects.toThrow(
      'Frozen risk charge evidence is missing',
    );
    expect(f.repo.save).not.toHaveBeenCalled();
    expect(f.identifiers.generateInvoiceNumber).not.toHaveBeenCalled();
  });
  it('fails when a required rate, rule, exemption or effective date is invalid', () => {
    const f = endorsementTaxData(),
      r = f.result('100');
    for (const patch of [
      { rate: null },
      { applied_rule_id: null },
      { is_exempt: true, exemption_type: null },
      { effective_to: '2025-01-01' },
    ])
      expect(() =>
        freezeEndorsementRiskCharges(
          { ...r, charges: [{ ...r.charges[0], ...patch }] } as any,
          '2026-11-16',
        ),
      ).toThrow();
  });
  it('preserves discounts without changing the agreed payable', async () => {
    const f = endorsementTaxHarness();
    f.setRisks(
      [f.risk(f.result('100', f.rules, 'EXCLUSIVE', false, '5'))],
      [f.risk(f.result('200', f.rules, 'EXCLUSIVE', false, '15'))],
    );
    f.refresh();
    expect(await f.create()).toMatchObject({
      gross_amount: '110.00',
      discount_amount: '10.00',
      tax_amount: '18.00',
      total_amount: '118.00',
    });
  });
  it('preserves per-risk final pricing rounding and its trace', async () => {
    const f = endorsementTaxHarness();
    f.setRisks(
      [f.risk(f.result('10.01', f.rules, 'EXCLUSIVE', false, '0', '12'))],
      [f.risk(f.result('20.01', f.rules, 'EXCLUSIVE', false, '0', '24'))],
    );
    f.refresh();
    const i = await f.create();
    expect(i.total_amount).toBe('12.00');
    expect(i.tax_amount).toBe('1.80');
    expect(validatedEndorsementInvoiceTax(i)).toMatchObject({
      net: '10.20',
      rounding: '0.20',
    });
  });
  it('supports signed tax reductions within a positive additional premium', async () => {
    const f = endorsementTaxHarness();
    f.setRisks(
      [f.risk(f.result('100'))],
      [
        f.risk(
          f.result(
            '150',
            f.rules.map((r) => ({ ...r, rate: '0.00' })),
          ),
        ),
      ],
    );
    f.refresh();
    expect(await f.create()).toMatchObject({
      gross_amount: '50.00',
      tax_amount: '-18.00',
      total_amount: '32.00',
    });
  });
  it('sums each vehicle/risk exactly for a fleet or multi-risk non-motor endorsement', async () => {
    const f = endorsementTaxHarness();
    f.setRisks(
      [f.risk(f.result('100'), 0), f.risk(f.result('50'), 1)],
      [f.risk(f.result('200'), 0), f.risk(f.result('60'), 1)],
    );
    f.refresh();
    const i = await f.create();
    expect(i).toMatchObject({
      gross_amount: '110.00',
      tax_amount: '19.80',
      total_amount: '129.80',
    });
    expect(validatedEndorsementInvoiceTax(i).lines).toHaveLength(4);
  });
  it('reuses an existing valid invoice after a workflow-only revision without duplicating money', async () => {
    const f = endorsementTaxHarness(),
      i = await f.create();
    f.transaction.state_version++;
    expect((await f.create()).id).toBe(i.id);
    expect(f.repo.save).toHaveBeenCalledTimes(1);
  });
  it('rejects agreed payable changes, cross-company access and stale pricing before persistence', async () => {
    const f = endorsementTaxHarness();
    f.params.amount = '119';
    await expect(f.create()).rejects.toThrow('agreed payable');
    f.params.amount = '118';
    f.transaction.company_id = 'other';
    await expect(f.create()).rejects.toThrow('ownership');
    expect(f.repo.save).not.toHaveBeenCalled();
  });
  it('does not rewrite an existing paid invoice with an unresolved historical breakdown', async () => {
    const f = endorsementTaxHarness(),
      i = await f.create();
    i.status = 'PAID';
    i.paid_amount = '118';
    i.tax_amount = '0.00';
    i.gross_amount = '118.00';
    i.items.length = 0;
    const original = JSON.stringify(i);
    await expect(f.create()).rejects.toThrow('reconciliation');
    expect(JSON.stringify(i)).toBe(original);
    expect(f.repo.save).toHaveBeenCalledTimes(1);
  });
  it('detects tampered headers, item amounts, hashes, duplicate lines and missing lines', async () => {
    const f = endorsementTaxHarness(),
      i = await f.create();
    for (const change of [
      (v: any) => (v.tax_amount = '0'),
      (v: any) => (v.items[0].total_amount = '1'),
      (v: any) => (v.items[0].line_hash = '0'.repeat(64)),
      (v: any) => v.items.push(v.items[0]),
      (v: any) => v.items.pop(),
    ]) {
      const copy = JSON.parse(JSON.stringify(i));
      change(copy);
      expect(() => validatedEndorsementInvoiceTax(copy)).toThrow();
    }
  });
  it('rejects changes to source tax aggregates and charge snapshots even with a new parent hash', async () => {
    const f = endorsementTaxHarness();
    f.transaction.tax_difference = '0';
    await expect(f.create()).rejects.toThrow('component amounts');
    f.transaction.tax_difference = '18';
    f.transaction.pricing_snapshot.sourceRiskPricing[0].chargeEvidence.charges[0].rate =
      '0';
    f.refresh();
    await expect(f.create()).rejects.toThrow('charge evidence changed');
  });
  it('rejects credit or no-change transactions as debit invoices', () => {
    const f = endorsementTaxData();
    for (const revised of ['90', '100']) {
      f.setRisks([f.risk(f.result('100'))], [f.risk(f.result(revised))]);
      f.refresh();
      expect(() =>
        buildEndorsementInvoiceTax(f.transaction, f.companyId, f.params.amount),
      ).toThrow('debit effect');
    }
  });
  it('uses a reproducible unsigned snapshot hash and still accepts a full native hash', () => {
    const f = endorsementTaxData(),
      p = f.transaction.pricing_snapshot;
    expect(
      policyPricingHashMatches(p, f.transaction.pricing_snapshot_hash),
    ).toBe(true);
    expect(policyPricingHashMatches(p, h.hashDefinition(p))).toBe(true);
    expect(
      policyPricingHashMatches(
        { ...p, taxDifference: '0' },
        f.transaction.pricing_snapshot_hash,
      ),
    ).toBe(false);
  });
});
