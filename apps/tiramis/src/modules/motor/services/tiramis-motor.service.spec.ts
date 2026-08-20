import { TiramisMotorService } from './tiramis-motor.service';

describe('TiramisMotorService submission snapshot persistence', () => {
  const service = new TiramisMotorService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  ) as any;

  it('maps all motor pricing collections into persisted cover-note relations', () => {
    const collections = service.mapCoverNoteCollections(
      {
        risks: [
          {
            riskCode: 'SP014001000001',
            sumInsured: '12000000.00',
            sumInsuredEquivalent: '12000000.00',
            premiumRate: '1.00000',
            premiumBeforeDiscount: '120000.00',
            premiumAfterDiscount: '100000.00',
            premiumExcludingTaxEquivalent: '100000.00',
            premiumIncludingTax: '118000.00',
            discounts: [
              {
                discountType: 1,
                discountRate: '16.66667',
                discountAmount: '20000.00',
              },
            ],
            taxes: [
              {
                taxCode: 'VAT',
                isTaxExempted: 'N',
                taxRate: '18.00000',
                taxAmount: '18000.00',
              },
            ],
          },
        ],
        subjectMatters: [
          {
            subjectMatterReference: 'T665CSF',
            subjectMatterDesc: 'TOYOTA IST',
          },
        ],
        addons: [
          {
            addonReference: 'ADDON-1',
            addonDesc: 'Windscreen cover',
            addonAmount: '500000.00',
            addonPremiumRate: '1.00000',
            premiumExcludingTax: '5000.00',
            premiumExcludingTaxEquivalent: '5000.00',
            premiumIncludingTax: '5900.00',
            taxes: [
              {
                taxCode: 'VAT',
                isTaxExempted: 'N',
                taxRate: '18.00000',
                taxAmount: '900.00',
              },
            ],
          },
        ],
      },
      'fleet-item-1',
    );

    expect(collections.risks).toEqual([
      expect.objectContaining({
        motorFleetItemId: 'fleet-item-1',
        riskCode: 'SP014001000001',
        discounts: [expect.objectContaining({ discountAmount: '20000.00' })],
        taxes: [expect.objectContaining({ taxCode: 'VAT' })],
      }),
    ]);
    expect(collections.subjectMatters).toEqual([
      {
        subjectMatterReference: 'T665CSF',
        subjectMatterDesc: 'TOYOTA IST',
      },
    ]);
    expect(collections.addons).toEqual([
      expect.objectContaining({
        motorFleetItemId: 'fleet-item-1',
        addonReference: 'ADDON-1',
        taxes: [expect.objectContaining({ taxAmount: '900.00' })],
      }),
    ]);
  });
});
