import {
  applyRate,
  displayPercentageFromRate,
  moneyEqual,
  normalizeExchangeRateForStorage,
  normalizeFractionalRate,
  normalizeMoneyForStorage,
  normalizeRateForStorage,
  numbersEqual,
  rateFromDisplayPercentage,
  roundExchangeRate,
  roundMoney,
  roundRate,
  roundTax,
  sumDecimals,
} from './pricing-calculation.util';

describe('pricing-calculation.util', () => {
  describe('sumDecimals — floating point precision', () => {
    it('sums 0.1 + 0.2 to exactly 0.3, unlike native JS arithmetic', () => {
      // Sanity check that this test would actually catch a float regression:
      // native JS float math gives 0.30000000000000004 here.
      expect(0.1 + 0.2).not.toBe(0.3);

      expect(sumDecimals([0.1, 0.2]).toNumber()).toBe(0.3);
    });

    it('sums multiple discount/tax-like amounts without drift', () => {
      // Native JS: 100.10 + 200.20 + 300.30 === 600.5999999999999
      expect(sumDecimals([100.1, 200.2, 300.3]).toNumber()).toBe(600.6);
    });

    it('sums a large motor fleet of premiums exactly', () => {
      const perVehiclePremium = 123456.78;
      const fleetSize = 500;
      const values = Array.from({ length: fleetSize }, () => perVehiclePremium);

      expect(sumDecimals(values).toNumber()).toBe(
        perVehiclePremium * fleetSize,
      );
    });

    it('treats null/undefined/empty-string entries as zero', () => {
      expect(sumDecimals([100, null, undefined, '', 50]).toNumber()).toBe(150);
    });
  });

  describe('roundMoney / roundTax — half-up rounding at the minor-unit boundary', () => {
    it('rounds a value below half a minor unit down', () => {
      expect(roundMoney('10.004')).toBe(10.0);
    });

    it('rounds a value exactly at half a minor unit up (ROUND_HALF_UP, not banker\'s rounding)', () => {
      expect(roundMoney('10.005')).toBe(10.01);
      expect(roundMoney('10.015')).toBe(10.02);
      expect(roundMoney('2.5')).not.toBe(2); // would be 2 under round-half-to-even
    });

    it('rounds a value above half a minor unit up', () => {
      expect(roundMoney('10.006')).toBe(10.01);
    });

    it('handles repeating decimals from a percentage rate applied to a large sum insured', () => {
      // 10,000,000 * (1/3)% = 33,333.333... -> rounds to 33,333.33
      expect(roundMoney(applyRate(10000000, 1 / 300))).toBe(33333.33);
    });

    it('rounds negative amounts consistently (e.g. a refund/adjustment)', () => {
      expect(roundMoney('-10.005')).toBe(-10.01);
    });

    it('roundTax applies the same half-up policy as roundMoney', () => {
      expect(roundTax('450.505')).toBe(450.51);
    });
  });

  describe('applyRate — base premium calculation', () => {
    it('computes base premium = sum insured x rate for a known percentage case', () => {
      // Independently known answer: 10,000,000 x 0.035 = 350,000
      expect(applyRate(10000000, 0.035).toNumber()).toBe(350000);
    });

    it('computes a high-precision rate against a large sum insured without drift', () => {
      // 987,654,321 x 0.123456789 = 121,932,631.112635269 (exact decimal product)
      expect(applyRate(987654321, 0.123456789).toFixed(9)).toBe(
        '121932631.112635269',
      );
    });

    it('returns zero for a zero rate regardless of sum insured', () => {
      expect(applyRate(500000000, 0).toNumber()).toBe(0);
    });
  });

  describe('normalizeFractionalRate — percentage representation guard', () => {
    it('accepts a properly-scaled fraction (18% as 0.18)', () => {
      expect(normalizeFractionalRate(0.18)).toBe(0.18);
    });

    it('accepts the boundary values 0 and 1 (0% and 100%)', () => {
      expect(normalizeFractionalRate(0)).toBe(0);
      expect(normalizeFractionalRate(1)).toBe(1);
    });

    it('rejects a whole-number percentage mistakenly sent instead of a fraction (18 instead of 0.18)', () => {
      expect(() => normalizeFractionalRate(18)).toThrow(
        /must be between 0 and 1/,
      );
    });

    it('rejects a negative rate', () => {
      expect(() => normalizeFractionalRate(-0.05)).toThrow(
        /must be between 0 and 1/,
      );
    });

    it('rejects a non-finite value', () => {
      expect(() => normalizeFractionalRate(Number.NaN)).toThrow(
        /must be a valid decimal rate/,
      );
    });
  });

  describe('displayPercentageFromRate / rateFromDisplayPercentage — display boundary only', () => {
    it('converts a fraction to its display percentage and back without double-scaling', () => {
      expect(displayPercentageFromRate(0.035)).toBe(3.5);
      expect(rateFromDisplayPercentage(3.5)).toBe(0.035);
    });

    it('is symmetric for a high-precision rate', () => {
      const original = 0.123456;
      const displayed = displayPercentageFromRate(original);
      expect(rateFromDisplayPercentage(displayed)).toBe(original);
    });
  });

  describe('moneyEqual / numbersEqual — tolerance comparisons', () => {
    it('treats amounts within the default money tolerance as equal', () => {
      expect(moneyEqual(100.0, 100.009)).toBe(true);
    });

    it('treats amounts outside the default money tolerance as different', () => {
      expect(moneyEqual(100.0, 100.02)).toBe(false);
    });

    it('rejects a materially reduced premium even if superficially close', () => {
      // Guards against a tampered payload shaving off more than the rounding
      // tolerance from the backend-computed premium.
      expect(moneyEqual(250000, 249000)).toBe(false);
    });

    it('numbersEqual uses a much tighter tolerance than moneyEqual', () => {
      expect(numbersEqual(0.035, 0.0350000001)).toBe(true);
      expect(numbersEqual(0.035, 0.0351)).toBe(false);
    });
  });

  describe('storage normalization — precision through persistence boundary', () => {
    it('normalizeMoneyForStorage keeps 4 decimal places as a fixed string', () => {
      expect(normalizeMoneyForStorage(1234.5)).toBe('1234.5000');
    });

    it('normalizeRateForStorage keeps 10 decimal places for a high-precision rate', () => {
      expect(normalizeRateForStorage(0.0345678912)).toBe('0.0345678912');
    });

    it('normalizeExchangeRateForStorage preserves high-precision exchange rates', () => {
      expect(normalizeExchangeRateForStorage(2317.4567891234)).toBe(
        '2317.4567891234',
      );
    });

    it('roundExchangeRate rounds to the configured 10-decimal scale', () => {
      expect(roundExchangeRate(2317.45678912345)).toBe(2317.4567891235);
    });

    it('roundRate rounds a rate to the configured 10-decimal scale', () => {
      expect(roundRate(0.12345678905)).toBe(0.1234567891);
    });
  });
});
