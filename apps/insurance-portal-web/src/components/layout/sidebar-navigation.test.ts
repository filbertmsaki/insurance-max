import { describe, expect, it } from 'vitest';
import { isNavLinkActive } from './sidebar-navigation';
describe('sidebar tab navigation', () => {
  it('highlights only the selected transaction tab, allowing pagination filters', () => {
    expect(
      isNavLinkActive(
        '/apps/motor/transactions',
        '?tab=renewals&page=2',
        '/apps/motor/transactions?tab=renewals',
      ),
    ).toBe(true);
    expect(
      isNavLinkActive(
        '/apps/motor/transactions',
        '?tab=renewals',
        '/apps/motor/transactions?tab=endorsements',
      ),
    ).toBe(false);
  });
  it('preserves normal list and detail matching', () => {
    expect(
      isNavLinkActive('/apps/motor/policies/p-1', '', '/apps/motor/policies'),
    ).toBe(true);
    expect(
      isNavLinkActive('/apps/motor/policies-other', '', '/apps/motor/policies'),
    ).toBe(false);
  });
});
