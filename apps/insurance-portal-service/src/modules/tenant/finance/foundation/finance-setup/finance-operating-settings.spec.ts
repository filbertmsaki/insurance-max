import {
  FIN01_MODULES,
  FINANCE_DOCUMENT_TYPES,
} from '@insurance-max/contracts';
import { parseTanzaniaProfilePatch } from '../../../../platform/companies/tanzania-finance-profile';
import { operatingSettingsIssues } from './finance-operating-settings';
import {
  tanzaniaProfileIssues,
  type TanzaniaProfileSource,
} from './tanzania-profile-review';
import { setupInput } from './finance-setup.types';
import { selectSetupTaxRules } from './finance-setup-tax';
import { validateSetupConfiguration } from './finance-setup-configuration';
import { randomUUID } from 'node:crypto';

const company = {
  name: 'Registered company',
  status: 'active',
  company_type: 'INSURANCE_COMPANY',
  tin: '123456789',
  brela_registration_number: '456789',
  tira_license_number: 'IR-508',
  tira_license_status: 'VALID',
  license_issued_at: '2024-12-01',
  license_expires_at: null,
};
const source: TanzaniaProfileSource = {
  address: {
    street: '1 Example Street',
    region: 'Dar es Salaam',
    country: 'Tanzania',
  },
  mainlandVrn: null,
  profile: {
    registry: 'BRELA',
    legalForm: 'Public company',
    registrationStanding: 'ACTIVE',
    incorporationCountry: 'TZ',
    incorporationDate: '2020-01-01',
    activities: 'General insurance',
    registeredOffice: 'COMPANY_ADDRESS',
    principalOffice: 'SAME_AS_REGISTERED',
    territory: 'MAINLAND',
    mainlandVat: 'NOT_REGISTERED',
    licensing: 'REGULATED',
    licensedClasses: 'Motor',
    licensedTerritory: 'MAINLAND',
    licenceCycle: 'ANNUAL_MAINTENANCE',
    maintenanceThrough: '2026-12-31',
    maintenanceRef: 'M-5',
  },
};
const input = (purposes: string[]) =>
  setupInput({
    step: 'G04-01',
    purpose: 'COMPANY_SETUP',
    version: 1,
    effectiveFrom: '2026-01-01',
    effectiveTo: '2027-01-01',
    answers: {},
    dependencies: [],
    evidence: purposes.map((purpose) => ({
      id: randomUUID(),
      documentId: randomUUID(),
      hash: 'a'.repeat(64),
      purpose,
    })),
  });
const baseEvidence = [
  'LICENCE',
  'TIN',
  'REGISTRATION',
  'ASSOCIATION',
  'TIRA_MAINTENANCE',
];

describe('Tanzania company profile', () => {
  it('accepts an evidenced Mainland insurer on annual maintenance without an invented expiry or VRN', () => {
    expect(tanzaniaProfileIssues(company, source, input(baseEvidence))).toEqual(
      [],
    );
  });
  it('requires BPRA, ZRA and Zanzibar VAT evidence for the corresponding registered operation', () => {
    const zanzibar = {
      ...source,
      address: {
        ...source.address,
        street: 'Registered office, Stone Town',
        region: 'Mjini Magharibi',
        country: 'TZ',
      },
      profile: {
        ...source.profile,
        registry: 'BPRA',
        territory: 'ZANZIBAR',
        licensedTerritory: 'ZANZIBAR',
        zanzibarVat: 'REGISTERED',
      },
    };
    const errors = tanzaniaProfileIssues(
      company,
      zanzibar,
      input(baseEvidence),
    );
    expect(
      tanzaniaProfileIssues(
        company,
        { ...zanzibar, address: { ...zanzibar.address, country: 'KE' } },
        input(baseEvidence),
      ),
    ).toContain(
      'Verify the Zanzibar registered office against the BPRA evidence.',
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        'Attach BPRA_REGISTRATION evidence.',
        'Attach ZTN evidence.',
        'Attach ZANZIBAR_VAT evidence.',
      ]),
    );
    expect(
      tanzaniaProfileIssues(
        { ...company, brela_registration_number: null },
        {
          ...zanzibar,
          profile: {
            ...zanzibar.profile,
            bpraNumber: 'BZ-14',
            ztn: '7456',
            zanzibarVatNo: 'Z-45',
            zanzibarVatFrom: '2025-01-01',
          },
        },
        input([...baseEvidence, 'BPRA_REGISTRATION', 'ZTN', 'ZANZIBAR_VAT']),
      ),
    ).toEqual([]);
  });
  it('requires foreign clearance, home regulatory standing and a separate tax assessment for an accredited reinsurer', () => {
    const foreign = {
      ...source,
      profile: {
        ...source.profile,
        registry: 'OTHER',
        otherRegistry: 'Home registrar',
        otherRegistrationNo: 'H-234',
        licensing: 'FOREIGN_ACCREDITATION',
        incorporationCountry: 'KE',
        localTaxRegistration: 'ASSESSED_NO_LOCAL_REGISTRATION',
      },
    };
    const c = {
      ...company,
      company_type: 'REINSURANCE_COMPANY',
      license_expires_at: '2026-12-31',
      tin: null,
    };
    const required = [
      'REGISTRATION',
      'HOME_LICENCE',
      'HOME_GOOD_STANDING',
      'TAX_APPLICABILITY',
      'TIRA_ACCREDITATION',
    ];
    expect(tanzaniaProfileIssues(c, foreign, input(required))).toEqual([]);
    expect(
      tanzaniaProfileIssues(c, foreign, input(['REGISTRATION'])),
    ).toContain('Attach TIRA_ACCREDITATION evidence.');
  });
  it('holds expired rights, a foreign principal office, or a regulated role claiming an exemption', () => {
    expect(
      tanzaniaProfileIssues(
        company,
        {
          ...source,
          address: { ...source.address, country: 'KE' },
          profile: { ...source.profile, maintenanceThrough: '2026-12-30' },
        },
        input(baseEvidence),
      ),
    ).toEqual(
      expect.arrayContaining([
        'Specify the principal office in Tanzania for this domestic registrant.',
        'Licence or maintenance evidence must cover the entire setup interval.',
      ]),
    );
    expect(
      tanzaniaProfileIssues(
        company,
        {
          ...source,
          profile: {
            ...source.profile,
            licensing: 'OUTSIDE_REGULATED_ACTIVITY',
            licenceBasis: 'Consultancy',
          },
        },
        input(baseEvidence),
      ),
    ).toContain('A regulated market role requires TIRA registration.');
  });
  it('rejects unrecognised personal or integration fields and impossible dates', () => {
    for (const patch of [
      { passport: '123' },
      { incorporationDate: '2026-02-30' },
      { mainlandVat: 'SOMETIMES' },
    ])
      expect(() => parseTanzaniaProfilePatch(patch)).toThrow();
    expect(
      parseTanzaniaProfilePatch({
        tradingName: null,
        incorporationCountry: 'TZ',
      }),
    ).toEqual({ tradingName: null, incorporationCountry: 'TZ' });
  });
});
describe('FIN-01 operating settings', () => {
  it('accepts an evidenced empty source tax catalogue only while both source catalogues have no active company rules', () => {
    const payload = {
      schema: 'FINANCE_TAX_RULES_V1',
      activationAuthorized: false,
      sourceTaxCatalogue: 'NO_SOURCE_TAX_RULES',
      applicabilityReason:
        'No source product taxes apply under the reviewed company assessment.',
      sourceTaxRuleIds: [],
      calculationOwner: 'EXISTING_SOURCE_TAX_ENGINE',
      missingBreakdownTreatment: 'BLOCK_POSTING',
      preserveCustomerPayable: true,
    };
    const validate = (value: typeof payload) =>
      validateSetupConfiguration({
        kind: 'TAX_RULES',
        payload: value,
      } as Parameters<typeof validateSetupConfiguration>[0]);
    expect(() => validate(payload)).not.toThrow();
    expect(() => validate({ ...payload, applicabilityReason: '' })).toThrow();
    const select = (rows: object[]) =>
      selectSetupTaxRules(
        rows,
        'NO_SOURCE_TAX_RULES',
        [],
        '2026-01-01',
        '2027-01-01',
      );
    expect(select([])).toEqual([]);
    expect(() =>
      select([{ source: 'LEGACY_TAXES', is_active: true }]),
    ).toThrow();
    expect(() =>
      select([{ source: 'PRODUCT_TAX_RULES', status: 'ACTIVE' }]),
    ).toThrow();
  });
  const settings = {
    numbering: FINANCE_DOCUMENT_TYPES.map((documentType, i) => ({
      documentType,
      prefix: 'F' + i,
      reset: 'MONTH',
      width: 4,
    })),
    paymentTerms: ['CUSTOMER', 'SUPPLIER'].map((party) => ({
      party,
      code: party + '7',
      label: 'Seven days',
      days: 7,
      isDefault: true,
    })),
    termAssignments: [],
    paymentMethods: [
      {
        method: 'CASH',
        direction: 'BOTH',
        referenceRequired: false,
        accountCode: '1100',
      },
    ],
    approvalLimits: [
      'REFUND',
      'COMMISSION_PAYMENT',
      'COMMISSION_ACCRUAL',
      'RECONCILIATION',
    ].map((action) => ({
      action,
      role: 'finance-review',
      currency: 'TZS',
      maximum: '1000.50',
    })),
  };
  it('covers all 16 modules and accepts a complete set of operating rules', () => {
    expect(FIN01_MODULES).toHaveLength(16);
    expect(operatingSettingsIssues(settings, ['TZS'], ['1100'])).toEqual([]);
  });
  it.each([
    { numbering: settings.numbering.slice(1) },
    { paymentTerms: settings.paymentTerms.slice(1) },
    {
      termAssignments: [
        { partyId: randomUUID(), party: 'CUSTOMER', termCode: 'INVALID' },
      ],
    },
    {
      paymentMethods: [{ ...settings.paymentMethods[0], accountCode: '9999' }],
    },
    { approvalLimits: [{ ...settings.approvalLimits[0], currency: 'USD' }] },
  ])('reports incomplete controls', (patch) => {
    expect(
      operatingSettingsIssues({ ...settings, ...patch }, ['TZS'], ['1100'])
        .length,
    ).toBeGreaterThan(0);
  });
});
