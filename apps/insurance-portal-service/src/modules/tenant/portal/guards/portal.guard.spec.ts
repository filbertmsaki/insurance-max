import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { PortalAccountStatus, PortalActorType } from '../enums/portal.enums';
import { PortalPermissions } from '../portal.permissions';
import { PortalAccountsService } from '../services/portal-accounts.service';
import { PortalGuard } from './portal.guard';

describe('PortalGuard', () => {
  let guard: PortalGuard;
  let reflector: jest.Mocked<Reflector>;
  let accountsService: { findActiveForUser: jest.Mock };

  const createContext = (user?: Record<string, unknown>) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn(() => ({
        getRequest: jest.fn(() => ({ user })),
      })),
    }) as unknown as ExecutionContext;

  beforeEach(async () => {
    accountsService = { findActiveForUser: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortalGuard,
        {
          provide: Reflector,
          useValue: { getAllAndOverride: jest.fn() },
        },
        { provide: PortalAccountsService, useValue: accountsService },
      ],
    }).compile();

    guard = module.get(PortalGuard);
    reflector = module.get(Reflector);
  });

  it('rejects an endpoint missing @PortalActors()', async () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(undefined);

    await expect(
      guard.canActivate(
        createContext({ id: 'user-id', companyId: 'company-id' }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects a request without authenticated company context', async () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValue([PortalActorType.CUSTOMER]);

    await expect(
      guard.canActivate(createContext({ id: 'user-id', companyId: null })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('loads an active customer portal account', async () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValue([PortalActorType.CUSTOMER]);

    accountsService.findActiveForUser.mockResolvedValue({
      id: 'account-id',
      actor_type: PortalActorType.CUSTOMER,
      status: PortalAccountStatus.ACTIVE,
    });

    const context = createContext({
      id: 'user-id',
      companyId: 'company-id',
      permissions: [PortalPermissions.CUSTOMER_ACCESS],
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(accountsService.findActiveForUser).toHaveBeenCalledWith(
      'user-id',
      'company-id',
      [PortalActorType.CUSTOMER],
    );
  });

  it('rejects a portal account when its portal permission is missing', async () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValue([PortalActorType.CUSTOMER]);

    accountsService.findActiveForUser.mockResolvedValue({
      id: 'account-id',
      actor_type: PortalActorType.CUSTOMER,
      status: PortalAccountStatus.ACTIVE,
    });

    await expect(
      guard.canActivate(
        createContext({
          id: 'user-id',
          companyId: 'company-id',
          permissions: [],
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('requires the intermediary permission for intermediary accounts', async () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValue([PortalActorType.INTERMEDIARY]);

    accountsService.findActiveForUser.mockResolvedValue({
      id: 'account-id',
      actor_type: PortalActorType.INTERMEDIARY,
      status: PortalAccountStatus.ACTIVE,
    });

    await expect(
      guard.canActivate(
        createContext({
          id: 'user-id',
          companyId: 'company-id',
          permissions: [PortalPermissions.CUSTOMER_ACCESS],
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
