import { RequestContextService } from '@insurance-max/shared-kernel';

import { TiramisPayloadValidationService } from './tiramis-payload-validation.service';

describe('TiramisPayloadValidationService', () => {
  const service = new TiramisPayloadValidationService(
    new RequestContextService(),
  );
  const holder = (overrides: Record<string, unknown> = {}) => ({
    policyHolderName: 'Sample Holder',
    policyHolderBirthDate: '1990-01-01',
    policyHolderType: 1,
    policyHolderIdNumber: 'ID-1',
    policyHolderIdType: 1,
    countryCode: 'TZA',
    region: 'Dar es Salaam',
    district: 'Ilala',
    phoneNumber: '+255700000000',
    ...overrides,
  });

  it('requires gender for individuals', () => {
    const errors: string[] = [];
    service.validatePolicyHolders([holder()], errors);
    expect(errors).toContain(
      'policyHolders[0].gender is required for an individual policyholder',
    );
  });

  it('allows corporate holders without optional details', () => {
    const errors: string[] = [];
    service.validatePolicyHolders([holder({ policyHolderType: 2 })], errors);
    expect(errors).toEqual([]);
  });

  it('rejects invalid supplied gender and email', () => {
    const errors: string[] = [];
    service.validatePolicyHolders(
      [holder({ gender: 'X', emailAddress: 'not-an-email' })],
      errors,
    );
    expect(errors).toContain('policyHolders[0].gender must be M or F');
    expect(errors).toContain(
      'policyHolders[0].emailAddress must be a valid email address',
    );
  });

  it('allows zero-valued risk sums and premium rate', () => {
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
