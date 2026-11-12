import { describe, expect, it } from 'vitest';
import { NAV_NODES, isNavGroupHidden, type NavGroup } from './nav-config';
import type { AuthUser } from '@/types';

const group = NAV_NODES.find(
  (node) => node.kind === 'group' && node.label === 'Product Engine',
) as NavGroup;
const user = (roles: string[]): AuthUser => ({
  id: 'user',
  email: 'user@example.com',
  scope: 'company',
  userType: 'COMPANY_USER',
  roles,
  permissions: [],
});

describe('Product Engine navigation visibility', () => {
  it.each(['UNDERWRITER', 'SHORT_TERM_UNDERWRITER'])(
    'hides the group for %s',
    (role) => {
      expect(isNavGroupHidden(group, user([role]))).toBe(true);
    },
  );

  it('keeps the group available to an administrator who also underwrites', () => {
    expect(
      isNavGroupHidden(group, user(['ADMINISTRATOR', 'UNDERWRITER'])),
    ).toBe(false);
  });

  it('does not hide unrelated users', () => {
    expect(isNavGroupHidden(group, user(['PRODUCT_MANAGER']))).toBe(false);
  });
});
