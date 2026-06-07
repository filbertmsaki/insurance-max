export const createPolicyRequestExample = {
  policyNumber: 'POL-LOCAL-001',
  policyOperativeClause: 'Private motor comprehensive insurance',
  specialConditions: 'Policy issued after successful cover note acceptance',
  exclusions: 'Subject to standard exclusions',
  coverNoteReferenceNumbers: ['TIRA-CN-000001'],
} as const;

export const createPolicyRequestBody = {
  description:
    'Tiramis policy draft and submission request body. The same JSON payload is used for both routes.',
  required: true,
  schema: {
    type: 'object',
    required: [
      'policyNumber',
      'policyOperativeClause',
      'specialConditions',
      'coverNoteReferenceNumbers',
    ],
    properties: {
      policyNumber: { type: 'string', example: 'POL-LOCAL-001' },
      policyOperativeClause: {
        type: 'string',
        example: 'Private motor comprehensive insurance',
      },
      specialConditions: {
        type: 'string',
        example: 'Policy issued after successful cover note acceptance',
      },
      exclusions: {
        type: 'string',
        nullable: true,
        example: 'Subject to standard exclusions',
      },
      coverNoteReferenceNumbers: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'string',
          example: 'TIRA-CN-000001',
        },
      },
    },
    example: createPolicyRequestExample,
  },
} as const;
