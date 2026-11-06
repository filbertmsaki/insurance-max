import { withPricingPermissionAliases } from './001-initial-rbac.seed';

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
