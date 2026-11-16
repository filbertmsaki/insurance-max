import {
  isDemonstrationIdentifier,
  setupLegalIdentifiers,
} from './finance-setup-legal';

describe('Finance setup legal evidence', () => {
  it('leaves absent source legal identifiers unresolved', () => {
    expect(
      setupLegalIdentifiers({ verification_status: 'VERIFIED' }, 'TZ'),
    ).toMatchObject({
      regulator: 'TIRA',
      licenceNumber: null,
      taxIdentifier: null,
      registrationNumber: null,
    });
  });
  it('uses jurisdiction-matched source evidence outside Tanzania', () => {
    const company = {
      finance_legal_evidence: {
        schema: 'FINANCE_LEGAL_IDENTIFIERS_V1',
        jurisdictionCode: 'KE',
        regulator: 'IRA',
        licenceNumber: 'SAMPLE-001',
      },
    };
    expect(setupLegalIdentifiers(company, 'KE').licenceNumber).toBe(
      'SAMPLE-001',
    );
    expect(setupLegalIdentifiers(company, 'UG').licenceNumber).toBeNull();
  });
  it.each([
    'DEMO-TIRA-001',
    'SYNTHETIC-001',
    'NOT-VALID',
    'TEST_TIN',
    'PENDING',
  ])('detects demonstration identifiers: %s', (value) => {
    expect(isDemonstrationIdentifier(value)).toBe(true);
  });
  it('does not treat an arbitrary identifier as verified evidence', () => {
    expect(isDemonstrationIdentifier('LIC-123456')).toBe(false);
    expect(setupLegalIdentifiers({}, 'TZ').licenceNumber).toBeNull();
  });
});
