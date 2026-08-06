import { PolicyTransactionPremiumEffect } from '@insurance-max/contracts';
import { EndorsementPricingService } from './endorsement-pricing.service';

function fakeHashService() {
  return {
    hashDefinition: (value: unknown) => JSON.stringify(value),
  } as any;
}

function pricingResult(finalPayablePremium: string) {
  return {
    finalPayablePremium,
    fullTermPremium: finalPayablePremium,
    earnedBeforeEffectiveDate: '0.0000',
    taxAmount: '0.0000',
    commissionAmount: '0.0000',
    resultHash: `hash:${finalPayablePremium}`,
  };
}

describe('EndorsementPricingService', () => {
  const service = new EndorsementPricingService(fakeHashService());

  it('classifies a higher new premium as DEBIT', () => {
    const snapshot = service.compare({
      sourcePolicyPremium: '100000',
      oldPricing: pricingResult('50000'),
      newPricing: pricingResult('62500'),
      currencyCode: 'TZS',
      effectiveDate: '2026-07-01',
    });

    expect(snapshot.premiumEffect).toBe(PolicyTransactionPremiumEffect.DEBIT);
    expect(snapshot.premiumDifference).toBe('12500.0000');
  });

  it('classifies a lower new premium as CREDIT', () => {
    const snapshot = service.compare({
      sourcePolicyPremium: '100000',
      oldPricing: pricingResult('50000'),
      newPricing: pricingResult('40000'),
      currencyCode: 'TZS',
      effectiveDate: '2026-07-01',
    });

    expect(snapshot.premiumEffect).toBe(PolicyTransactionPremiumEffect.CREDIT);
    expect(snapshot.premiumDifference).toBe('-10000.0000');
  });

  it('classifies an unchanged premium as NONE', () => {
    const snapshot = service.compare({
      sourcePolicyPremium: '100000',
      oldPricing: pricingResult('50000'),
      newPricing: pricingResult('50000'),
      currencyCode: 'TZS',
      effectiveDate: '2026-07-01',
    });

    expect(snapshot.premiumEffect).toBe(PolicyTransactionPremiumEffect.NONE);
  });

  it('includes both pricing result hashes in the snapshot', () => {
    const snapshot = service.compare({
      sourcePolicyPremium: '100000',
      oldPricing: pricingResult('50000'),
      newPricing: pricingResult('62500'),
      currencyCode: 'TZS',
      effectiveDate: '2026-07-01',
    });

    expect(snapshot.pricingResultHashes).toEqual(['hash:50000', 'hash:62500']);
  });
});
