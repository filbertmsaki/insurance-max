import {
  isDemonstrationIdentifier,
  setupLegalIdentifiers,
  setupProductCoversInterval,
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
  it('requires the selected product version to cover the entire setup interval', () => {
    const product = {
      is_active: true,
      lifecycle_status: 'ACTIVE',
      current_version_id: 'version',
      version_status: 'PUBLISHED',
      effective_from: '2026-01-01',
      effective_to: '2027-01-01',
    };
    expect(
      setupProductCoversInterval(product, '2026-02-01', '2027-01-01'),
    ).toBe(true);
    expect(
      setupProductCoversInterval(product, '2026-02-01', '2027-02-01'),
    ).toBe(false);
    expect(
      setupProductCoversInterval(product, '2025-12-01', '2026-12-01'),
    ).toBe(false);
    expect(setupProductCoversInterval(product, '2026-02-01', null)).toBe(false);
    expect(
      setupProductCoversInterval(
        { ...product, is_active: false },
        '2026-02-01',
        '2027-01-01',
      ),
    ).toBe(false);
  });
});
