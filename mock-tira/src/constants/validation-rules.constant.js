const COMMON_ASYNC_HEADER_FIELDS = [
  'RequestId',
  'CompanyCode',
  'SystemCode',
  'CallBackUrl',
  'InsurerCompanyCode',
];

const COMMON_SYNC_HEADER_FIELDS = ['RequestId', 'CompanyCode', 'SystemCode'];

const BUSINESS_VALIDATION_RULES = {
  CoverNoteRefReq: {
    required: [
      ...COMMON_ASYNC_HEADER_FIELDS,
      'TranCompanyCode',
      'CoverNoteType',
      'CoverNoteNumber',
    ],
  },

  MotorCoverNoteRefReq: {
    required: [...COMMON_ASYNC_HEADER_FIELDS, 'TranCompanyCode', 'CoverNoteType'],
    anyOf: [['CoverNoteNumber'], ['FleetId', 'FleetSize']],
  },

  ReinsuranceReq: {
    required: [
      ...COMMON_ASYNC_HEADER_FIELDS,
      'CoverNoteReferenceNumber',
      'PremiumIncludingTax',
      'CurrencyCode',
      'ExchangeRate',
      'AuthorizingOfficerName',
      'AuthorizingOfficerTitle',
      'ReinsuranceCategory',
      'Participant',
    ],
  },

  PolicyReq: {
    required: [
      ...COMMON_ASYNC_HEADER_FIELDS,
      'PolicyNumber',
      'PolicyOperativeClause',
      'SpecialConditions',
      'CoverNoteReferenceNumber',
    ],
  },

  ClaimNotificationRefReq: {
    required: [
      ...COMMON_ASYNC_HEADER_FIELDS,
      'TranCompanyCode',
      'ClaimNotificationNumber',
      'CoverNoteReferenceNumber',
      'ClaimReportDate',
      'ClaimFormDullyFilled',
      'LossDate',
      'LossNature',
      'LossType',
      'LossLocation',
      'OfficerName',
      'OfficerTitle',
    ],
  },

  ClaimIntimationReq: {
    required: [
      ...COMMON_ASYNC_HEADER_FIELDS,
      'ClaimIntimationNumber',
      'ClaimReferenceNumber',
      'CoverNoteReferenceNumber',
      'ClaimIntimationDate',
      'CurrencyCode',
      'ExchangeRate',
      'ClaimEstimatedAmount',
      'ClaimReserveAmount',
      'ClaimReserveMethod',
      'LossAssessmentOption',
      'AssessorName',
      'AssessorIdNumber',
      'AssessorIdType',
      'Claimant',
    ],
  },

  ClaimAssessmentReq: {
    required: [
      ...COMMON_ASYNC_HEADER_FIELDS,
      'ClaimAssessmentNumber',
      'ClaimIntimationNumber',
      'ClaimReferenceNumber',
      'CoverNoteReferenceNumber',
      'AssessmentReceivedDate',
      'AssessmentReportSummary',
      'CurrencyCode',
      'ExchangeRate',
      'AssessmentAmount',
      'ApprovedClaimAmount',
      'ClaimApprovalDate',
      'ClaimApprovalAuthority',
      'IsReAssessment',
      'Claimant',
    ],
  },

  DischargeVoucherReq: {
    required: [
      ...COMMON_ASYNC_HEADER_FIELDS,
      'DischargeVoucherNumber',
      'ClaimAssessmentNumber',
      'ClaimReferenceNumber',
      'CoverNoteReferenceNumber',
      'DischargeVoucherDate',
      'CurrencyCode',
      'ExchangeRate',
      'ClaimOfferCommunicationDate',
      'ClaimOfferAmount',
      'ClaimantResponseDate',
      'AdjustmentDate',
      'AdjustmentReason',
      'AdjustmentAmount',
      'ReconciliationDate',
      'ReconciliationSummary',
      'ReconciledAmount',
      'OfferAccepted',
      'Claimant',
    ],
  },

  ClaimPaymentReq: {
    required: [
      ...COMMON_ASYNC_HEADER_FIELDS,
      'ClaimPaymentNumber',
      'ClaimReferenceNumber',
      'ClaimIntimationNumber',
      'CoverNoteReferenceNumber',
      'PaymentDate',
      'PaidAmount',
      'PaymentMode',
      'PartiesNotified',
      'NetPremiumEarned',
      'ClaimResultedLitigation',
      'LitigationReason',
      'CurrencyCode',
      'ExchangeRate',
      'Claimant',
    ],
  },

  ClaimRejectionReq: {
    required: [
      ...COMMON_ASYNC_HEADER_FIELDS,
      'ClaimRejectionNumber',
      'ClaimReferenceNumber',
      'ClaimIntimationNumber',
      'CoverNoteReferenceNumber',
      'RejectionDate',
      'RejectionReason',
      'ClaimResultedLitigation',
      'ClaimAmount',
      'CurrencyCode',
      'ExchangeRate',
      'Claimant',
    ],
  },

  CoverNoteVerificationReq: {
    required: [...COMMON_SYNC_HEADER_FIELDS],
  },

  MotorVerificationReq: {
    required: [...COMMON_SYNC_HEADER_FIELDS],
    anyOf: [['MotorRegistrationNumber'], ['MotorChassisNumber']],
  },

  NINVerificationReq: {
    required: [...COMMON_SYNC_HEADER_FIELDS, 'NIN'],
  },

  CompanyVerificationReq: {
    required: [...COMMON_SYNC_HEADER_FIELDS, 'CompanyName'],
    anyOf: [['TIN'], ['RegistrationNumber'], ['CompanyCode']],
  },

  DetailsVerificationReq: {
    required: [...COMMON_SYNC_HEADER_FIELDS],
    anyOf: [
      ['NIN'],
      ['TIN'],
      ['RegistrationNumber'],
      ['CoverNoteReferenceNumber'],
      ['PolicyNumber'],
      ['RegistrationNumber'],
    ],
  },
};

const DATE_TIME_FIELDS = [
  'ClaimReportDate',
  'LossDate',
  'ClaimIntimationDate',
  'AssessmentReceivedDate',
  'ClaimApprovalDate',
  'DischargeVoucherDate',
  'ClaimOfferCommunicationDate',
  'ClaimantResponseDate',
  'AdjustmentDate',
  'ReconciliationDate',
  'PaymentDate',
  'RejectionDate',
  'ParticipationDate',
];

const DATE_ONLY_FIELDS = ['ClaimantBirthDate'];

const NUMERIC_FIELDS = [
  'PremiumIncludingTax',
  'ExchangeRate',
  'BrokerageCommission',
  'ReinsuranceCommission',
  'PremiumShare',
  'ClaimEstimatedAmount',
  'ClaimReserveAmount',
  'AssessmentAmount',
  'ApprovedClaimAmount',
  'ClaimOfferAmount',
  'AdjustmentAmount',
  'ReconciledAmount',
  'PaidAmount',
  'NetPremiumEarned',
  'ClaimAmount',
];

const THREE_LETTER_CODE_FIELDS = ['CurrencyCode', 'CountryCode'];

const YES_NO_FIELDS = [
  'ClaimFormDullyFilled',
  'IsReAssessment',
  'OfferAccepted',
  'PartiesNotified',
  'ClaimResultedLitigation',
];

module.exports = {
  BUSINESS_VALIDATION_RULES,
  DATE_TIME_FIELDS,
  DATE_ONLY_FIELDS,
  NUMERIC_FIELDS,
  THREE_LETTER_CODE_FIELDS,
  YES_NO_FIELDS,
};
