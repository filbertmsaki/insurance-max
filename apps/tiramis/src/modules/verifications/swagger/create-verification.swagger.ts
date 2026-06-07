const baseVerificationProperties = {
} as const;

export const coverNoteVerificationRequestBody = {
  required: true,
  schema: {
    type: 'object',
    required: [],
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
      coverNoteReferenceNumber: 'TIRA-CN-000001',
    },
  },
} as const;

export const ninVerificationRequestBody = {
  required: true,
  schema: {
    type: 'object',
    required: ['nin'],
    properties: {
      ...baseVerificationProperties,
      nin: { type: 'string', example: '19900101123456789000' },
    },
    example: {
      nin: '19900101123456789000',
    },
  },
} as const;

export const companyVerificationRequestBody = {
  required: true,
  schema: {
    type: 'object',
    required: ['incorporationCertificateNumber'],
    properties: {
      ...baseVerificationProperties,
      incorporationCertificateNumber: {
        type: 'string',
        example: 'INC-123456',
      },
    },
    example: {
      incorporationCertificateNumber: 'INC-123456',
    },
  },
} as const;

export const motorVerificationRequestBody = {
  required: true,
  schema: {
    type: 'object',
    required: [],
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
      motorRegistrationNumber: 'T123ABC',
      motorChassisNumber: 'MOCKCHASSIS123456',
    },
  },
} as const;

export const detailsVerificationRequestBody = {
  required: true,
  schema: {
    type: 'object',
    required: [],
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
      motorRegistrationNumber: 'T123ABC',
      coverNoteReferenceNumber: 'TIRA-CN-000001',
    },
  },
} as const;
