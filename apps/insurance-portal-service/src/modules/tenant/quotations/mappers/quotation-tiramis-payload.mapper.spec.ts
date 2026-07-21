import { QuotationTiramisPayloadMapper } from './quotation-tiramis-payload.mapper';
import {
  createMotorFleetQuotationPayload,
  createMotorSingleQuotationPayload,
  createNonMotorQuotationPayload,
} from '../testing/quotation-payload.fixture';

describe('QuotationTiramisPayloadMapper', () => {
  let mapper: QuotationTiramisPayloadMapper;

  beforeEach(() => {
    mapper = new QuotationTiramisPayloadMapper();
  });

  it('maps a non-motor quotation payload to TIRAMIS camelCase fields', () => {
    const payload = createNonMotorQuotationPayload();

    const result = mapper.toTiramisPayload(payload);

    expect(result).toMatchObject({
      coverNoteType: 1,
      coverNoteNumber: 'AICL-NL-2026-000001',
      salePointCode: 'SP502',
      totalPremiumIncludingTax: 123900,
      commissionPaid: 0,
      commissionRate: 0,
      risks: [
        {
          riskCode: 'SP005001000001',
          discounts: [
            {
              discountType: 2,
              discountRate: 0.05,
              discountAmount: 5000,
            },
          ],
          taxes: [
            {
              taxCode: 'VAT-MAINLAND',
              isTaxExempted: 'N',
              taxRate: 0.18,
              taxAmount: 18000,
            },
          ],
        },
      ],
      subjectMatters: [
        {
          subjectMatterReference: 'PROPERTY-001',
          subjectMatterDesc: 'Residential building and installed fixtures',
        },
      ],
      addons: [
        {
          addonReference: 'ADDON-001',
          addonDesc: 'Loss of rent',
          taxes: [
            {
              taxCode: 'VAT-MAINLAND',
              taxAmount: 900,
            },
          ],
        },
      ],
      policyHolders: [
        {
          policyHolderName: 'Filbert Elisaia Msaki',
          policyHolderBirthDate: '1996-06-30',
          phoneNumber: '255762650393',
          emailAddress: 'filymsaki@gmail.com',
        },
      ],
    });

    expectNoSnakeCaseKeys(result);
  });

  it('maps a motor single quotation payload and preserves motor detail values', () => {
    const payload = createMotorSingleQuotationPayload();

    const result = mapper.toTiramisPayload(payload);

    expect(result).toMatchObject({
      isFleet: false,
      motorDetail: {
        motorCategory: 1,
        registrationNumber: 'T123ABC',
        chassisNumber: 'MOCKCHASSIS123456',
        engineNumber: 'MOCKENGINE123',
        fuelUsed: 'Diesel',
        yearOfManufacture: 2022,
      },
    });
    expect(typeof (result as any).motorDetail.yearOfManufacture).toBe('number');
    expect(typeof (result as any).isFleet).toBe('boolean');
    expectNoSnakeCaseKeys(result);
  });

  it('maps a motor fleet quotation payload into the fleet DTO structure', () => {
    const payload = createMotorFleetQuotationPayload();

    const result = mapper.toTiramisPayload(payload);

    expect(result).toMatchObject({
      coverNoteType: 3,
      coverNoteNumber: 'AICL-FLT-2026-000001',
      prevCoverNoteReferenceNumber: 'AICL-FLT-2025-000090',
      endorsementType: 1,
      endorsementReason: 'Vehicle replacement',
      endorsementPremiumEarned: 12000,
      isFleet: true,
      fleet: {
        fleetId: 'FLEET-2026-001',
        fleetType: 1,
        fleetSize: 2,
        comprehensiveInsured: 200000000,
        items: [
          {
            fleetEntry: '1',
            coverNoteNumber: 'AICL-FLT-2026-000001',
            risks: [
              {
                riskCode: 'SP005001000001',
              },
            ],
            motorDetail: {
              registrationNumber: 'T123ABC',
            },
          },
          {
            fleetEntry: '2',
            coverNoteNumber: 'AICL-FLT-2026-000002',
            motorDetail: {
              registrationNumber: 'T124ABC',
            },
          },
        ],
      },
    });

    expectNoSnakeCaseKeys(result);
  });
});

function expectNoSnakeCaseKeys(value: unknown): void {
  if (!value || typeof value !== 'object') {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => expectNoSnakeCaseKeys(item));
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    expect(key).not.toContain('_');
    expectNoSnakeCaseKeys(nestedValue);
  }
}
