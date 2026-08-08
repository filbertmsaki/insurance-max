import { BadRequestException } from '@nestjs/common';

import { RegulatoryLevyCalculationService } from './regulatory-levy-calculation.service';

describe('RegulatoryLevyCalculationService', () => {
  const service = new RegulatoryLevyCalculationService();

  it('calculates percentage levies with four-decimal precision', () => {
    const result = service.calculate(
      {
        rate_type: 'PERCENTAGE',
        rate_value: '1.5',
        minimum_amount: null,
        maximum_amount: null,
      } as any,
      '100000.00',
    );

    expect(result).toBe('1500.0000');
  });

  it('applies configured minimum and maximum levy bounds', () => {
    const minimum = service.calculate(
      {
        rate_type: 'PERCENTAGE',
        rate_value: '1',
        minimum_amount: '250.00',
        maximum_amount: null,
      } as any,
      '1000.00',
    );
    const maximum = service.calculate(
      {
        rate_type: 'PERCENTAGE',
        rate_value: '50',
        minimum_amount: null,
        maximum_amount: '750.00',
      } as any,
      '10000.00',
    );

    expect(minimum).toBe('250.0000');
    expect(maximum).toBe('750.0000');
  });

  it('rejects unsupported rate types', () => {
    expect(() =>
      service.calculate(
        {
          rate_type: 'TIERED',
          rate_value: '1',
          minimum_amount: null,
          maximum_amount: null,
        } as any,
        '1000.00',
      ),
    ).toThrow(BadRequestException);
  });
});
