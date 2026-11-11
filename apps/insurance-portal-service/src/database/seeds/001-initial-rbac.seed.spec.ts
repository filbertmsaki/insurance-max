import {
  withCustomerAuditPermission,
  withPricingPermissionAliases,
} from './001-initial-rbac.seed';

describe('customer audit permission assignments', () => {
  it.each([
    'ADMINISTRATOR',
    'INSURANCE_ADMIN',
    'REINSURANCE_ADMIN',
    'BROKER_ADMIN',
    'AGENCY_ADMIN',
    'BANCASSURANCE_ADMIN',
    'PORTAL_ADMIN',
    'UNDERWRITER',
  ])('grants audit history to %s', (role) =>
    expect(withCustomerAuditPermission(role, ['customers:read'])).toContain(
      'customers:audit-history:read',
    ),
  );
  it.each(['USER', 'VIEWER', 'CLAIMS_OFFICER', 'CLAIMS_MANAGER'])(
    'does not add audit history to %s',
    (role) =>
      expect(
        withCustomerAuditPermission(role, ['customers:read']),
      ).not.toContain('customers:audit-history:read'),
  );
});

describe('quotation seed permission expansion', () => {
  it('does not grant approval authority merely because a role can edit quotations', () => {
    const expanded = withPricingPermissionAliases(['quotations:update']);
    expect(expanded).toContain('quotations:complete');
    expect(expanded).toContain('quotations:submit-approval');
    expect(expanded).not.toEqual(
      expect.arrayContaining([
        'quotations:approve',
        'quotations:approve-high-risk',
        'quotations:reject',
        'quotations:request-changes',
        'quotation-approvals:assign',
        'quotation-requirements:waive',
      ]),
    );
    for (const permission of [
      'quotations:approve',
      'quotations:approve-high-risk',
      'quotations:reject',
      'quotations:request-changes',
      'quotation-approvals:assign',
      'quotation-requirements:waive',
    ])
      expect(expanded).not.toContain(permission);
  });

  it('retains explicitly assigned approval permissions', () => {
    expect(withPricingPermissionAliases(['quotations:approve'])).toContain(
      'quotations:approve',
    );
  });
});
