import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import {
  adminRoleForCompanyType,
  isRoleAllowedForCompanyType,
  isSystemRole,
} from './access-rules';

describe('access rules', () => {
  it.each([
    [CompanyType.INSURANCE_COMPANY, 'INSURANCE_ADMIN'],
    [CompanyType.REINSURANCE_COMPANY, 'REINSURANCE_ADMIN'],
    [CompanyType.REINSURANCE_BROKER, 'ADMINISTRATOR'],
    [CompanyType.BROKER, 'BROKER_ADMIN'],
    [CompanyType.AGENCY, 'AGENCY_ADMIN'],
    [CompanyType.BANCASSURANCE, 'BANCASSURANCE_ADMIN'],
    [CompanyType.SERVICE_PROVIDER, 'SERVICE_PROVIDER_ADMIN'],
  ])('maps %s to %s', (type, role) => {
    expect(adminRoleForCompanyType(type)).toBe(role);
  });

  it('allows only the matching administrator role', () => {
    expect(
      isRoleAllowedForCompanyType(
        'INSURANCE_ADMIN',
        CompanyType.INSURANCE_COMPANY,
      ),
    ).toBe(true);
    expect(
      isRoleAllowedForCompanyType(
        'BROKER_ADMIN',
        CompanyType.INSURANCE_COMPANY,
      ),
    ).toBe(false);
    expect(
      isRoleAllowedForCompanyType(
        'ADMINISTRATOR',
        CompanyType.INSURANCE_COMPANY,
      ),
    ).toBe(false);
  });

  it('does not restrict non-administrator roles', () => {
    expect(isRoleAllowedForCompanyType('UNDERWRITER', CompanyType.BROKER)).toBe(
      true,
    );
  });

  it('recognises portal system roles', () => {
    expect(isSystemRole('INTERMEDIARY_PORTAL')).toBe(true);
    expect(isSystemRole('PORTAL_ADMIN')).toBe(false);
  });
});
