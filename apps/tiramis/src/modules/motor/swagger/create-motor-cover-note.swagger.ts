import {
  createCoverNoteRequestBody,
  createCoverNoteRequestExample,
} from '../../cover-notes/swagger/create-cover-note.swagger';

export const createMotorCoverNoteRequestExample = {
  ...createCoverNoteRequestExample,
  sourceModule: 'tiramis-motor',
  sourceRecordId: 'MOTOR-CN-LOCAL-001',
  coverNoteNumber: 'MOTOR-CN-LOCAL-001',
  coverNoteDesc: 'Mock TIRAMIS private motor comprehensive cover note',
  operativeClause: 'Private motor comprehensive insurance',
  isFleet: false,
  motorDetail: {
    motorCategory: 1,
    motorType: 1,
    registrationNumber: 'T123ABC',
    chassisNumber: 'MOCKCHASSIS123456',
    make: 'TOYOTA',
    model: 'IST',
    modelNumber: 'NCP60',
    bodyType: 'SALOON',
    color: 'WHITE',
    engineNumber: 'MOCKENGINE123',
    engineCapacity: '1490',
    fuelUsed: 'PETROL',
    numberOfAxles: 2,
    axleDistance: '2.37',
    sittingCapacity: 5,
    yearOfManufacture: 2015,
    tareWeight: '1100.00',
    grossWeight: '1500.00',
    motorUsage: 1,
    ownerName: 'Mock Policy Holder',
    ownerCategory: 1,
    ownerAddress: 'P.O. BOX 123, Dar es Salaam',
  },
  risks: [
    {
      riskCode: 'SP005001000001',
      sumInsured: '10000000.00',
      sumInsuredEquivalent: '10000000.00',
      premiumRate: '0.01000',
      premiumBeforeDiscount: '100000.00',
      premiumAfterDiscount: '100000.00',
      premiumExcludingTaxEquivalent: '100000.00',
      premiumIncludingTax: '118000.00',
      discounts: [],
      taxes: [
        {
          taxCode: 'VAT-MAINLAND',
          isTaxExempted: 'N',
          taxExemptionType: '',
          taxExemptionReference: '',
          taxRate: '0.18',
          taxAmount: '18000.00',
        },
      ],
    },
  ],
  subjectMatters: [
    {
      subjectMatterReference: 'T123ABC',
      subjectMatterDesc: 'Toyota IST registration T123ABC',
    },
  ],
  addons: [],
  policyHolders: [
    {
      policyHolderName: 'Mock Policy Holder',
      policyHolderBirthDate: '1990-01-01',
      policyHolderType: 1,
      policyHolderIdNumber: '19900101123456789000',
      policyHolderIdType: 1,
      gender: 'M',
      countryCode: 'TZA',
      region: 'Dar es Salaam',
      district: 'Ilala',
      street: 'Samora Avenue',
      phoneNumber: '255713525539',
      fax: '',
      postalAddress: 'P.O. BOX 123, Dar es Salaam',
      emailAddress: 'mock.policyholder@example.com',
    },
  ],
} as const;

const motorDetailSchema = {
  type: 'object',
  required: ['chassisNumber'],
  properties: {
    motorCategory: { type: 'number', nullable: true, example: 1 },
    motorType: { type: 'number', nullable: true, example: 1 },
    registrationNumber: { type: 'string', nullable: true, example: 'T123ABC' },
    chassisNumber: { type: 'string', example: 'MOCKCHASSIS123456' },
    make: { type: 'string', nullable: true, example: 'TOYOTA' },
    model: { type: 'string', nullable: true, example: 'IST' },
    modelNumber: { type: 'string', nullable: true, example: 'NCP60' },
    bodyType: { type: 'string', nullable: true, example: 'SALOON' },
    color: { type: 'string', nullable: true, example: 'WHITE' },
    engineNumber: { type: 'string', nullable: true, example: 'MOCKENGINE123' },
    engineCapacity: { type: 'string', nullable: true, example: '1490' },
    fuelUsed: { type: 'string', nullable: true, example: 'PETROL' },
    numberOfAxles: { type: 'number', nullable: true, example: 2 },
    axleDistance: { type: 'string', nullable: true, example: '2.37' },
    sittingCapacity: { type: 'number', nullable: true, example: 5 },
    yearOfManufacture: { type: 'number', nullable: true, example: 2015 },
    tareWeight: { type: 'string', nullable: true, example: '1100.00' },
    grossWeight: { type: 'string', nullable: true, example: '1500.00' },
    motorUsage: { type: 'number', nullable: true, example: 1 },
    ownerName: {
      type: 'string',
      nullable: true,
      example: 'Mock Policy Holder',
    },
    ownerCategory: { type: 'number', nullable: true, example: 1 },
    ownerAddress: {
      type: 'string',
      nullable: true,
      example: 'P.O. BOX 123, Dar es Salaam',
    },
  },
};

const fleetItemSchema = {
  type: 'object',
  required: ['coverNoteNumber', 'motorDetail'],
  properties: {
    fleetEntry: { type: 'string', nullable: true, example: '1' },
    coverNoteNumber: { type: 'string', example: 'MOTOR-CN-LOCAL-001' },
    prevCoverNoteReferenceNumber: {
      type: 'string',
      nullable: true,
      example: '',
    },
    coverNoteDesc: {
      type: 'string',
      nullable: true,
      example: 'Fleet motor cover note',
    },
    operativeClause: {
      type: 'string',
      nullable: true,
      example: 'Private motor comprehensive insurance',
    },
    endorsementType: { type: 'number', nullable: true, example: null },
    endorsementReason: { type: 'string', nullable: true, example: null },
    endorsementPremiumEarned: {
      type: 'string',
      nullable: true,
      example: null,
    },
    motorDetail: motorDetailSchema,
  },
};

const fleetSchema = {
  type: 'object',
  required: ['fleetId', 'fleetSize', 'items'],
  properties: {
    fleetId: { type: 'string', example: 'FLEET-001' },
    fleetType: { type: 'number', nullable: true, example: 1 },
    fleetSize: { type: 'number', example: 2 },
    comprehensiveInsured: {
      type: 'string',
      nullable: true,
      example: '20000000.00',
    },
    items: {
      type: 'array',
      minItems: 1,
      items: fleetItemSchema,
    },
  },
};

export const createMotorCoverNoteRequestBody = {
  description:
    'Tiramis motor cover note draft and submission request body for both fleet and non-fleet requests.',
  required: true,
  schema: {
    ...createCoverNoteRequestBody.schema,
    required: [...createCoverNoteRequestBody.schema.required, 'isFleet'],
    properties: {
      ...createCoverNoteRequestBody.schema.properties,
      sourceModule: {
        type: 'string',
        nullable: true,
        example: 'tiramis-motor',
      },
      isFleet: { type: 'boolean', example: false },
      motorDetail: {
        ...motorDetailSchema,
        nullable: true,
      },
      fleet: {
        ...fleetSchema,
        nullable: true,
      },
    },
    example: createMotorCoverNoteRequestExample,
  },
} as const;
