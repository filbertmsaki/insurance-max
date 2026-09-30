import { NotFoundException } from '@nestjs/common';
import { UnderwriteLine } from '@insurance-max/contracts';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { UnderwriteTransactionsService } from './underwrite-transactions.service';

function makeQueryBuilder(result: Record<string, string> | null) {
  const queryBuilder: Record<string, jest.Mock> = {};
  ['andWhere', 'innerJoin', 'select', 'where'].forEach((method) => {
    queryBuilder[method] = jest.fn(() => queryBuilder);
  });
  queryBuilder.getRawOne = jest.fn().mockResolvedValue(result);
  return queryBuilder;
}

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'user@example.com',
  scope: 'company',
  userType: 'COMPANY_USER',
  sessionId: 'session-1',
  accessTokenId: 'token-1',
  companyId: 'company-1',
  companyMembershipId: 'membership-1',
  roles: ['UNDERWRITER'],
  permissions: ['policies:read'],
} as AuthenticatedUser;

describe('UnderwriteTransactionsService line assertions', () => {
  it('returns 404 for a policy outside the requested line', async () => {
    const policyQuery = makeQueryBuilder(null);
    const dataAccessScopeService = {
      resolve: jest.fn().mockReturnValue({ allowedBranchIds: ['branch-1'] }),
      applyPolicyReadScope: jest.fn(),
    };
    const service = new UnderwriteTransactionsService(
      {} as never,
      {} as never,
      { createQueryBuilder: jest.fn(() => policyQuery) } as never,
      {} as never,
      dataAccessScopeService as never,
    );

    await expect(
      service.assertPolicyInLine(user, UnderwriteLine.FLEET, 'policy-1'),
    ).rejects.toThrow(NotFoundException);
    expect(policyQuery.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('= :line'),
      { line: UnderwriteLine.FLEET },
    );
    expect(dataAccessScopeService.applyPolicyReadScope).toHaveBeenCalledWith(
      policyQuery,
      'policy',
      { allowedBranchIds: ['branch-1'] },
    );
  });

  it('accepts a transaction in the requested line and applies data scope', async () => {
    const transactionQuery = makeQueryBuilder({ id: 'transaction-1' });
    const dataAccessScopeService = {
      resolve: jest.fn().mockReturnValue({ allowedBranchIds: ['branch-1'] }),
      applyPolicyReadScope: jest.fn(),
    };
    const service = new UnderwriteTransactionsService(
      { createQueryBuilder: jest.fn(() => transactionQuery) } as never,
      {} as never,
      {} as never,
      {} as never,
      dataAccessScopeService as never,
    );

    await expect(
      service.assertTransactionInLine(
        user,
        UnderwriteLine.MOTOR,
        'transaction-1',
        'endorsement',
      ),
    ).resolves.toBeUndefined();
    expect(dataAccessScopeService.applyPolicyReadScope).toHaveBeenCalledWith(
      transactionQuery,
      'policy',
      { allowedBranchIds: ['branch-1'] },
    );
  });
});
