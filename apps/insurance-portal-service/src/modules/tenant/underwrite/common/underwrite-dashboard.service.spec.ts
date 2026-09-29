import { UnderwriteAction, UnderwriteLine } from '@insurance-max/contracts';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { UnderwriteDashboardService } from './underwrite-dashboard.service';

function makeQueryBuilder(rawOne: Record<string, string> = { total: '0' }) {
  const queryBuilder: Record<string, jest.Mock> = {};
  [
    'addGroupBy',
    'addSelect',
    'andWhere',
    'groupBy',
    'innerJoin',
    'leftJoin',
    'orderBy',
    'select',
    'setParameters',
    'where',
  ].forEach((method) => {
    queryBuilder[method] = jest.fn(() => queryBuilder);
  });
  queryBuilder.getRawMany = jest.fn().mockResolvedValue([]);
  queryBuilder.getRawOne = jest.fn().mockResolvedValue(rawOne);
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
  permissions: [
    'renewals:read',
    'endorsements:create',
    'cancellations:read',
    'quotations:retry-tiramis',
    `underwrite.motor.${UnderwriteAction.RENEWALS_VIEW}`,
    `underwrite.motor.${UnderwriteAction.ENDORSEMENTS_VIEW}`,
    `underwrite.motor.${UnderwriteAction.CANCELLATIONS_VIEW}`,
    `underwrite.motor.${UnderwriteAction.TIRA_RETRY}`,
  ],
} as AuthenticatedUser;

describe('UnderwriteDashboardService', () => {
  it('returns transaction counts using the branch-scoped policy filters', async () => {
    const scope = { allowedBranchIds: ['branch-1'] };
    const renewalQuery = makeQueryBuilder({ total: '2' });
    const endorsementQuery = makeQueryBuilder({ total: '3' });
    const cancellationQuery = makeQueryBuilder({ total: '4' });
    const pendingTransactionQuery = makeQueryBuilder({ total: '5' });
    const pendingQuotationQuery = makeQueryBuilder({ total: '6' });
    const dataAccessScopeService = {
      resolve: jest.fn().mockReturnValue(scope),
      applyPolicyReadScope: jest.fn(),
      applyQuotationReadScope: jest.fn(),
    };
    const service = new UnderwriteDashboardService(
      dataAccessScopeService as never,
      { createQueryBuilder: jest.fn(() => pendingQuotationQuery) } as never,
      { createQueryBuilder: jest.fn() } as never,
      {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(endorsementQuery)
          .mockReturnValueOnce(cancellationQuery)
          .mockReturnValueOnce(pendingTransactionQuery),
      } as never,
      { createQueryBuilder: jest.fn(() => renewalQuery) } as never,
    );

    const summary = await service.getLineSummary(user, UnderwriteLine.MOTOR);

    expect(summary.transactions).toEqual({
      renewals: 2,
      endorsements: 3,
      cancellations: 4,
      tira_pending: 11,
    });
    expect(summary.quotations).toBeNull();
    expect(summary.policies).toBeNull();
    expect(dataAccessScopeService.applyPolicyReadScope).toHaveBeenCalledTimes(
      4,
    );
    expect(dataAccessScopeService.applyPolicyReadScope).toHaveBeenCalledWith(
      renewalQuery,
      'policy',
      scope,
    );
    expect(dataAccessScopeService.applyQuotationReadScope).toHaveBeenCalledWith(
      pendingQuotationQuery,
      'quotation',
      scope,
    );
  });

  it('hides transaction counts when the user only has the line gate', async () => {
    const transactionRepository = { createQueryBuilder: jest.fn() };
    const renewalRepository = { createQueryBuilder: jest.fn() };
    const service = new UnderwriteDashboardService(
      {
        resolve: jest.fn(),
        applyPolicyReadScope: jest.fn(),
        applyQuotationReadScope: jest.fn(),
      } as never,
      { createQueryBuilder: jest.fn() } as never,
      { createQueryBuilder: jest.fn() } as never,
      transactionRepository as never,
      renewalRepository as never,
    );

    const summary = await service.getLineSummary(
      {
        ...user,
        permissions: [`underwrite.motor.${UnderwriteAction.RENEWALS_VIEW}`],
      },
      UnderwriteLine.MOTOR,
    );

    expect(summary.transactions).toBeNull();
    expect(transactionRepository.createQueryBuilder).not.toHaveBeenCalled();
    expect(renewalRepository.createQueryBuilder).not.toHaveBeenCalled();
  });
});
