import { BadRequestException } from '@nestjs/common';

import { TiramisMotorPayloadService } from './tiramis-motor-payload.service';

const motor = (registrationNumber: string) => ({
  motorCategory: 1,
  motorType: 1,
  registrationNumber,
  chassisNumber: `CHS${registrationNumber}`,
  make: 'Toyota',
  model: 'Hiace',
});

const risk = (premium: string) => ({
  riskCode: 'RK1',
  sumInsured: '1000',
  sumInsuredEquivalent: '1000',
  premiumRate: '0.1',
  premiumBeforeDiscount: premium,
  premiumAfterDiscount: premium,
  premiumExcludingTaxEquivalent: premium,
  premiumIncludingTax: premium,
  taxes: [],
});

function fleetDto(overrides: Record<string, any> = {}): any {
  return {
    isFleet: true,
    coverNoteType: 1,
    coverNoteStartDate: '2026-01-01T00:00:00',
    coverNoteEndDate: '2026-12-31T23:59:59',
    policyHolders: [
      {
        policyHolderName: 'Acme Ltd',
        policyHolderType: 2,
        street: 'Samora Ave',
      },
    ],
    risks: [risk('100')],
    fleet: {
      fleetId: 'FL1',
      fleetType: 1,
      fleetSize: 2,
      comprehensiveInsured: 0,
      items: [
        { fleetEntry: '1', motorDetail: motor('T1AAA'), risks: [risk('100')] },
        { fleetEntry: '2', motorDetail: motor('T2BBB'), risks: [risk('200')] },
      ],
    },
    ...overrides,
  };
}

describe('TiramisMotorPayloadService fleet', () => {
  const service = new TiramisMotorPayloadService();
  const build = (dto: any) =>
    service.buildMotorCoverNotePayload({ dto, requestId: 'R1' }).CoverNoteDtl;

  it('keeps ComprehensiveInsured 0 for a third-party-only fleet', () => {
    expect(build(fleetDto()).FleetHdr.ComprehensiveInsured).toBe(0);
  });

  it('formats Date values in Tanzania time, not UTC', () => {
    const payload = build(
      fleetDto({ coverNoteEndDate: new Date('2026-12-31T20:59:59Z') }),
    );
    expect(payload.FleetHdr.CoverNoteEndDate).toBe('2026-12-31T23:59:59');
  });

  it('derives a per-vehicle subject matter instead of copying vehicle 1', () => {
    const payload = build(
      fleetDto({
        subjectMatters: [
          { subjectMatterReference: 'T1AAA', subjectMatterDesc: 'x' },
        ],
      }),
    );
    expect(payload.FleetDtl[1].SubjectMattersCovered.SubjectMatter[0]).toEqual({
      SubjectMatterReference: 'T2BBB',
      SubjectMatterDesc: 'Toyota Hiace',
    });
  });

  it('rejects missing mandatory fields with per-vehicle messages', () => {
    const dto = fleetDto();
    dto.policyHolders[0] = { policyHolderType: 1 };
    dto.fleet.items[1] = { fleetEntry: '2', motorDetail: {} };
    try {
      build(dto);
      fail('expected rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const errors = (error as BadRequestException).getResponse() as {
        errors: string[];
      };
      expect(errors.errors).toEqual([
        'Policyholder 1: street is required for motor cover.',
        'Policyholder 1: gender is required for individuals.',
        'Vehicle 2: chassis number is required.',
        'Vehicle 2: no risks covered.',
      ]);
    }
  });
});
