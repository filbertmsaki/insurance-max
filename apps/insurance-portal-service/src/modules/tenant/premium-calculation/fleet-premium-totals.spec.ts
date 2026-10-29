import { BadRequestException } from '@nestjs/common';
import type { RiskPremiumResult } from '../pricing/domain/pricing.types';
import {
  buildFleetPremiumTotals,
  PremiumCalculationService,
} from './premium-calculation.service';

function vehicle(values: Partial<RiskPremiumResult>): RiskPremiumResult {
  return values as RiskPremiumResult;
}

describe('buildFleetPremiumTotals', () => {
  it('sums per-vehicle amounts into fleet totals excluding and including tax', () => {
    const totals = buildFleetPremiumTotals(2, [
      vehicle({
        sum_insured: 20_000_000,
        premium_before_discount: 700_000,
        discount_amount: 70_000,
        premium_excluding_tax_equivalent: 630_000,
        total_tax_amount: 113_400,
      }),
      // Third-party vehicle: no sum insured, fixed premium.
      vehicle({
        sum_insured: 0,
        premium_before_discount: 100_000,
        discount_amount: 0,
        premium_excluding_tax_equivalent: 100_000,
        total_tax_amount: 18_000,
      }),
    ]);

    expect(totals).toEqual({
      vehicle_count: 2,
      priced_vehicle_count: 2,
      sum_insured: 20_000_000,
      premium_before_discount: 800_000,
      discount_amount: 70_000,
      premium_excluding_tax: 730_000,
      tax_amount: 131_400,
      premium_including_tax: 861_400,
    });
  });

  it('rounds each vehicle before summing', () => {
    const totals = buildFleetPremiumTotals(2, [
      vehicle({
        premium_excluding_tax_equivalent: 100.005,
        total_tax_amount: 0,
      }),
      vehicle({
        premium_excluding_tax_equivalent: 100.005,
        total_tax_amount: 0,
      }),
    ]);

    expect(totals.premium_excluding_tax).toBe(200.02);
    expect(totals.priced_vehicle_count).toBe(2);
  });
});

describe('PremiumCalculationService.calculateFleet', () => {
  it('prices every vehicle as its own single-risk quote and reports failures per vehicle', async () => {
    const service = new PremiumCalculationService(
      {} as never,
      {} as never,
      { log: jest.fn() } as never,
    );
    const calculateSingleRisk = jest
      .spyOn(service, 'calculateSingleRisk')
      .mockImplementation(async (_companyId, dto) => {
        if (dto.client_reference === 'V2') {
          throw new BadRequestException('Missing factor seat_capacity');
        }
        return {
          client_reference: dto.client_reference,
          pricing_quote_id: `PQ-${dto.client_reference}`,
          sum_insured: dto.sum_insured ?? 0,
          premium_before_discount: 100_000,
          discount_amount: 0,
          premium_excluding_tax_equivalent: 100_000,
          total_tax_amount: 18_000,
        } as never;
      });

    const result = await service.calculateFleet('company-1', {
      risk_id: 'risk-tpo',
      tax_codes: ['VAT-MAINLAND'],
      vehicles: [
        { client_reference: 'V1', factors: {} },
        { client_reference: 'V2', factors: {} },
        { client_reference: 'V3', sum_insured: 5_000_000, factors: {} },
      ],
    });

    expect(calculateSingleRisk).toHaveBeenCalledTimes(3);
    expect(calculateSingleRisk.mock.calls[0][1]).toMatchObject({
      risk_id: 'risk-tpo',
      tax_codes: ['VAT-MAINLAND'],
    });
    expect(result.risks.map((risk) => risk.pricing_quote_id)).toEqual([
      'PQ-V1',
      'PQ-V3',
    ]);
    expect(result.failed_risks).toEqual([
      expect.objectContaining({
        client_reference: 'V2',
        message: 'Missing factor seat_capacity',
      }),
    ]);
    expect(result.fleet_totals).toMatchObject({
      vehicle_count: 3,
      priced_vehicle_count: 2,
      premium_excluding_tax: 200_000,
      tax_amount: 36_000,
      premium_including_tax: 236_000,
    });
  });
});
