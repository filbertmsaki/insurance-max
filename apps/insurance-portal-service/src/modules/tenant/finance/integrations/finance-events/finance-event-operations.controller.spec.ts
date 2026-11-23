import { ForbiddenException } from '@nestjs/common';
import { PERMISSIONS_KEY } from '@insurance-max/portal-shared/decorators/permissions.decorator';

import { FinancePermissions } from '../../governance/finance-permissions/finance.permissions';
import { FinanceEventOperationsController } from './finance-event-operations.controller';

describe('FinanceEventOperationsController authorization', () => {
  const user = { id: 'user-1', companyId: 'company-1' } as never;
  const operations = {
    summary: jest.fn().mockResolvedValue('summary'),
    list: jest.fn().mockResolvedValue('list'),
    listReplays: jest.fn(),
    detail: jest.fn(),
    requestReplay: jest.fn().mockResolvedValue('requested'),
    decideReplay: jest.fn().mockResolvedValue('decided'),
    executeReplay: jest.fn(),
    cancelReplay: jest.fn(),
  };
  const resolve = jest.fn();
  const controller = new FinanceEventOperationsController(
    operations as never,
    { resolve } as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['summary', FinancePermissions.FINANCE_EVENTS_READ],
    ['list', FinancePermissions.FINANCE_EVENTS_READ],
    ['replays', FinancePermissions.FINANCE_EVENTS_READ],
    ['detail', FinancePermissions.FINANCE_EVENTS_READ],
    ['requestReplay', FinancePermissions.FINANCE_EVENTS_REPLAY_REQUEST],
    ['cancel', FinancePermissions.FINANCE_EVENTS_REPLAY_REQUEST],
    ['decide', FinancePermissions.FINANCE_EVENTS_REPLAY_APPROVE],
    ['execute', FinancePermissions.FINANCE_EVENTS_REPLAY_APPROVE],
  ])('%s requires %s', (method, permission) => {
    const handler = (FinanceEventOperationsController.prototype as any)[method];
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([permission]);
  });

  it.each([
    [{ canViewAllBranches: false, ownRecordsOnly: false }],
    [{ canViewAllBranches: true, ownRecordsOnly: true }],
  ])('rejects users without company-wide scope (%o)', async (scope) => {
    resolve.mockReturnValue(scope);
    expect(() => controller.summary(user)).toThrow(ForbiddenException);
    expect(() =>
      controller.requestReplay(user, 'event-1', {
        reason: 'long enough reason',
      }),
    ).toThrow(ForbiddenException);
    expect(operations.summary).not.toHaveBeenCalled();
    expect(operations.requestReplay).not.toHaveBeenCalled();
  });

  it('scopes every call to the caller company and identity', async () => {
    resolve.mockReturnValue({
      canViewAllBranches: true,
      ownRecordsOnly: false,
    });
    await controller.list(user, 'DEAD_LETTER', undefined, '2', '10');
    expect(operations.list).toHaveBeenCalledWith('company-1', {
      status: 'DEAD_LETTER',
      eventType: undefined,
      page: 2,
      pageSize: 10,
    });
    await controller.decide(user, 'request-1', { decision: 'APPROVE' });
    expect(operations.decideReplay).toHaveBeenCalledWith(
      'company-1',
      'user-1',
      'request-1',
      'APPROVE',
      undefined,
    );
    expect(resolve).toHaveBeenCalledWith(
      user,
      FinancePermissions.FINANCE_EVENTS_REPLAY_APPROVE,
    );
  });

  it('rejects a user with no company', () => {
    resolve.mockReturnValue({
      canViewAllBranches: true,
      ownRecordsOnly: false,
    });
    expect(() => controller.summary({ id: 'u' } as never)).toThrow(
      ForbiddenException,
    );
  });
});
