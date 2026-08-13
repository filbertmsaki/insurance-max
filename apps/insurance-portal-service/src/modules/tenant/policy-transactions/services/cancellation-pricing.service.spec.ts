import { CancellationMethod } from '@insurance-max/contracts';
import { CancellationPricingService } from './cancellation-pricing.service';

describe('CancellationPricingService', () => {
  const service = new CancellationPricingService();

  describe('PRO_RATA', () => {
    it('calculates earned/unearned premium pro-rata by days on risk', () => {
      const result = service.calculate({
        policyStartDate: '2026-01-01',
        policyEndDate: '2026-12-31',
        cancellationEffectiveDate: '2026-07-01',
        grossWrittenPremium: '365000.00',
        cancellationMethod: CancellationMethod.PRO_RATA,
      });

      expect(result.policyDays).toBe(365);
      expect(result.daysOnRisk).toBe(182);
      expect(result.remainingDays).toBe(183);
      expect(result.earnedPremium).toBe('182000.0000');
      expect(result.unearnedPremium).toBe('183000.0000');
    });

    it('subtracts the configured cancellation charge from the refund', () => {
      const result = service.calculate({
        policyStartDate: '2026-01-01',
        policyEndDate: '2026-12-31',
        cancellationEffectiveDate: '2026-07-01',
        grossWrittenPremium: '365000.00',
        cancellationMethod: CancellationMethod.PRO_RATA,
        cancellationCharge: '5000',
      });

      expect(result.refundAmount).toBe('178000.0000');
      expect(result.amountDue).toBe('0.0000');
    });

    it('never produces a negative refund', () => {
      const result = service.calculate({
        policyStartDate: '2026-01-01',
        policyEndDate: '2026-12-31',
        cancellationEffectiveDate: '2026-12-30',
        grossWrittenPremium: '365000.00',
        cancellationMethod: CancellationMethod.PRO_RATA,
        cancellationCharge: '50000',
      });

      expect(Number(result.refundAmount)).toBeGreaterThanOrEqual(0);
    });

    it('offsets cancellation charge against unearned premium', () => {
      const result = service.calculate({
        policyStartDate: '2026-01-01',
        policyEndDate: '2026-12-31',
        cancellationEffectiveDate: '2026-12-20',
        grossWrittenPremium: '1000000',
        cancellationMethod: CancellationMethod.PRO_RATA,
        cancellationCharge: '100000',
      });

      expect(result.refundAmount).toBe('0.0000');
      expect(Number(result.amountDue)).toBeGreaterThan(0);
      expect(Number(result.amountDue)).toBeLessThan(100000);
    });
  });

  it('SHORT_PERIOD applies the configured charge through the net settlement', () => {
    const result = service.calculate({
      policyStartDate: '2026-01-01',
      policyEndDate: '2026-12-31',
      cancellationEffectiveDate: '2026-07-01',
      grossWrittenPremium: '365000.00',
      cancellationMethod: CancellationMethod.SHORT_PERIOD,
      cancellationCharge: '10000',
    });

    expect(result.unearnedPremium).toBe('183000.0000');
    expect(result.refundAmount).toBe('173000.0000');
  });

  it('FULL_REFUND returns the entire gross premium and no charge', () => {
    const result = service.calculate({
      policyStartDate: '2026-01-01',
      policyEndDate: '2026-12-31',
      cancellationEffectiveDate: '2026-07-01',
      grossWrittenPremium: '365000.00',
      cancellationMethod: CancellationMethod.FULL_REFUND,
    });

    expect(result.refundAmount).toBe('365000.0000');
    expect(result.cancellationCharge).toBe('0.0000');
  });

  it('NO_REFUND earns the full premium and pays no refund', () => {
    const result = service.calculate({
      policyStartDate: '2026-01-01',
      policyEndDate: '2026-12-31',
      cancellationEffectiveDate: '2026-07-01',
      grossWrittenPremium: '365000.00',
      cancellationMethod: CancellationMethod.NO_REFUND,
      cancellationCharge: '10000',
    });

    expect(result.refundAmount).toBe('0.0000');
    expect(result.amountDue).toBe('10000.0000');
    expect(result.cancellationCharge).toBe('10000.0000');
  });

  it('MINIMUM_RETAINED floors the earned premium at the configured minimum', () => {
    const result = service.calculate({
      policyStartDate: '2026-01-01',
      policyEndDate: '2026-12-31',
      cancellationEffectiveDate: '2026-01-10',
      grossWrittenPremium: '365000.00',
      cancellationMethod: CancellationMethod.MINIMUM_RETAINED,
      minimumRetainedPremium: '50000',
    });

    expect(Number(result.earnedPremium)).toBeGreaterThanOrEqual(50000);
  });
});
