import { ClaimRegulatoryOperationType as Op } from './claim.enums';
import { validateClaimTiramisPayload } from './claim-tiramis-rules';

/** Sample values from the TIRAMIS v1.3 message examples (§9–14). */
const identityClaimant = {
  claimantCategory: 2,
  claimantType: 1,
  claimantIdNumber: '24241241',
  claimantIdType: 1,
};

const fullClaimant = {
  ...identityClaimant,
  claimantName: 'Augustino Aidan Mwageni',
  claimantBirthDate: '1920-02-05',
  gender: 'M',
  countryCode: 'TZA',
  region: 'Dar es Salaam',
  district: 'Ilala',
  street: '',
  claimantPhoneNumber: '255713525539',
  claimantFax: '',
  postalAddress: '',
  emailAddress: '',
};

const corporateClaimant = {
  ...fullClaimant,
  claimantName: 'KISWIGU Company Ltd',
  claimantType: 2,
  claimantIdNumber: '3452525235525',
  claimantIdType: 7,
  gender: '',
};

const samples: Record<Op, Record<string, unknown>> = {
  [Op.NOTIFICATION]: {
    claimNotificationNumber: 'NIC00004',
    coverNoteReferenceNumber: '3252-5252',
    claimReportDate: '2020-09-15T13:55:22',
    claimFormDullyFilled: 'Y',
    lossDate: '2020-09-15T10:00:00',
    lossNature: 'Fire and Allied Perils',
    lossType: 'Bodily Injury',
    lossLocation: 'Morogoro',
    officerName: 'John Doe',
    officerTitle: 'Underwriter',
  },
  [Op.INTIMATION]: {
    claimIntimationNumber: '322WQ25234234',
    claimReferenceNumber: '10020-25400-07720',
    coverNoteReferenceNumber: '10020-25400-07720',
    claimIntimationDate: '2020-09-10T13:55:22',
    currencyCode: 'USD',
    exchangeRate: '2000.00',
    claimEstimatedAmount: '2000000.00',
    claimReserveAmount: '1000000.00',
    claimReserveMethod: 'Chain Ladder',
    lossAssessmentOption: 1,
    assessorName: 'Baraka Kiswigu',
    assessorIdNumber: '124214114',
    assessorIdType: 1,
    claimants: [fullClaimant, corporateClaimant],
  },
  [Op.ASSESSMENT]: {
    claimAssessmentNumber: '322WQ25234234',
    claimIntimationNumber: '35234234',
    claimReferenceNumber: '10020-25400-07720',
    coverNoteReferenceNumber: '10020-25400-07720',
    assessmentReceivedDate: '2020-09-10T13:55:22',
    assessmentReportSummary: 'Vehicle front damage assessed',
    currencyCode: 'USD',
    exchangeRate: '2000.00',
    assessmentAmount: '20000.00',
    approvedClaimAmount: '20000.00',
    claimApprovalDate: '2020-09-10T13:55:22',
    claimApprovalAuthority: 'CEO',
    isReAssessment: 'Y',
    claimants: [identityClaimant],
  },
  [Op.DISCHARGE_VOUCHER]: {
    dischargeVoucherNumber: '322WQ25234234',
    claimAssessmentNumber: '322WQ252323423q4',
    claimReferenceNumber: '10020-25400-07720',
    coverNoteReferenceNumber: '10020-25400-07720',
    dischargeVoucherDate: '2020-09-10T13:55:22',
    currencyCode: 'USD',
    exchangeRate: '2000.00',
    claimOfferCommunicationDate: '2020-09-10T13:55:22',
    claimOfferAmount: '5000000.00',
    claimantResponseDate: '2020-09-10T13:55:22',
    adjustmentDate: '2020-09-10T13:55:22',
    adjustmentReason: 'Salvage deducted',
    adjustmentAmount: '1000000.00',
    reconciliationDate: '2020-09-10T13:55:22',
    reconciliationSummary: 'Agreed with claimant',
    reconciledAmount: '200000.00',
    offerAccepted: 'N',
    claimants: [identityClaimant],
  },
  [Op.PAYMENT]: {
    claimPaymentNumber: '322WQ25234234',
    claimReferenceNumber: '10020-25400-07720',
    claimIntimationNumber: '322WQ25234234',
    coverNoteReferenceNumber: '10020-25400-07720',
    paymentDate: '2020-09-10T13:55:22',
    paidAmount: '20000.00',
    paymentMode: '1',
    partiesNotified: 'Y',
    netPremiumEarned: '200.00',
    claimResultedLitigation: 'Y',
    litigationReason: 'Claimant disputed the settlement amount',
    currencyCode: 'USD',
    exchangeRate: '2000.00',
    claimants: [identityClaimant],
  },
  [Op.REJECTION]: {
    claimRejectionNumber: '322WQ25234234',
    claimReferenceNumber: '10020-25400-07720',
    claimIntimationNumber: '322WQ25234234',
    coverNoteReferenceNumber: '10020-25400-07720',
    rejectionDate: '2020-09-10T13:55:22',
    rejectionReason: 'Loss occurred outside the period of cover',
    claimResultedLitigation: 'N',
    claimAmount: '20000.00',
    currencyCode: 'USD',
    exchangeRate: '2000.00',
    claimants: [identityClaimant],
  },
};

const validate = (op: Op, overrides: Record<string, unknown> = {}) =>
  validateClaimTiramisPayload(op, { ...samples[op], ...overrides });

describe('validateClaimTiramisPayload', () => {
  it.each(Object.values(Op))('accepts the spec sample for %s', (op) => {
    expect(validate(op)).toEqual([]);
  });

  describe('claimants', () => {
    it('requires at least one claimant', () => {
      expect(validate(Op.PAYMENT, { claimants: [] })).toContain(
        'claimants must contain at least one claimant',
      );
    });

    it('rejects empty-string identity codes instead of passing them to TIRA', () => {
      const errors = validate(Op.ASSESSMENT, {
        claimants: [
          {
            claimantCategory: '',
            claimantType: 3,
            claimantIdNumber: '',
            claimantIdType: 8,
          },
        ],
      });

      expect(errors).toEqual([
        'claimants[0].claimantCategory is required',
        'claimants[0].claimantType must be one of 1, 2',
        'claimants[0].claimantIdNumber is required',
        'claimants[0].claimantIdType must be one of 1, 2, 3, 4, 5, 6, 7',
      ]);
    });

    it('requires gender for individuals but not for corporates (§10.1)', () => {
      const errors = validate(Op.INTIMATION, {
        claimants: [{ ...fullClaimant, gender: '' }, corporateClaimant],
      });

      expect(errors).toEqual(['claimants[0].gender is required']);
    });

    it('checks the full-form address and contact fields', () => {
      const errors = validate(Op.INTIMATION, {
        claimants: [
          {
            ...fullClaimant,
            countryCode: 'tz',
            district: '',
            claimantPhoneNumber: '',
          },
        ],
      });

      expect(errors).toEqual([
        'claimants[0].countryCode must be an ISO 3166 alpha-3 code',
        'claimants[0].district is required',
        'claimants[0].claimantPhoneNumber is required',
      ]);
    });
  });

  it('rejects a loss date after the report date (TIRA079)', () => {
    expect(
      validate(Op.NOTIFICATION, { lossDate: '2020-09-16T00:00:00' }),
    ).toEqual(['lossDate must not be after claimReportDate']);
  });

  it('requires the assessor and reserve details on intimation (§10.1)', () => {
    const errors = validate(Op.INTIMATION, {
      assessorName: '',
      assessorIdType: '',
      claimReserveMethod: '',
      lossAssessmentOption: 3,
    });

    expect(errors).toEqual([
      'claimReserveMethod is required',
      'lossAssessmentOption must be one of 1, 2',
      'assessorName is required',
      'assessorIdType is required',
    ]);
  });

  it('rejects an approval date before the assessment was received (TIRA065)', () => {
    expect(
      validate(Op.ASSESSMENT, { claimApprovalDate: '2020-09-09T00:00:00' }),
    ).toEqual(['assessmentReceivedDate must not be after claimApprovalDate']);
  });

  describe('discharge voucher', () => {
    it('allows a voucher with no adjustment or reconciliation', () => {
      expect(
        validate(Op.DISCHARGE_VOUCHER, {
          adjustmentDate: '',
          adjustmentReason: '',
          adjustmentAmount: '',
          reconciliationDate: '',
          reconciliationSummary: '',
          reconciledAmount: '',
        }),
      ).toEqual([]);
    });

    it('requires a partial adjustment to be completed', () => {
      expect(
        validate(Op.DISCHARGE_VOUCHER, {
          adjustmentReason: '',
          adjustmentAmount: '',
        }),
      ).toEqual([
        'adjustmentReason is required',
        'adjustmentAmount is required',
      ]);
    });

    it('requires the claimant response before reporting (§12.1)', () => {
      expect(
        validate(Op.DISCHARGE_VOUCHER, {
          claimantResponseDate: '',
          offerAccepted: '',
        }),
      ).toEqual([
        'claimantResponseDate is required',
        'offerAccepted is required',
      ]);
    });
  });

  describe('payment', () => {
    it('accepts an empty litigation reason when there was no litigation', () => {
      expect(
        validate(Op.PAYMENT, {
          claimResultedLitigation: 'N',
          litigationReason: '',
        }),
      ).toEqual([]);
    });

    it('requires a litigation reason for litigated claims (TIRA094)', () => {
      expect(validate(Op.PAYMENT, { litigationReason: '' })).toEqual([
        'litigationReason is required',
      ]);
    });

    it('checks payment mode, flags and amount (TIRA075, TIRA101, TIRA207)', () => {
      expect(
        validate(Op.PAYMENT, {
          paymentMode: '4',
          partiesNotified: 'yes',
          paidAmount: '0',
        }),
      ).toEqual([
        'paidAmount must be greater than zero',
        'paymentMode must be one of 1, 2, 3',
        'partiesNotified must be one of Y, N',
      ]);
    });
  });

  it('caps the rejection reason at 100 characters (§14.1)', () => {
    expect(
      validate(Op.REJECTION, { rejectionReason: 'x'.repeat(101) }),
    ).toEqual(['rejectionReason must not exceed 100 characters']);
  });

  it('checks the currency and exchange rate (TIRA027, TIRA028)', () => {
    expect(
      validate(Op.REJECTION, { currencyCode: 'usd', exchangeRate: '0' }),
    ).toEqual([
      'currencyCode must be a 3-letter ISO 4217 code',
      'exchangeRate must be greater than zero',
    ]);
  });
});
