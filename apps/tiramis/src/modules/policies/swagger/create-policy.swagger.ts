export const createPolicyRequestExample = {
  environment: 'test',
  clientConfigurationId: 'replace-with-seeded-client-configuration-id',
  sourceModule: 'tiramis-policies',
  sourceRecordId: 'POL-LOCAL-001',
  companyCode: 'ICC110',
  systemCode: 'LSYS_ALLIANCE_003',
  callbackUrl: 'http://localhost:9091/api/tiramis/callbacks/test',
  insurerCompanyCode: 'ICC110',
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
      'environment',
      'clientConfigurationId',
      'companyCode',
      'systemCode',
      'callbackUrl',
      'insurerCompanyCode',
      'policyNumber',
      'policyOperativeClause',
      'specialConditions',
      'coverNoteReferenceNumbers',
    ],
    properties: {
      environment: { type: 'string', example: 'test' },
      clientConfigurationId: {
        type: 'string',
        example: 'replace-with-seeded-client-configuration-id',
      },
      sourceModule: {
        type: 'string',
        nullable: true,
        example: 'tiramis-policies',
      },
      sourceRecordId: {
        type: 'string',
        nullable: true,
        example: 'POL-LOCAL-001',
      },
      companyCode: { type: 'string', example: 'ICC110' },
      systemCode: { type: 'string', example: 'LSYS_ALLIANCE_003' },
      callbackUrl: {
        type: 'string',
        example: 'http://localhost:9091/api/tiramis/callbacks/test',
      },
      insurerCompanyCode: { type: 'string', example: 'ICC110' },
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
