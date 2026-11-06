import { BadRequestException } from '@nestjs/common';
import { PricingValidationService } from './pricing-validation.service';

describe('motor risk selection validation', () => {
  const service = new PricingValidationService({} as any, {} as any);
  const risk = (risk_name: string) =>
    ({
      risk_code: 'RISK',
      risk_name,
      product: { product_code: 'SP014003000000' },
    }) as any;
  const validate = (name: string, values: any, date = '2026-01-01') =>
    service.assertMotorRiskSelectionMatches(risk(name), values, date);

  it.each([null, undefined, '', '  '])(
    'rejects missing vehicle weight (%s)',
    (value) => {
      expect(() =>
        validate('up to 2 tonnes', { gross_weight_tons: value }),
      ).toThrow(BadRequestException);
    },
  );
  it.each([
    [2, true],
    [2.01, false],
    [0, false],
  ])('preserves the up-to-2-tonnes boundary for %s', (weight, valid) => {
    const call = () =>
      validate('up to 2 tonnes', { gross_weight_tons: weight });
    if (valid) expect(call).not.toThrow();
    else expect(call).toThrow(BadRequestException);
  });
  it.each([
    ['above 2 to 5 tonnes', 2, false],
    ['above 2 to 5 tonnes', 5, true],
    ['in excess of 5 tonnes but less than 10 tonnes', 5, false],
    ['in excess of 5 tonnes but less than 10 tonnes', 9.99, true],
    ['in excess of 5 tonnes but less than 10 tonnes', 10, false],
    ['in excess of 10 tonnes', 10, true],
  ])(
    'preserves the existing weight band for %s at %s',
    (name, weight, valid) => {
      const call = () => validate(name, { gross_weight_tons: weight });
      if (valid) expect(call).not.toThrow();
      else expect(call).toThrow(BadRequestException);
    },
  );
  it.each([null, undefined, '', ' ', 0, 2027])(
    'rejects an invalid manufacture year (%s)',
    (year) => {
      expect(() =>
        validate('less than 10 years old', { year_of_manufacture: year }),
      ).toThrow(BadRequestException);
    },
  );
  it('uses the cover year at the ten-year boundary', () => {
    expect(() =>
      validate('less than 10 years old', { year_of_manufacture: 2017 }),
    ).not.toThrow();
    expect(() =>
      validate('less than 10 years old', { year_of_manufacture: 2016 }),
    ).toThrow(BadRequestException);
    expect(() =>
      validate('over 10 years old', { year_of_manufacture: 2016 }),
    ).not.toThrow();
  });
  it('does not silently substitute the current year for an invalid effective date', () => {
    expect(() =>
      validate(
        'less than 10 years old',
        { year_of_manufacture: 2020 },
        'not-a-date',
      ),
    ).toThrow(BadRequestException);
  });
  it('does not impose motor constraints on a non-motor product', () => {
    expect(() =>
      service.assertMotorRiskSelectionMatches(
        { ...risk('up to 2 tonnes'), product: { product_code: 'OTHER' } },
        {},
      ),
    ).not.toThrow();
  });
});
