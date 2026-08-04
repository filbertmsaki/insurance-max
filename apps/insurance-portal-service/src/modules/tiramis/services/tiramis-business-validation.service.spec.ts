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

  const validClaimant = {
    claimantName: 'John Doe',
    claimantIdNumber: '12345',
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
      valid: { policyNumber: 'PN1' },
      invalid: {},
      invalidErrorSubstring: 'policyNumber',
    },
    {
      requestType: TiramisRequestType.REINSURANCE,
      valid: { coverNoteReferenceNumber: 'CN1' },
      invalid: {},
      invalidErrorSubstring: 'coverNoteReferenceNumber',
    },
    {
      requestType: TiramisRequestType.CLAIM_NOTIFICATION,
      valid: {
        claimNotificationNumber: 'CLN1',
        coverNoteReferenceNumber: 'CN1',
      },
      invalid: { coverNoteReferenceNumber: 'CN1' },
      invalidErrorSubstring: 'claimNotificationNumber',
    },
    {
      requestType: TiramisRequestType.CLAIM_INTIMATION,
      valid: {
        claimIntimationNumber: 'CI1',
        coverNoteReferenceNumber: 'CN1',
        claimants: [validClaimant],
      },
      invalid: {
        claimIntimationNumber: 'CI1',
        coverNoteReferenceNumber: 'CN1',
        claimants: [],
      },
      invalidErrorSubstring: 'claimants',
    },
    {
      requestType: TiramisRequestType.CLAIM_ASSESSMENT,
      valid: {
        claimAssessmentNumber: 'CA1',
        coverNoteReferenceNumber: 'CN1',
        claimants: [validClaimant],
      },
      invalid: {
        claimAssessmentNumber: 'CA1',
        coverNoteReferenceNumber: 'CN1',
        claimants: [{ claimantName: 'John' }],
      },
      invalidErrorSubstring: 'claimantIdNumber',
    },
    {
      requestType: TiramisRequestType.DISCHARGE_VOUCHER,
      valid: {
        dischargeVoucherNumber: 'DV1',
        coverNoteReferenceNumber: 'CN1',
        claimants: [validClaimant],
      },
      invalid: {
        coverNoteReferenceNumber: 'CN1',
        claimants: [validClaimant],
      },
      invalidErrorSubstring: 'dischargeVoucherNumber',
    },
    {
      requestType: TiramisRequestType.CLAIM_PAYMENT,
      valid: {
        claimPaymentNumber: 'CP1',
        coverNoteReferenceNumber: 'CN1',
        claimants: [validClaimant],
      },
      invalid: {
        claimPaymentNumber: 'CP1',
        claimants: [validClaimant],
      },
      invalidErrorSubstring: 'coverNoteReferenceNumber',
    },
    {
      requestType: TiramisRequestType.CLAIM_REJECTION,
      valid: {
        claimRejectionNumber: 'CR1',
        coverNoteReferenceNumber: 'CN1',
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
        payload: { policyNumber: 'PN1' },
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
});
