const baseVerificationProperties = {
  environment: { type: 'string', example: 'test' },
  clientConfigurationId: {
    type: 'string',
    example: 'replace-with-seeded-client-configuration-id',
  },
  sourceModule: {
    type: 'string',
    nullable: true,
    example: 'tiramis-verifications',
  },
  sourceRecordId: {
    type: 'string',
    nullable: true,
    example: 'VRF-LOCAL-001',
  },
  companyCode: { type: 'string', example: 'ICC110' },
  systemCode: { type: 'string', example: 'LSYS_ALLIANCE_003' },
} as const;

const baseVerificationRequired = [
  'environment',
  'clientConfigurationId',
  'companyCode',
  'systemCode',
] as const;

export const coverNoteVerificationRequestBody = {
  required: true,
  schema: {
    type: 'object',
    required: [...baseVerificationRequired],
    properties: {
      ...baseVerificationProperties,
      coverNoteReferenceNumber: {
        type: 'string',
        nullable: true,
        example: 'TIRA-CN-000001',
      },
      stickerNumber: { type: 'string', nullable: true, example: 'STK000001' },
      motorRegistrationNumber: {
        type: 'string',
        nullable: true,
        example: 'T123ABC',
      },
      motorChassisNumber: {
        type: 'string',
        nullable: true,
        example: 'MOCKCHASSIS123456',
      },
    },
    example: {
      environment: 'test',
      clientConfigurationId: 'replace-with-seeded-client-configuration-id',
      sourceModule: 'tiramis-verifications',
      sourceRecordId: 'VRF-COVER-NOTE-001',
      companyCode: 'ICC110',
      systemCode: 'LSYS_ALLIANCE_003',
      coverNoteReferenceNumber: 'TIRA-CN-000001',
    },
  },
} as const;

export const ninVerificationRequestBody = {
  required: true,
  schema: {
    type: 'object',
    required: [...baseVerificationRequired, 'nin'],
    properties: {
      ...baseVerificationProperties,
      nin: { type: 'string', example: '19900101123456789000' },
    },
    example: {
      environment: 'test',
      clientConfigurationId: 'replace-with-seeded-client-configuration-id',
      sourceModule: 'tiramis-verifications',
      sourceRecordId: 'VRF-NIN-001',
      companyCode: 'ICC110',
      systemCode: 'LSYS_ALLIANCE_003',
      nin: '19900101123456789000',
    },
  },
} as const;

export const companyVerificationRequestBody = {
  required: true,
  schema: {
    type: 'object',
    required: [...baseVerificationRequired, 'incorporationCertificateNumber'],
    properties: {
      ...baseVerificationProperties,
      incorporationCertificateNumber: {
        type: 'string',
        example: 'INC-123456',
      },
    },
    example: {
      environment: 'test',
      clientConfigurationId: 'replace-with-seeded-client-configuration-id',
      sourceModule: 'tiramis-verifications',
      sourceRecordId: 'VRF-COMPANY-001',
      companyCode: 'ICC110',
      systemCode: 'LSYS_ALLIANCE_003',
      incorporationCertificateNumber: 'INC-123456',
    },
  },
} as const;

export const motorVerificationRequestBody = {
  required: true,
  schema: {
    type: 'object',
    required: [...baseVerificationRequired],
    properties: {
      ...baseVerificationProperties,
      motorRegistrationNumber: {
        type: 'string',
        nullable: true,
        example: 'T123ABC',
      },
      motorChassisNumber: {
        type: 'string',
        nullable: true,
        example: 'MOCKCHASSIS123456',
      },
    },
    example: {
      environment: 'test',
      clientConfigurationId: 'replace-with-seeded-client-configuration-id',
      sourceModule: 'tiramis-verifications',
      sourceRecordId: 'VRF-MOTOR-001',
      companyCode: 'ICC110',
      systemCode: 'LSYS_ALLIANCE_003',
      motorRegistrationNumber: 'T123ABC',
      motorChassisNumber: 'MOCKCHASSIS123456',
    },
  },
} as const;

export const detailsVerificationRequestBody = {
  required: true,
  schema: {
    type: 'object',
    required: [...baseVerificationRequired],
    properties: {
      ...baseVerificationProperties,
      motorRegistrationNumber: {
        type: 'string',
        nullable: true,
        example: 'T123ABC',
      },
      motorChassisNumber: {
        type: 'string',
        nullable: true,
        example: 'MOCKCHASSIS123456',
      },
      coverNoteReferenceNumber: {
        type: 'string',
        nullable: true,
        example: 'TIRA-CN-000001',
      },
      stickerNumber: { type: 'string', nullable: true, example: 'STK000001' },
    },
    example: {
      environment: 'test',
      clientConfigurationId: 'replace-with-seeded-client-configuration-id',
      sourceModule: 'tiramis-verifications',
      sourceRecordId: 'VRF-DETAILS-001',
      companyCode: 'ICC110',
      systemCode: 'LSYS_ALLIANCE_003',
      motorRegistrationNumber: 'T123ABC',
      coverNoteReferenceNumber: 'TIRA-CN-000001',
    },
  },
} as const;
