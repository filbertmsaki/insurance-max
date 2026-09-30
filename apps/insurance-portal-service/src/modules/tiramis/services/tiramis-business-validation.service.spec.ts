import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';

import { TiramisBusinessValidationService } from './tiramis-business-validation.service';
import { TiramisRequestType } from '../enums/tiramis-request-type.enum';

describe('TiramisBusinessValidationService', () => {
  let service: TiramisBusinessValidationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TiramisBusinessValidationService],
    }).compile();

    service = module.get(TiramisBusinessValidationService);
  });

  // Full claimant (ClaimIntimationReq, TIRAMIS v1.3 §10.1).
  const validClaimant = {
    claimantName: 'John Doe',
    claimantCategory: 1,
    claimantType: 1,
    claimantIdNumber: '12345',
    claimantIdType: 1,
    countryCode: 'TZA',
    district: 'Ilala',
    claimantPhoneNumber: '255713525539',
  };

  // Identity-only claimant used by assessment, voucher, payment, rejection.
  const identityClaimant = {
    claimantCategory: 1,
    claimantType: 1,
    claimantIdNumber: '12345',
    claimantIdType: 1,
  };

  const cases: Array<{
    requestType: TiramisRequestType;
    valid: Record<string, any>;
    invalid: Record<string, any>;
    invalidErrorSubstring: string;
  }> = [
    {
      requestType: TiramisRequestType.MOTOR,
      valid: {
        coverNoteNumber: 'CN1',
        salePointCode: 'SP500',
        coverNoteStartDate: '2026-01-01',
        coverNoteEndDate: '2027-01-01',
        motorDetail: { registrationNumber: 'T123ABC' },
      },
      invalid: {
        coverNoteNumber: 'CN1',
        salePointCode: 'SP500',
        coverNoteStartDate: '2026-01-01',
        coverNoteEndDate: '2027-01-01',
        motorDetail: {},
      },
      invalidErrorSubstring: 'motorDetail.registrationNumber',
    },
    {
      requestType: TiramisRequestType.MOTOR_FLEET,
      valid: {
        coverNoteNumber: 'CN1',
        salePointCode: 'SP500',
        coverNoteStartDate: '2026-01-01',
        coverNoteEndDate: '2027-01-01',
        fleet: { fleetId: 'F1' },
      },
      invalid: {
        coverNoteNumber: 'CN1',
        salePointCode: 'SP500',
        coverNoteStartDate: '2026-01-01',
        coverNoteEndDate: '2027-01-01',
      },
      invalidErrorSubstring: 'fleet',
    },
    {
      requestType: TiramisRequestType.POLICY,
      valid: {
        policyNumber: 'PN1',
        coverNoteReferenceNumbers: ['CNR1'],
      },
      invalid: {},
      invalidErrorSubstring: 'policyNumber',
    },
    {
      requestType: TiramisRequestType.REINSURANCE,
      valid: {
        coverNoteReferenceNumber: 'CN1',
        participants: [{ participantName: 'Lead Reinsurer' }],
      },
      invalid: {},
      invalidErrorSubstring: 'coverNoteReferenceNumber',
    },
    {
      requestType: TiramisRequestType.CLAIM_NOTIFICATION,
      valid: {
        claimNotificationNumber: 'CLN1',
        coverNoteReferenceNumber: 'CN1',
        claimReportDate: '2026-09-01T10:00:00',
        claimFormDullyFilled: 'Y',
        lossDate: '2026-08-31T09:00:00',
        lossNature: 'Accident',
        lossType: 'Own damage',
        lossLocation: 'Dar es Salaam',
        officerName: 'Jane Officer',
        officerTitle: 'Claims Officer',
      },
      invalid: { coverNoteReferenceNumber: 'CN1' },
      invalidErrorSubstring: 'claimNotificationNumber',
    },
    {
      requestType: TiramisRequestType.CLAIM_INTIMATION,
      valid: {
        claimIntimationNumber: 'CI1',
        claimReferenceNumber: 'CR-REF',
        coverNoteReferenceNumber: 'CN1',
        claimants: [validClaimant],
      },
      invalid: {
        claimIntimationNumber: 'CI1',
        claimReferenceNumber: 'CR-REF',
        coverNoteReferenceNumber: 'CN1',
        claimants: [],
      },
      invalidErrorSubstring: 'claimants',
    },
    {
      requestType: TiramisRequestType.CLAIM_ASSESSMENT,
      valid: {
        claimAssessmentNumber: 'CA1',
        claimIntimationNumber: 'CI1',
        claimReferenceNumber: 'CR-REF',
        coverNoteReferenceNumber: 'CN1',
        claimants: [identityClaimant],
      },
      invalid: {
        claimAssessmentNumber: 'CA1',
        claimIntimationNumber: 'CI1',
        claimReferenceNumber: 'CR-REF',
        coverNoteReferenceNumber: 'CN1',
        claimants: [{ claimantCategory: 1, claimantType: 1, claimantIdType: 1 }],
      },
      invalidErrorSubstring: 'claimantIdNumber',
    },
    {
      requestType: TiramisRequestType.DISCHARGE_VOUCHER,
      valid: {
        dischargeVoucherNumber: 'DV1',
        claimAssessmentNumber: 'CA1',
        claimReferenceNumber: 'CR-REF',
        coverNoteReferenceNumber: 'CN1',
        claimants: [identityClaimant],
      },
      invalid: {
        coverNoteReferenceNumber: 'CN1',
        claimants: [identityClaimant],
      },
      invalidErrorSubstring: 'dischargeVoucherNumber',
    },
    {
      // ClaimPaymentReq carries no ClaimAssessmentNumber (§13.1).
      requestType: TiramisRequestType.CLAIM_PAYMENT,
      valid: {
        claimPaymentNumber: 'CP1',
        claimReferenceNumber: 'CR-REF',
        claimIntimationNumber: 'CI1',
        coverNoteReferenceNumber: 'CN1',
        claimants: [identityClaimant],
      },
      invalid: {
        claimPaymentNumber: 'CP1',
        claimReferenceNumber: 'CR-REF',
        claimIntimationNumber: 'CI1',
        claimants: [identityClaimant],
      },
      invalidErrorSubstring: 'coverNoteReferenceNumber',
    },
    {
      requestType: TiramisRequestType.CLAIM_REJECTION,
      valid: {
        claimRejectionNumber: 'CR1',
        claimReferenceNumber: 'CR-REF',
        claimIntimationNumber: 'CI1',
        coverNoteReferenceNumber: 'CN1',
        rejectionReason: 'Loss outside policy scope',
        claimants: [identityClaimant],
      },
      invalid: { coverNoteReferenceNumber: 'CN1' },
      invalidErrorSubstring: 'claimRejectionNumber',
    },
    {
      requestType: TiramisRequestType.COVER_NOTE_VERIFICATION,
      valid: { coverNoteReferenceNumber: 'CN1' },
      invalid: {},
      invalidErrorSubstring: 'At least one of',
    },
    {
      requestType: TiramisRequestType.MOTOR_VERIFICATION,
      valid: { motorCategory: 1, motorRegistrationNumber: 'T123ABC' },
      invalid: { motorCategory: 3, motorRegistrationNumber: 'T123ABC' },
      invalidErrorSubstring: 'motorCategory must be 1 or 2',
    },
    {
      requestType: TiramisRequestType.NIN_VERIFICATION,
      valid: { nin: '12345678901234567890' },
      invalid: {},
      invalidErrorSubstring: 'nin',
    },
    {
      requestType: TiramisRequestType.COMPANY_VERIFICATION,
      valid: { companyName: 'ACME Ltd' },
      invalid: {},
      invalidErrorSubstring: 'companyName',
    },
  ];

  it.each(cases)(
    'passes validation for a well-formed $requestType payload',
    async ({ requestType, valid }) => {
      const result = await service.validateBeforeSubmit({
        requestType,
        payload: valid,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    },
  );

  it.each(cases)(
    'fails validation for an incomplete $requestType payload',
    async ({ requestType, invalid, invalidErrorSubstring }) => {
      const result = await service.validateBeforeSubmit({
        requestType,
        payload: invalid,
      });

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((error) => error.includes(invalidErrorSubstring)),
      ).toBe(true);
    },
  );

  it('throws BadRequestException from assertValidBeforeSubmit when invalid', async () => {
    await expect(
      service.assertValidBeforeSubmit({
        requestType: TiramisRequestType.POLICY,
        payload: {},
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not throw from assertValidBeforeSubmit when valid', async () => {
    await expect(
      service.assertValidBeforeSubmit({
        requestType: TiramisRequestType.POLICY,
        payload: {
          policyNumber: 'PN1',
          coverNoteReferenceNumbers: ['CNR1'],
        },
      }),
    ).resolves.toMatchObject({ isValid: true });
  });

  it('has no special-casing left for unhandled request types (falls through to no checks)', async () => {
    const result = await service.validateBeforeSubmit({
      requestType: 'UNKNOWN_TYPE' as TiramisRequestType,
      payload: {},
    });

    expect(result.isValid).toBe(true);
  });

  it('rejects lookup values that are outside active TIRA reference data', async () => {
    const dataSource = {
      query: jest.fn(async (sql: string, params: unknown[]) => {
        if (sql.includes('FROM tiramis_lookups') && sql.includes('LIMIT 1')) {
          const group = params[0];
          const value = params[1];

          if (value === undefined) {
            return group === 'PAYMENT_MODE' ? [{ exists: 1 }] : [];
          }

          return group === 'PAYMENT_MODE' && value === '1'
            ? [{ exists: 1 }]
            : [];
        }

        return [];
      }),
    };

    const serviceWithReferences = new TiramisBusinessValidationService(
      dataSource as any,
    );

    const result = await serviceWithReferences.validateBeforeSubmit({
      requestType: TiramisRequestType.NON_MOTOR,
      payload: {
        coverNoteNumber: 'CN1',
        salePointCode: 'SP500',
        coverNoteStartDate: '2026-01-01',
        coverNoteEndDate: '2027-01-01',
        paymentMode: 99,
      },
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      'paymentMode is not a valid TIRA PAYMENT_MODE value',
    );
  });

  it('rejects product and risk codes that are not active for the source company', async () => {
    const dataSource = {
      query: jest.fn(async (sql: string, params: unknown[]) => {
        if (sql.includes('information_schema.columns')) {
          const table = params[0];

          if (table === 'insurance_products') {
            return [
              { column_name: 'product_code' },
              { column_name: 'tiramis_product_code' },
            ];
          }

          if (table === 'insurance_risks') {
            return [
              { column_name: 'risk_code' },
              { column_name: 'tiramis_risk_code' },
            ];
          }
        }

        if (sql.includes('FROM "insurance_products"')) {
          return [];
        }

        if (sql.includes('FROM "insurance_risks"')) {
          return [];
        }

        return [];
      }),
    };

    const serviceWithReferences = new TiramisBusinessValidationService(
      dataSource as any,
    );

    const result = await serviceWithReferences.validateBeforeSubmit({
      requestType: TiramisRequestType.NON_MOTOR,
      sourceCompanyId: 'company-1',
      payload: {
        coverNoteNumber: 'CN1',
        salePointCode: 'SP500',
        coverNoteStartDate: '2026-01-01',
        coverNoteEndDate: '2027-01-01',
        productCode: 'BAD-PRODUCT',
        risks: [{ riskCode: 'BAD-RISK' }],
      },
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      'productCode is not an active TIRA product code',
    );
    expect(result.errors).toContain(
      'risks[0].riskCode is not an active TIRA risk code',
    );
  });

  it('blocks cover-note submission when approval or payment gates are unmet', async () => {
    const result = await service.validateBeforeSubmit({
      requestType: TiramisRequestType.NON_MOTOR,
      payload: {
        coverNoteNumber: 'CN1',
        salePointCode: 'SP500',
        coverNoteStartDate: '2026-01-01',
        coverNoteEndDate: '2027-01-01',
        requiresApproval: true,
        approvalStatus: 'PENDING',
        requiresPayment: true,
        paymentStatus: 'REQUESTED',
      },
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      'approvalStatus must be approved before cover-note submission',
    );
    expect(result.errors).toContain(
      'paymentStatus must be paid before cover-note submission',
    );
  });

  it('requires prev cover note reference for renewals and endorsements', async () => {
    const result = await service.validateBeforeSubmit({
      requestType: TiramisRequestType.NON_MOTOR,
      payload: {
        coverNoteNumber: 'CN1',
        salePointCode: 'SP500',
        coverNoteStartDate: '2026-01-01',
        coverNoteEndDate: '2027-01-01',
        coverNoteType: '2',
      },
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      'prevCoverNoteReferenceNumber is required for renewal or endorsement cover notes',
    );
  });

  it('accepts the TIRAMIS prev cover reference for renewals and endorsements', async () => {
    const result = await service.validateBeforeSubmit({
      requestType: TiramisRequestType.NON_MOTOR,
      payload: {
        coverNoteNumber: 'CN1',
        salePointCode: 'SP500',
        coverNoteStartDate: '2026-01-01',
        coverNoteEndDate: '2027-01-01',
        coverNoteType: '3',
        prevCoverNoteReferenceNumber: '11026-27176-67612',
      },
    });

    expect(result.errors).not.toContain(
      'prevCoverNoteReferenceNumber is required for renewal or endorsement cover notes',
    );
  });

  it('blocks new motor covers that overlap an active cover for the same vehicle', async () => {
    const dataSource = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM cover_notes cn')) {
          return [
            {
              cover_note_number: 'CN-OLD',
              cover_note_reference_number: '11026-27176-67612',
              start_date: '2026-09-28',
              end_date: '2027-09-27',
            },
          ];
        }

        return [];
      }),
    };

    const serviceWithData = new TiramisBusinessValidationService(
      dataSource as any,
    );

    const result = await serviceWithData.validateBeforeSubmit({
      requestType: TiramisRequestType.MOTOR,
      sourceCompanyId: 'company-1',
      payload: {
        coverNoteNumber: 'CN-NEW',
        salePointCode: 'SP500',
        coverNoteStartDate: '2026-09-28',
        coverNoteEndDate: '2027-09-27',
        coverNoteType: '1',
        motorDetail: {
          registrationNumber: 'T247AAD',
          chassisNumber: 'CH-1',
        },
      },
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual([
      expect.stringContaining('already has an active cover'),
    ]);
  });

  it('allows endorsement or cancellation payloads to overlap the active cover they reference', async () => {
    const dataSource = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM cover_notes cn')) {
          return [
            {
              cover_note_number: 'CN-OLD',
              cover_note_reference_number: '11026-27176-67612',
              start_date: '2026-09-28',
              end_date: '2027-09-27',
            },
          ];
        }

        return [];
      }),
    };

    const serviceWithData = new TiramisBusinessValidationService(
      dataSource as any,
    );

    const result = await serviceWithData.validateBeforeSubmit({
      requestType: TiramisRequestType.MOTOR,
      sourceCompanyId: 'company-1',
      payload: {
        coverNoteNumber: 'CN-END',
        salePointCode: 'SP500',
        coverNoteStartDate: '2026-09-28',
        coverNoteEndDate: '2027-09-27',
        coverNoteType: '3',
        prevCoverNoteReferenceNumber: '11026-27176-67612',
        motorDetail: {
          registrationNumber: 'T247AAD',
          chassisNumber: 'CH-1',
        },
      },
    });

    expect(result.errors).not.toEqual([
      expect.stringContaining('already has an active cover'),
    ]);
    expect(result.isValid).toBe(true);
  });

  it('requires policy submissions to reference at least one successful cover note', async () => {
    const result = await service.validateBeforeSubmit({
      requestType: TiramisRequestType.POLICY,
      payload: {
        policyNumber: 'PN1',
      },
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      'coverNoteReferenceNumbers is required and must contain at least one entry',
    );
  });

  it('requires claim assessment to depend on claim intimation', async () => {
    const result = await service.validateBeforeSubmit({
      requestType: TiramisRequestType.CLAIM_ASSESSMENT,
      payload: {
        claimAssessmentNumber: 'CA1',
        claimReferenceNumber: 'CR-REF',
        coverNoteReferenceNumber: 'CN1',
        claimants: [identityClaimant],
      },
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('claimIntimationNumber is required');
  });
});
