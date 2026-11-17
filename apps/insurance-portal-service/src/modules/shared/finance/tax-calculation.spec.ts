import { calculatePercentageTaxes, taxOptions } from './tax-calculation';
describe('Shared configured tax calculation', () => {
  it('calculates exclusive amounts using the configured fractional rate', () =>
    expect(
      calculatePercentageTaxes('100', [{ code: 'VAT', rate: '0.18' }]),
    ).toMatchObject({ net: '100.00', tax: '18.00', total: '118.00' }));
  it('extracts inclusive tax without adding it to the payable again', () =>
    expect(
      calculatePercentageTaxes(
        '118',
        [{ code: 'VAT', rate: '0.18' }],
        'INCLUSIVE',
      ),
    ).toMatchObject({ net: '100.00', tax: '18.00', total: '118.00' }));
  it('extracts multiple inclusive components on the same base', () =>
    expect(
      calculatePercentageTaxes(
        '120',
        [
          { code: 'TAX', rate: '0.18' },
          { code: 'LEVY', rate: '0.02' },
        ],
        'INCLUSIVE',
      ),
    ).toMatchObject({ net: '100.00', tax: '20.00', total: '120.00' }));
  it('retains the gross amount at a repeating-decimal boundary', () =>
    expect(
      calculatePercentageTaxes(
        '100',
        [{ code: 'VAT', rate: '0.18' }],
        'INCLUSIVE',
      ),
    ).toMatchObject({ net: '84.75', tax: '15.25', total: '100.00' }));
  it('rounds premium first and each component separately', () =>
    expect(
      calculatePercentageTaxes('0.025', [
        { code: 'T1', rate: '0.2' },
        { code: 'T2', rate: '0.2' },
      ]),
    ).toMatchObject({ net: '0.03', tax: '0.02', total: '0.05' }));
  it('accepts explicit zero-rated amounts', () =>
    expect(
      calculatePercentageTaxes('100', [{ code: 'ZERO', rate: 0 }]).tax,
    ).toBe('0.00'));
  it.each([null, undefined, '', 'NaN', -1])(
    'rejects absent or invalid rates %s',
    (rate) =>
      expect(() =>
        calculatePercentageTaxes('100', [
          { code: 'MISSING', rate: rate as never },
        ]),
      ).toThrow(),
  );
  it('rejects duplicate configured taxes rather than charging twice', () =>
    expect(() =>
      calculatePercentageTaxes('100', [
        { code: 'VAT', rate: 0.18 },
        { code: 'VAT', rate: 0.18 },
      ]),
    ).toThrow('unique'));
  it('rejects invalid effective windows', () =>
    expect(() =>
      taxOptions({ effective_from: '2027-01-01', effective_to: '2026-01-01' }),
    ).toThrow('precedes'));
});
