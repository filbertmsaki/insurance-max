import { UnprocessableEntityException } from '@nestjs/common';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';

import { PricingQuoteScope } from '../../pricing/entities/pricing-quote.entity';
import { EndorsementPricingService } from './endorsement-pricing.service';
import { EndorsementRepricingService } from './endorsement-repricing.service';

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
  return {
    risk_id: 'risk-1',
    final_payable_premium: finalPayablePremium,
    premium_excluding_tax: finalPayablePremium * 0.9,
    charges: [
      {
        charge_category: 'TAX',
        computed_amount: finalPayablePremium * 0.1,
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
