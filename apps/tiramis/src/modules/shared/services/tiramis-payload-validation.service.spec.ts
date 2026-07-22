import { TiramisPayloadValidationService } from './tiramis-payload-validation.service';

describe('TiramisPayloadValidationService', () => {
  it('allows zero-valued risk sums and premium rate', () => {
    const service = new TiramisPayloadValidationService();
    const errors: string[] = [];

    service.validateRisks(
      [
        {
          riskCode: 'RISK-001',
          sumInsured: 0,
          sumInsuredEquivalent: 0,
          premiumRate: 0,
          premiumBeforeDiscount: 1000,
          premiumAfterDiscount: 1000,
          premiumExcludingTaxEquivalent: 1000,
          premiumIncludingTax: 1180,
          discounts: [],
          taxes: [
            {
              taxCode: 'VAT-MAINLAND',
              isTaxExempted: 'N',
              taxExemptionType: '',
              taxExemptionReference: '',
              taxRate: 0,
              taxAmount: 180,
            },
          ],
        },
      ],
      'risks',
      errors,
    );

    expect(errors).toEqual([]);
  });
});
