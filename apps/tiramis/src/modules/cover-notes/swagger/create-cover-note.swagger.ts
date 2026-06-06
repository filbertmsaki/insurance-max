export const createCoverNoteRequestExample = {
  environment: 'test',
  clientConfigurationId: 'replace-with-seeded-client-configuration-id',
  sourceModule: 'tiramis-cover-notes',
  sourceRecordId: 'CVN-00004',
  companyCode: 'ICC110',
  systemCode: 'LSYS_ALLIANCE_003',
  callbackUrl: 'http://localhost:5050/tiramis/mock',
  insurerCompanyCode: 'ICC110',
  tranCompanyCode: 'ICC110',
  coverNoteType: 1,
  coverNoteNumber: 'NIC00004',
  prevCoverNoteReferenceNumber: '',
  salePointCode: 'SP500',
  coverNoteStartDate: '2021-07-04T01:15:22',
  coverNoteEndDate: '2022-07-04T23:59:59',
  coverNoteDesc:
    'CoverNote for Residential House Insurance at Dar es Salaam Magomeni',
  operativeClause: 'Fire and Allied Perils',
  paymentMode: 1,
  currencyCode: 'TZS',
  exchangeRate: '1.00',
  totalPremiumExcludingTax: '29060.00',
  totalPremiumIncludingTax: '33570.80',
  commissionPaid: '0.00',
  commissionRate: '0.00',
  officerName: 'John Doe',
  officerTitle: 'Underwriter',
  productCode: 'SP005001000000',
  endorsementType: null,
  endorsementReason: null,
  endorsementPremiumEarned: null,
  risks: [
    {
      riskCode: 'SP005001000001',
      sumInsured: '1000000.00',
      sumInsuredEquivalent: '1000000.00',
      premiumRate: '0.005',
      premiumBeforeDiscount: '5000.00',
      premiumAfterDiscount: '4000.00',
      premiumExcludingTaxEquivalent: '4000.00',
      premiumIncludingTax: '4720.00',
      discounts: [
        {
          discountType: 2,
          discountRate: '0.00',
          discountAmount: '1000.00',
        },
      ],
      taxes: [
        {
          taxCode: 'VAT-MAINLAND',
          isTaxExempted: 'Y',
          taxExemptionType: '1',
          taxExemptionReference: '2334ER232TYU',
          taxRate: '0.18',
          taxAmount: '720.00',
        },
      ],
    },
  ],
  subjectMatters: [
    {
      subjectMatterReference: 'HSB001',
      subjectMatterDesc: 'House water systems',
    },
  ],
  addons: [
    {
      addonReference: '1',
      addonDesc: 'Underground Water and Sewer Service Lines',
      addonAmount: '2000.00',
      addonPremiumRate: '0.02',
      premiumExcludingTax: '40.00',
      premiumExcludingTaxEquivalent: '40.00',
      premiumIncludingTax: '47.20',
      taxes: [
        {
          taxCode: 'VAT-MAINLAND',
          isTaxExempted: 'Y',
          taxExemptionType: '1',
          taxExemptionReference: '2334ER232TYU',
          taxRate: '0.18',
          taxAmount: '7.20',
        },
      ],
    },
  ],
  policyHolders: [
    {
      policyHolderName: 'Augustino Aidan Mwageni',
      policyHolderBirthDate: '1920-02-05',
      policyHolderType: 1,
      policyHolderIdNumber: '24241241',
      policyHolderIdType: 1,
      gender: '',
      countryCode: 'TZA',
      region: 'Region',
      district: 'Ilala',
      street: '',
      phoneNumber: '255713525539',
      fax: '',
      postalAddress: 'P.O.BOX 1231, Dar es Salaam',
      emailAddress: 'mimi@email.com',
    },
  ],
} as const;

const taxSchema = {
  type: 'object',
  required: ['taxCode', 'taxRate', 'taxAmount'],
  properties: {
    taxCode: { type: 'string', example: 'VAT-MAINLAND' },
    isTaxExempted: { type: 'string', example: 'N' },
    taxExemptionType: { type: 'string', nullable: true, example: '1' },
    taxExemptionReference: {
      type: 'string',
      nullable: true,
      example: '2334ER232TYU',
    },
    taxRate: { type: 'string', example: '0.18' },
    taxAmount: { type: 'string', example: '720.00' },
  },
};

const discountSchema = {
  type: 'object',
  properties: {
    discountType: { type: 'number', nullable: true, example: 2 },
    discountRate: { type: 'string', nullable: true, example: '0.00' },
    discountAmount: { type: 'string', nullable: true, example: '1000.00' },
  },
};

const riskSchema = {
  type: 'object',
  required: [
    'riskCode',
    'sumInsured',
    'sumInsuredEquivalent',
    'premiumRate',
    'premiumBeforeDiscount',
    'premiumAfterDiscount',
    'premiumExcludingTaxEquivalent',
    'premiumIncludingTax',
  ],
  properties: {
    riskCode: { type: 'string', example: 'SP005001000001' },
    sumInsured: { type: 'string', example: '1000000.00' },
    sumInsuredEquivalent: { type: 'string', example: '1000000.00' },
    premiumRate: { type: 'string', example: '0.005' },
    premiumBeforeDiscount: { type: 'string', example: '5000.00' },
    premiumAfterDiscount: { type: 'string', example: '4000.00' },
    premiumExcludingTaxEquivalent: { type: 'string', example: '4000.00' },
    premiumIncludingTax: { type: 'string', example: '4720.00' },
    discounts: {
      type: 'array',
      items: discountSchema,
    },
    taxes: {
      type: 'array',
      items: taxSchema,
    },
  },
};

const subjectMatterSchema = {
  type: 'object',
  required: ['subjectMatterReference', 'subjectMatterDesc'],
  properties: {
    subjectMatterReference: { type: 'string', example: 'HSB001' },
    subjectMatterDesc: {
      type: 'string',
      example: 'House water systems',
    },
  },
};

const addonSchema = {
  type: 'object',
  required: [
    'addonReference',
    'addonDesc',
    'addonAmount',
    'addonPremiumRate',
    'premiumExcludingTax',
    'premiumExcludingTaxEquivalent',
    'premiumIncludingTax',
  ],
  properties: {
    addonReference: { type: 'string', example: '1' },
    addonDesc: {
      type: 'string',
      example: 'Underground Water and Sewer Service Lines',
    },
    addonAmount: { type: 'string', example: '2000.00' },
    addonPremiumRate: { type: 'string', example: '0.02' },
    premiumExcludingTax: { type: 'string', example: '40.00' },
    premiumExcludingTaxEquivalent: { type: 'string', example: '40.00' },
    premiumIncludingTax: { type: 'string', example: '47.20' },
    taxes: {
      type: 'array',
      items: taxSchema,
    },
  },
};

const policyHolderSchema = {
  type: 'object',
  required: [
    'policyHolderName',
    'policyHolderType',
    'policyHolderIdNumber',
    'policyHolderIdType',
    'countryCode',
    'region',
    'district',
    'phoneNumber',
  ],
  properties: {
    policyHolderName: {
      type: 'string',
      example: 'Augustino Aidan Mwageni',
    },
    policyHolderBirthDate: {
      type: 'string',
      nullable: true,
      example: '1920-02-05',
    },
    policyHolderType: { type: 'number', example: 1 },
    policyHolderIdNumber: { type: 'string', example: '24241241' },
    policyHolderIdType: { type: 'number', example: 1 },
    gender: { type: 'string', nullable: true, example: '' },
    countryCode: { type: 'string', example: 'TZA' },
    region: { type: 'string', example: 'Region' },
    district: { type: 'string', example: 'Ilala' },
    street: { type: 'string', nullable: true, example: '' },
    phoneNumber: { type: 'string', example: '255713525539' },
    fax: { type: 'string', nullable: true, example: '' },
    postalAddress: {
      type: 'string',
      nullable: true,
      example: 'P.O.BOX 1231, Dar es Salaam',
    },
    emailAddress: {
      type: 'string',
      nullable: true,
      example: 'mimi@email.com',
    },
  },
};

export const createCoverNoteRequestBody = {
  description:
    'Tiramis cover note draft and submission request body. The same JSON payload is used for both routes.',
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
      'coverNoteType',
      'coverNoteNumber',
      'salePointCode',
      'coverNoteStartDate',
      'coverNoteEndDate',
      'coverNoteDesc',
      'operativeClause',
      'paymentMode',
      'currencyCode',
      'exchangeRate',
      'totalPremiumExcludingTax',
      'totalPremiumIncludingTax',
      'officerName',
      'officerTitle',
      'productCode',
      'risks',
      'policyHolders',
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
        example: 'tiramis-cover-notes',
      },
      sourceRecordId: { type: 'string', nullable: true, example: 'CVN-00004' },
      companyCode: { type: 'string', example: 'ICC110' },
      systemCode: { type: 'string', example: 'LSYS_ALLIANCE_003' },
      callbackUrl: {
        type: 'string',
        example: 'http://localhost:5050/tiramis/mock',
      },
      insurerCompanyCode: { type: 'string', example: 'ICC110' },
      tranCompanyCode: { type: 'string', nullable: true, example: 'ICC110' },
      coverNoteType: { type: 'number', example: 1 },
      coverNoteNumber: { type: 'string', example: 'NIC00004' },
      prevCoverNoteReferenceNumber: {
        type: 'string',
        nullable: true,
        example: '',
      },
      salePointCode: { type: 'string', example: 'SP500' },
      coverNoteStartDate: {
        type: 'string',
        format: 'date-time',
        example: '2021-07-04T01:15:22',
      },
      coverNoteEndDate: {
        type: 'string',
        format: 'date-time',
        example: '2022-07-04T23:59:59',
      },
      coverNoteDesc: {
        type: 'string',
        example:
          'CoverNote for Residential House Insurance at Dar es Salaam Magomeni',
      },
      operativeClause: {
        type: 'string',
        example: 'Fire and Allied Perils',
      },
      paymentMode: { type: 'number', example: 1 },
      currencyCode: { type: 'string', example: 'TZS' },
      exchangeRate: { type: 'string', example: '1.00' },
      totalPremiumExcludingTax: { type: 'string', example: '29060.00' },
      totalPremiumIncludingTax: { type: 'string', example: '33570.80' },
      commissionPaid: { type: 'string', nullable: true, example: '0.00' },
      commissionRate: { type: 'string', nullable: true, example: '0.00' },
      officerName: { type: 'string', example: 'John Doe' },
      officerTitle: { type: 'string', example: 'Underwriter' },
      productCode: { type: 'string', example: 'SP005001000000' },
      endorsementType: { type: 'number', nullable: true, example: null },
      endorsementReason: { type: 'string', nullable: true, example: null },
      endorsementPremiumEarned: {
        type: 'string',
        nullable: true,
        example: null,
      },
      risks: {
        type: 'array',
        minItems: 1,
        items: riskSchema,
      },
      subjectMatters: {
        type: 'array',
        items: subjectMatterSchema,
      },
      addons: {
        type: 'array',
        items: addonSchema,
      },
      policyHolders: {
        type: 'array',
        minItems: 1,
        items: policyHolderSchema,
      },
    },
    example: createCoverNoteRequestExample,
  },
} as const;
