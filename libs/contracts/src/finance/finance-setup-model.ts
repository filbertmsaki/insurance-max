import { PaymentMethod } from './finance.enums';

/** The company master supplies name, TIN, BRELA number, licence dates, office address and Mainland VRN. */
export interface ProfileField {
  key: string;
  label: string;
  group: string;
  options?: readonly string[];
  date?: boolean;
  max?: number;
}

export const TANZANIA_PROFILE_FIELDS: readonly ProfileField[] = [
  {
    key: 'tradingName',
    label: 'Registered trading name, if used',
    group: 'Company registration',
  },
  {
    key: 'registrationStanding',
    label: 'Standing shown by the company registry',
    options: ['ACTIVE', 'IN_LIQUIDATION', 'DISSOLVED', 'STRUCK_OFF', 'OTHER'],
    group: 'Company registration',
  },
  {
    key: 'legalForm',
    label: 'Legal form as registered',
    group: 'Company registration',
  },
  {
    key: 'incorporationCountry',
    label: 'Country of incorporation (two-letter code)',
    max: 2,
    group: 'Company registration',
  },
  {
    key: 'incorporationDate',
    label: 'Incorporation or formation date',
    date: true,
    group: 'Company registration',
  },
  {
    key: 'activities',
    label: 'Principal business activities',
    group: 'Company registration',
  },
  {
    key: 'registry',
    label: 'Issuing company registry',
    options: ['BRELA', 'BPRA', 'BRELA_AND_BPRA', 'OTHER'],
    group: 'Company registration',
  },
  {
    key: 'bpraNumber',
    label: 'BPRA registration number',
    group: 'Company registration',
  },
  {
    key: 'otherRegistry',
    label: 'Other registration authority',
    group: 'Company registration',
  },
  {
    key: 'otherRegistrationNo',
    label: 'Other registration number',
    group: 'Company registration',
  },
  {
    key: 'registeredOffice',
    label: 'Registered office address',
    options: ['COMPANY_ADDRESS', 'SEPARATE_ADDRESS'],
    group: 'Offices',
  },
  {
    key: 'registeredAddress',
    label: 'Registered office street, locality, region and country',
    group: 'Offices',
  },
  {
    key: 'principalOffice',
    label: 'Principal office',
    options: ['SAME_AS_REGISTERED', 'SEPARATE_ADDRESS'],
    group: 'Offices',
  },
  {
    key: 'principalAddress',
    label: 'Principal office street, locality and region',
    group: 'Offices',
  },
  {
    key: 'principalCountry',
    label: 'Principal office country (two-letter code)',
    max: 2,
    group: 'Offices',
  },
  {
    key: 'registeredCountry',
    label: 'Registered office country (two-letter code)',
    max: 2,
    group: 'Offices',
  },
  {
    key: 'territory',
    label: 'Operating territory',
    options: ['MAINLAND', 'ZANZIBAR', 'BOTH'],
    group: 'Tax registrations',
  },
  {
    key: 'ztn',
    label: 'Zanzibar taxpayer number (ZTN)',
    group: 'Tax registrations',
  },
  {
    key: 'mainlandVat',
    label: 'Mainland VAT registration',
    options: ['REGISTERED', 'NOT_REGISTERED'],
    group: 'Tax registrations',
  },
  {
    key: 'mainlandVatFrom',
    label: 'Mainland VAT effective date',
    date: true,
    group: 'Tax registrations',
  },
  {
    key: 'zanzibarVat',
    label: 'Zanzibar VAT registration',
    options: ['REGISTERED', 'NOT_REGISTERED'],
    group: 'Tax registrations',
  },
  {
    key: 'zanzibarVatNo',
    label: 'Zanzibar VAT registration reference as issued',
    group: 'Tax registrations',
  },
  {
    key: 'zanzibarVatFrom',
    label: 'Zanzibar VAT effective date',
    date: true,
    group: 'Tax registrations',
  },
  {
    key: 'licensing',
    label: 'TIRA registration applicability',
    options: [
      'REGULATED',
      'FOREIGN_ACCREDITATION',
      'OUTSIDE_REGULATED_ACTIVITY',
    ],
    group: 'Insurance registration',
  },
  {
    key: 'licenceBasis',
    label: 'Basis for operating outside regulated activity',
    group: 'Insurance registration',
  },
  {
    key: 'localTaxRegistration',
    label: 'Tanzania taxpayer registration for the accredited entity',
    options: ['REGISTERED', 'ASSESSED_NO_LOCAL_REGISTRATION'],
    group: 'Tax registrations',
  },
  {
    key: 'licenceFrom',
    label: 'Licence effective date if different from issue date',
    date: true,
    group: 'Insurance registration',
  },
  {
    key: 'licenceCycle',
    label: 'TIRA registration cycle',
    options: ['RENEWAL', 'ANNUAL_MAINTENANCE'],
    group: 'Insurance registration',
  },
  {
    key: 'maintenanceThrough',
    label: 'Annual maintenance confirmed through',
    date: true,
    group: 'Insurance registration',
  },
  {
    key: 'maintenanceRef',
    label: 'Annual maintenance confirmation reference',
    group: 'Insurance registration',
  },
  {
    key: 'licensedClasses',
    label: 'Classes or activities authorized on the certificate',
    group: 'Insurance registration',
  },
  {
    key: 'licensedTerritory',
    label: 'Territory authorized on the certificate',
    options: ['MAINLAND', 'ZANZIBAR', 'BOTH'],
    group: 'Insurance registration',
  },
  {
    key: 'licenceConditions',
    label: 'Conditions on the certificate, if any',
    group: 'Insurance registration',
  },
  {
    key: 'renewalReference',
    label: 'Certificate renewal reference, if separately issued',
    group: 'Insurance registration',
  },
];
export type TanzaniaFinanceProfile = Record<string, string | null>;

export function applicableProfileFields(
  p: TanzaniaFinanceProfile,
  companyType?: string,
) {
  const mainland = p.territory === 'MAINLAND' || p.territory === 'BOTH';
  const zanzibar = p.territory === 'ZANZIBAR' || p.territory === 'BOTH';
  const foreign = p.licensing === 'FOREIGN_ACCREDITATION';
  const regulated = p.licensing === 'REGULATED' || foreign;
  const localTax = !foreign || p.localTaxRegistration === 'REGISTERED';
  const principal =
    !foreign &&
    [
      'INSURANCE_COMPANY',
      'REINSURANCE_COMPANY',
      'BROKER',
      'REINSURANCE_BROKER',
    ].includes(companyType ?? '');
  const conditions: Record<string, boolean> = {
    bpraNumber: p.registry === 'BPRA' || p.registry === 'BRELA_AND_BPRA',
    otherRegistry: p.registry === 'OTHER',
    otherRegistrationNo: p.registry === 'OTHER',
    registeredAddress: p.registeredOffice === 'SEPARATE_ADDRESS',
    registeredCountry: p.registeredOffice === 'SEPARATE_ADDRESS',
    principalOffice: principal,
    principalCountry: principal && p.principalOffice === 'SEPARATE_ADDRESS',
    principalAddress: principal && p.principalOffice === 'SEPARATE_ADDRESS',
    localTaxRegistration: foreign,
    ztn: zanzibar && localTax,
    mainlandVat: mainland,
    mainlandVatFrom: mainland && p.mainlandVat === 'REGISTERED',
    zanzibarVat: zanzibar,
    zanzibarVatNo: zanzibar && p.zanzibarVat === 'REGISTERED',
    zanzibarVatFrom: zanzibar && p.zanzibarVat === 'REGISTERED',
    licenceBasis: p.licensing === 'OUTSIDE_REGULATED_ACTIVITY',
    licenceFrom: regulated,
    licenceCycle: regulated && !foreign,
    licensedClasses: regulated,
    licensedTerritory: regulated,
    licenceConditions: regulated,
    maintenanceThrough:
      !foreign && regulated && p.licenceCycle === 'ANNUAL_MAINTENANCE',
    maintenanceRef:
      !foreign && regulated && p.licenceCycle === 'ANNUAL_MAINTENANCE',
    renewalReference: !foreign && regulated && p.licenceCycle === 'RENEWAL',
  };
  return TANZANIA_PROFILE_FIELDS.filter((f) => conditions[f.key] !== false);
}

export const FINANCE_DOCUMENT_TYPES = [
  'INVOICE',
  'RECEIPT',
  'PAYMENT_TRANSACTION',
  'REFUND',
  'COMMISSION_ACCRUAL',
  'COMMISSION_PAYMENT',
  'JOURNAL',
  'RECONCILIATION',
  'FINANCIAL_REVERSAL',
] as const;
export type FinanceDocumentType = (typeof FINANCE_DOCUMENT_TYPES)[number];
export const FINANCE_METHOD_CODES = Object.values(PaymentMethod);
export const FIN01_MODULES = [
  ['FIN-01.01', 'Company financial profile', 'G04-01'],
  ['FIN-01.02', 'Accounting configuration', 'G04-03', 'G04-08'],
  ['FIN-01.03', 'Financial books', 'G04-03'],
  ['FIN-01.04', 'Currency management', 'G04-03', 'G04-07'],
  ['FIN-01.05', 'Exchange rates', 'G04-03', 'G04-07'],
  ['FIN-01.06', 'Financial year', 'G04-04'],
  ['FIN-01.07', 'Accounting periods', 'G04-04'],
  ['FIN-01.08', 'Chart of accounts', 'G04-06'],
  ['FIN-01.09', 'Financial dimensions', 'G04-06'],
  ['FIN-01.10', 'Document numbering', 'G04-07'],
  ['FIN-01.11', 'Payment terms', 'G04-07'],
  ['FIN-01.12', 'Payment methods', 'G04-07'],
  ['FIN-01.13', 'Approval configuration', 'G04-02', 'G04-07'],
  ['FIN-01.14', 'Posting rules', 'G04-06', 'G04-07', 'G04-08'],
  ['FIN-01.15', 'Opening balances', 'G04-05', 'G04-09'],
  ['FIN-01.16', 'Configuration validation', 'G04-10'],
] as const;
