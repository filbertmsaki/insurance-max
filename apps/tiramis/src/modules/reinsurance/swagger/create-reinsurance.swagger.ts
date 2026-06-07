export const createReinsuranceRequestExample = {
  coverNoteReferenceNumber: 'TIRA-CN-000001',
  premiumIncludingTax: '118000.00',
  currencyCode: 'TZS',
  exchangeRate: '1.00',
  authorizingOfficerName: 'Mock Underwriter',
  authorizingOfficerTitle: 'Underwriter',
  reinsuranceCategory: 1,
  participants: [
    {
      participantCode: 'RE001',
      participantType: 1,
      reinsuranceForm: 1,
      reinsuranceType: 1,
      reBrokerCode: 'BRK001',
      brokerageCommission: '5.00',
      reinsuranceCommission: '10.00',
      premiumShare: '50.00',
      participationDate: '2026-06-06T00:00:00',
    },
  ],
} as const;

const participantSchema = {
  type: 'object',
  required: [
    'participantCode',
    'participantType',
    'reinsuranceForm',
    'reinsuranceType',
    'brokerageCommission',
    'reinsuranceCommission',
    'premiumShare',
    'participationDate',
  ],
  properties: {
    participantCode: { type: 'string', example: 'RE001' },
    participantType: { type: 'number', example: 1 },
    reinsuranceForm: { type: 'number', example: 1 },
    reinsuranceType: { type: 'number', example: 1 },
    reBrokerCode: { type: 'string', nullable: true, example: 'BRK001' },
    brokerageCommission: { type: 'string', example: '5.00' },
    reinsuranceCommission: { type: 'string', example: '10.00' },
    premiumShare: { type: 'string', example: '50.00' },
    participationDate: {
      type: 'string',
      format: 'date-time',
      example: '2026-06-06T00:00:00',
    },
  },
};

export const createReinsuranceRequestBody = {
  description:
    'Tiramis reinsurance draft and submission request body. The same JSON payload is used for both routes.',
  required: true,
  schema: {
    type: 'object',
    required: [
      'coverNoteReferenceNumber',
      'premiumIncludingTax',
      'currencyCode',
      'exchangeRate',
      'authorizingOfficerName',
      'authorizingOfficerTitle',
      'reinsuranceCategory',
      'participants',
    ],
    properties: {
      coverNoteReferenceNumber: {
        type: 'string',
        example: 'TIRA-CN-000001',
      },
      premiumIncludingTax: { type: 'string', example: '118000.00' },
      currencyCode: { type: 'string', example: 'TZS' },
      exchangeRate: { type: 'string', example: '1.00' },
      authorizingOfficerName: {
        type: 'string',
        example: 'Mock Underwriter',
      },
      authorizingOfficerTitle: { type: 'string', example: 'Underwriter' },
      reinsuranceCategory: { type: 'number', example: 1 },
      participants: {
        type: 'array',
        minItems: 1,
        items: participantSchema,
      },
    },
    example: createReinsuranceRequestExample,
  },
} as const;
