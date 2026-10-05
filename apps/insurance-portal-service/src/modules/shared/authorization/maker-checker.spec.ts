import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { canSelfApprove, SELF_APPROVE_PERMISSION } from './maker-checker';

describe('canSelfApprove', () => {
  const user = (permissions: string[]) =>
    ({ id: 'user-1', permissions }) as unknown as AuthenticatedUser;

  it('requires the self-approve permission', () => {
    expect(canSelfApprove(user([SELF_APPROVE_PERMISSION]))).toBe(true);
    expect(canSelfApprove(user(['cancellations:approve']))).toBe(false);
  });

  it('does not exempt by admin role alone', () => {
    expect(
      canSelfApprove({
        ...user([]),
        roles: ['ADMINISTRATOR'],
      }),
    ).toBe(false);
  });
});
