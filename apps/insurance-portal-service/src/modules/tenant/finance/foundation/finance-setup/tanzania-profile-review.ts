import {
  applicableProfileFields,
  type TanzaniaFinanceProfile,
} from '@insurance-max/contracts';
import { isFinanceDate } from '../finance-configuration/finance-configuration.types';
import { isDemonstrationIdentifier } from './finance-setup-legal';
import {
  setupObject,
  setupText,
  type FinanceSetupInput,
} from './finance-setup.types';

export interface TanzaniaProfileSource {
  profile: TanzaniaFinanceProfile | null;
  address: {
    street?: string;
    city?: string;
    region?: string;
    country?: string;
  } | null;
  mainlandVrn: string | null;
}

export function tanzaniaProfileIssues(
  c: Record<string, any>,
  source: TanzaniaProfileSource,
  input: FinanceSetupInput,
) {
  const p = source.profile ?? {};
  const foreign = p.licensing === 'FOREIGN_ACCREDITATION';
  const localTax = !foreign || p.localTaxRegistration === 'REGISTERED';
  const issues: string[] = [];
  const need = (ok: unknown, message: string) => {
    if (!ok) issues.push(message);
  };
  const evidence = (purpose: string) =>
    need(
      input.evidence.some((e) => e.purpose === purpose),
      'Attach ' + purpose + ' evidence.',
    );
  const identifier = (v: unknown, label: string) =>
    need(
      setupText(v, 100) && !isDemonstrationIdentifier(v),
      'Supply the actual ' + label + '.',
    );
  for (const field of applicableProfileFields(p, c.company_type)) {
    if (
      [
        'licenceConditions',
        'licenceFrom',
        'tradingName',
        'renewalReference',
      ].includes(field.key)
    )
      continue;
    const value = p[field.key];
    need(
      setupText(value, field.max ?? 500) &&
        (!field.options || field.options.includes(value as string)) &&
        (!field.date || isFinanceDate(value)),
      'Complete ' + field.label + '.',
    );
  }
  need(
    c.status === 'active' && setupText(c.name, 120),
    'An active named company is required.',
  );
  need(
    p.registrationStanding === 'ACTIVE',
    'Confirm active registry standing for ordinary business.',
  );
  need(
    isFinanceDate(p.incorporationDate) &&
      !!input.effectiveFrom &&
      p.incorporationDate <= input.effectiveFrom,
    'The company must exist on the setup effective date.',
  );
  evidence('REGISTRATION');
  if (['BRELA', 'BRELA_AND_BPRA'].includes(p.registry ?? ''))
    identifier(c.brela_registration_number, 'BRELA number');
  if (['BPRA', 'BRELA_AND_BPRA'].includes(p.registry ?? '')) {
    identifier(p.bpraNumber, 'BPRA number');
    evidence('BPRA_REGISTRATION');
  }
  if (p.registry === 'OTHER')
    identifier(
      p.otherRegistrationNo,
      'registration number issued by the named authority',
    );
  if (localTax) {
    identifier(c.tin, 'company TIN');
    evidence('TIN');
  }
  if (foreign) {
    need(
      ['REINSURANCE_COMPANY', 'REINSURANCE_BROKER'].includes(c.company_type) &&
        !!p.incorporationCountry &&
        p.incorporationCountry !== 'TZ',
      'Foreign accreditation applies to foreign reinsurers and foreign reinsurance brokers.',
    );
    need(
      p.registry === 'OTHER',
      'Provide the foreign incorporation registry and number.',
    );
    if (!localTax)
      need(
        p.mainlandVat !== 'REGISTERED' && p.zanzibarVat !== 'REGISTERED',
        'A VAT-registered company must supply its local taxpayer registration.',
      );
    for (const purpose of [
      'HOME_LICENCE',
      'HOME_GOOD_STANDING',
      'TAX_APPLICABILITY',
      'TIRA_ACCREDITATION',
    ])
      evidence(purpose);
  }
  const isTanzania = (country?: string | null) =>
    ['TZ', 'TZA', 'TANZANIA', 'UNITED REPUBLIC OF TANZANIA'].includes(
      country?.trim().toUpperCase() ?? '',
    );
  const registeredCountry =
    p.registeredOffice === 'COMPANY_ADDRESS'
      ? source.address?.country
      : p.registeredCountry;
  if (
    p.incorporationCountry === 'TZ' &&
    ['BPRA', 'BRELA_AND_BPRA'].includes(p.registry ?? '')
  )
    need(
      isTanzania(registeredCountry),
      'Verify the Zanzibar registered office against the BPRA evidence.',
    );
  if (p.registeredOffice === 'COMPANY_ADDRESS')
    need(
      setupObject(source.address) &&
        setupText(source.address.street) &&
        setupText(source.address.country) &&
        (!isTanzania(source.address.country) ||
          setupText(source.address.region)),
      'Complete the registered street and country and, for a Tanzanian address, its region.',
    );
  const principalCountry =
    p.principalOffice === 'SAME_AS_REGISTERED'
      ? registeredCountry
      : p.principalCountry;
  if (
    [
      'INSURANCE_COMPANY',
      'REINSURANCE_COMPANY',
      'BROKER',
      'REINSURANCE_BROKER',
    ].includes(c.company_type) &&
    !foreign
  ) {
    need(
      isTanzania(principalCountry),
      'Specify the principal office in Tanzania for this domestic registrant.',
    );
    evidence('ASSOCIATION');
  }
  if (localTax && ['ZANZIBAR', 'BOTH'].includes(p.territory ?? '')) {
    identifier(p.ztn, 'Zanzibar taxpayer number');
    evidence('ZTN');
  }
  if (p.territory !== 'ZANZIBAR' && p.mainlandVat === 'REGISTERED') {
    identifier(source.mainlandVrn, 'Mainland VAT registration number');
    need(
      isFinanceDate(p.mainlandVatFrom) &&
        !!input.effectiveFrom &&
        p.mainlandVatFrom <= input.effectiveFrom,
      'Mainland VAT registration must be effective for the review.',
    );
    evidence('MAINLAND_VAT');
  }
  if (p.territory !== 'MAINLAND' && p.zanzibarVat === 'REGISTERED') {
    identifier(p.zanzibarVatNo, 'Zanzibar VAT registration reference');
    need(
      isFinanceDate(p.zanzibarVatFrom) &&
        !!input.effectiveFrom &&
        p.zanzibarVatFrom <= input.effectiveFrom,
      'Zanzibar VAT registration must be effective for the review.',
    );
    evidence('ZANZIBAR_VAT');
  }
  if (p.licensing === 'OUTSIDE_REGULATED_ACTIVITY') {
    need(
      c.company_type === 'SERVICE_PROVIDER',
      'A regulated market role requires TIRA registration.',
    );
    evidence('LICENCE_APPLICABILITY');
  } else if (p.licensing === 'REGULATED' || foreign) {
    identifier(c.tira_license_number, 'TIRA registration number');
    if (!foreign) evidence('LICENCE');
    need(
      ['VALID', 'ACTIVE', 'LICENSED', 'LICENCED'].includes(
        String(c.tira_license_status).toUpperCase(),
      ),
      'Current TIRA licence status is required.',
    );
    need(
      p.licensedTerritory === 'BOTH' || p.licensedTerritory === p.territory,
      'The authorized territory must cover the operating territory.',
    );
    need(
      isFinanceDate(c.license_issued_at) &&
        !!input.effectiveFrom &&
        c.license_issued_at <= input.effectiveFrom &&
        (!p.licenceFrom ||
          (p.licenceFrom >= c.license_issued_at &&
            p.licenceFrom <= input.effectiveFrom)),
      'The licence must be in force on the setup effective date.',
    );
    const ends =
      !foreign && p.licenceCycle === 'ANNUAL_MAINTENANCE'
        ? [
            p.maintenanceThrough,
            ...(c.license_expires_at ? [c.license_expires_at] : []),
          ]
        : [c.license_expires_at];
    need(
      isFinanceDate(input.effectiveTo) &&
        ends.every(
          (d) =>
            isFinanceDate(d) &&
            Date.parse(d) + 86400000 >= Date.parse(input.effectiveTo!),
        ),
      'Licence or maintenance evidence must cover the entire setup interval.',
    );
    if (!foreign && p.licenceCycle === 'ANNUAL_MAINTENANCE')
      evidence('TIRA_MAINTENANCE');
  }
  return issues;
}
