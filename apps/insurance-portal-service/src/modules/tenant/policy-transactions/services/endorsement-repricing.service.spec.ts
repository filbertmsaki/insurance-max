import { UnprocessableEntityException } from '@nestjs/common';
import { calculatePercentageTaxes } from '../../../shared/finance/tax-calculation';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';

import { PricingQuoteScope } from '../../pricing/entities/pricing-quote.entity';
import { EndorsementPricingService } from './endorsement-pricing.service';
import { EndorsementRepricingService } from './endorsement-repricing.service';
import { PricingChargeService } from '../../pricing/application/pricing-charge.service';

function hashService() {
  return {
    hashDefinition: jest.fn((value: unknown) => JSON.stringify(value)),
  } as unknown as ProductDefinitionHashService;
}

function createService(engine: { calculateSingleRisk: jest.Mock }) {
  const hash = hashService();
  return new EndorsementRepricingService(
    engine as any,
    new EndorsementPricingService(hash),
    hash,
  );
}

function createManager(pricingQuote: Record<string, unknown> | null = quote()) {
  return {
    getRepository: () => ({
      findOne: jest.fn().mockResolvedValue(pricingQuote),
    }),
  } as any;
}

function quote() {
  return {
    company_id: 'company-1',
    pricing_quote_id: 'PQ-1',
    quote_scope: PricingQuoteScope.SINGLE_RISK,
    input_payload: {
      risk_id: 'risk-1',
      sum_insured: 50_000_000,
      factors: {
        sum_insured: 50_000_000,
      },
      currency_code: 'TZS',
      exchange_rate: 1,
    },
  };
}

function riskResult(
  finalPayablePremium: number,
  sumInsured: number,
  approval = false,
) {
  const calc = calculatePercentageTaxes(
    String(finalPayablePremium),
    [{ code: 'TEST-TAX', rate: '0.1' }],
    'INCLUSIVE',
  );
  return {
    premium_including_tax: finalPayablePremium,
    discount_amount: 0,
    risk_id: 'risk-1',
    final_payable_premium: finalPayablePremium,
    premium_excluding_tax: Number(calc.net),
    charges: [
      {
        applied_rule_id: 'synthetic-tax-rule',
        charge_code: 'TEST-TAX',
        charge_name: 'Synthetic tax',
        charge_type: 'PERCENTAGE',
        calculation_base: 'NET_PREMIUM',
        price_basis: 'INCLUSIVE',
        base_amount: calc.charges[0].baseAmount,
        rate: 0.1,
        effective_from: '2026-01-01',
        effective_to: '2027-01-01',
        charge_category: 'TAX',
        computed_amount: Number(calc.charges[0].amount),
      },
    ],
    discount_approval_required: approval,
    loading_approval_required: false,
    sum_insured: sumInsured,
    premium_rate: 0.02,
    premium_after_discount: finalPayablePremium * 0.9,
    rule_id: 'rule-1',
    rate_book_id: 'book-1',
    factors: {
      sum_insured: sumInsured,
    },
  };
}

function transaction() {
  return {
    id: 'transaction-1',
    company_id: 'company-1',
    currency_code: 'TZS',
    effective_date: '2026-08-13',
  } as any;
}

function snapshot(sumInsured = '50000000') {
  return {
    schemaVersion: 2,
    startDate: '2026-08-13',
    endDate: '2027-08-12',
    cover: {
      endDate: '2027-08-12',
      exchangeRate: '1',
    },
    totals: {
      totalPremium: '1180000',
      totalCommission: '0',
      netPremium: '1180000',
    },
    entries: [
      {
        entryId: 'entry-1',
        risks: [
          {
            quotationRiskId: 'quotation-risk-1',
            insuranceRiskId: 'risk-1',
            sumInsured,
          },
        ],
        pricing: {
          risks: [
            {
              id: 'quotation-risk-1',
              insuranceRiskId: 'risk-1',
              pricingQuoteId: 'PQ-1',
            },
          ],
        },
      },
    ],
  };
}

describe('EndorsementRepricingService', () => {
  it('reuses configured charge calculation to preserve original exemption evidence', async () => {
    const charges = new PricingChargeService({
      findOne: async () => ({
        id: 'SYNTHETIC-RULE',
        tax_code: 'TEST-TAX',
        tax_name: 'Test tax',
        tax_rate: '0.10',
      }),
      find: async () => [
        {
          id: 'SYNTHETIC-RULE',
          tax_code: 'TEST-TAX',
          tax_name: 'Test tax',
          tax_rate: '0.10',
        },
      ],
    } as never);
    const engine = {
      calculateSingleRisk: jest.fn(async (_company: string, input: any) => {
        const net = input.sum_insured === 50000000 ? 100 : 200,
          calc = await charges.calculateCharges('company-1', {
            basic_premium: net,
            gross_premium: net,
            net_premium: net,
            effective_date: input.effective_date,
            tax_exemptions: input.tax_exemptions,
          });
        return {
          ...riskResult(net, input.sum_insured),
          charges: calc.charges,
          premium_excluding_tax: net,
          premium_including_tax: calc.premium_including_charges,
          final_payable_premium: calc.premium_including_charges,
        };
      }),
    };
    const original = snapshot(),
      proposed = snapshot('65000000');
    for (const s of [original, proposed])
      Object.assign(s.entries[0].pricing.risks[0], {
        taxes: [
          {
            taxCode: 'TEST-TAX',
            isTaxExempted: 'Y',
            taxExemptionType: 'SYNTHETIC-EXEMPT',
            taxExemptionReference: 'SYNTHETIC-APPROVAL',
          },
        ],
      });
    const result = await createService(engine).reprice(
      createManager(),
      transaction(),
      original,
      proposed,
    );
    expect(result.snapshot.taxDifference).toBe('0.0000');
    expect(
      result.snapshot.proposedRiskPricing[0].chargeEvidence.charges[0],
    ).toMatchObject({ exempt: true, exemptionReference: 'SYNTHETIC-APPROVAL' });
    expect(result.snapshot.proposedRiskPricing[0].taxes[0].isTaxExempted).toBe(
      'Y',
    );
  });
  it('produces DEBIT when proposed remaining premium is greater than source remaining premium', async () => {
    const engine = {
      calculateSingleRisk: jest
        .fn()
        .mockResolvedValueOnce(riskResult(1000, 50_000_000))
        .mockResolvedValueOnce(riskResult(1300, 65_000_000)),
    };
    const service = createService(engine);

    const result = await service.reprice(
      createManager(),
      transaction(),
      snapshot('50000000'),
      snapshot('65000000'),
    );

    expect(result.snapshot.premiumEffect).toBe('DEBIT');
    expect(result.snapshot.remainingOldPremium).toBe('1000.0000');
    expect(result.snapshot.remainingNewPremium).toBe('1300.0000');
    expect(result.snapshot.premiumDifference).toBe('300.0000');
    const { snapshotHash, ...unsigned } = result.snapshot;
    expect(snapshotHash).toBe(JSON.stringify(unsigned));
    expect(result.snapshot.finance_components.taxEvidenceHash).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });

  it('produces NONE when source and proposed remaining premiums match', async () => {
    const engine = {
      calculateSingleRisk: jest
        .fn()
        .mockResolvedValueOnce(riskResult(1000, 50_000_000))
        .mockResolvedValueOnce(riskResult(1000, 50_000_000)),
    };

    const result = await createService(engine).reprice(
      createManager(),
      transaction(),
      snapshot(),
      snapshot(),
    );

    expect(result.snapshot.premiumEffect).toBe('NONE');
    expect(result.snapshot.premiumDifference).toBe('0.0000');
  });

  it('produces CREDIT when proposed remaining premium is lower', async () => {
    const engine = {
      calculateSingleRisk: jest
        .fn()
        .mockResolvedValueOnce(riskResult(1000, 50_000_000))
        .mockResolvedValueOnce(riskResult(800, 40_000_000)),
    };

    const result = await createService(engine).reprice(
      createManager(),
      transaction(),
      snapshot('50000000'),
      snapshot('40000000'),
    );

    expect(result.snapshot.premiumEffect).toBe('CREDIT');
    expect(result.snapshot.premiumDifference).toBe('-200.0000');
  });

  it('returns approvalRequired when pricing flags discount approval', async () => {
    const engine = {
      calculateSingleRisk: jest
        .fn()
        .mockResolvedValueOnce(riskResult(1000, 50_000_000))
        .mockResolvedValueOnce(riskResult(1300, 65_000_000, true)),
    };

    const result = await createService(engine).reprice(
      createManager(),
      transaction(),
      snapshot('50000000'),
      snapshot('65000000'),
    );

    expect(result.approvalRequired).toBe(true);
    expect(result.snapshot.pricingApprovalRequired).toBe(true);
  });

  it('rejects when the original pricing quote cannot be found', async () => {
    const engine = {
      calculateSingleRisk: jest.fn(),
    };

    await expect(
      createService(engine).reprice(
        createManager(null),
        transaction(),
        snapshot(),
        snapshot(),
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects when Policy V1 pricing data is missing', async () => {
    const engine = {
      calculateSingleRisk: jest.fn(),
    };
    const broken = snapshot();
    delete (broken.entries[0] as any).pricing;

    await expect(
      createService(engine).reprice(
        createManager(),
        transaction(),
        broken,
        broken,
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
