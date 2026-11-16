import { setupObject } from './finance-setup.types';

const clean = (v: unknown) => (typeof v === 'string' ? v : null);

/** Adapter of source legal facts, never a generator of licence or tax identifiers. */
export function setupLegalIdentifiers(
  company: Record<string, unknown>,
  jurisdiction: string,
) {
  if (jurisdiction === 'TZ')
    return {
      regulator: 'TIRA',
      licenceNumber: clean(company.tira_license_number),
      taxIdentifier: clean(company.tin),
      registrationNumber: clean(company.brela_registration_number),
      licenceStatus: clean(company.tira_license_status),
      issuedOn: clean(company.license_issued_at),
      expiresOn: clean(company.license_expires_at),
    };
  const evidence = company.finance_legal_evidence;
  if (
    setupObject(evidence) &&
    evidence.schema === 'FINANCE_LEGAL_IDENTIFIERS_V1' &&
    evidence.jurisdictionCode === jurisdiction
  )
    return {
      regulator: clean(evidence.regulator),
      licenceNumber: clean(evidence.licenceNumber),
      taxIdentifier: clean(evidence.taxIdentifier),
      registrationNumber: clean(evidence.registrationNumber),
      licenceStatus: clean(evidence.licenceStatus),
      issuedOn: clean(evidence.issuedOn),
      expiresOn: clean(evidence.expiresOn),
    };
  return {
    regulator: null,
    licenceNumber: null,
    taxIdentifier: null,
    registrationNumber: null,
    licenceStatus: null,
    issuedOn: null,
    expiresOn: null,
  };
}
export const isDemonstrationIdentifier = (value: unknown) =>
  typeof value === 'string' &&
  /(^|[^A-Z])(DEMO|DEMONSTRATION|SYNTHETIC|TEST|PLACEHOLDER|PENDING)([^A-Z]|$)|NOT[-_ ]VALID/i.test(
    value,
  );
