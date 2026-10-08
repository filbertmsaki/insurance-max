import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { PermissionsService } from './permissions.service';

const platformOwner = {
  id: 'owner-1',
  scope: 'platform',
  userType: 'OWNER',
  roles: ['OWNER'],
  permissions: [],
} as any;

const superAdmin = {
  id: 'super-1',
  scope: 'platform',
  userType: 'SUPER_ADMIN',
  roles: ['SUPER_ADMIN'],
  permissions: [],
} as any;

function companyActor(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    scope: 'company',
    userType: 'COMPANY_ADMIN',
    companyId: 'company-1',
    companyMembershipId: 'membership-1',
    roles: ['COMPANY_ADMIN'],
    permissions: ['permissions.update'],
    ...overrides,
  } as any;
}

function makePermission(overrides: Record<string, unknown> = {}) {
  return {
    id: 'perm-1',
    name: 'claims.view',
    display_name: 'View claims',
    description: null,
    assignment_scope: 'shared',
    assignable_to_company_role: true,
    assignable_to_platform_role: true,
    is_deprecated: false,
    is_system_generated: false,
    ...overrides,
  } as any;
}

function makeHarness(
  params: {
    permission?: any;
    assignedCount?: number;
    saveError?: Error;
  } = {},
) {
  const permission =
    params.permission === undefined ? makePermission() : params.permission;

  const repo = {
    findOne: jest.fn(async () => permission),
    create: jest.fn((value: any) => ({ ...value })),
    save: jest.fn(async (value: any) => {
      if (params.saveError) {
        throw params.saveError;
      }
      return { id: value.id ?? 'perm-new', ...value };
    }),
    remove: jest.fn(async (value: any) => value),
  };

  const manager = {
    getRepository: (entity: any) => {
      switch (entity?.name) {
        case 'Permission':
          return repo;
        default:
          throw new Error(`Unexpected entity ${entity?.name}`);
      }
    },
    query: jest.fn(async () => [{ count: String(params.assignedCount ?? 0) }]),
  };

  const dataSource = {
    transaction: jest.fn().mockImplementation(async (fn: any) => fn(manager)),
  } as any;

  const query: any = {};
  for (const method of ['where', 'andWhere', 'orderBy']) {
    query[method] = jest.fn(() => query);
  }
  query.getOne = jest.fn(async () => permission);
  query.getMany = jest.fn(async () => (permission ? [permission] : []));

  const permissionsRepository = {
    createQueryBuilder: jest.fn(() => query),
  } as any;

  const auditService = {
    logCritical: jest.fn().mockResolvedValue(undefined),
  } as any;
  const authorizationVersionService = {
    bumpForPermission: jest.fn().mockResolvedValue(undefined),
  } as any;

  const service = new PermissionsService(
    permissionsRepository,
    dataSource,
    auditService,
    authorizationVersionService,
  );

  return {
    service,
    repo,
    manager,
    query,
    dataSource,
    auditService,
    authorizationVersionService,
  };
}

const createDto = {
  name: 'claims.reopen',
  display_name: 'Reopen claims',
  assignment_scope: 'tenant',
  assignable_to_company_role: true,
  assignable_to_platform_role: false,
} as any;

describe('PermissionsService', () => {
  describe('create', () => {
    it.each([
      ['a company admin', companyActor()],
      ['a super admin', superAdmin],
      ['an anonymous caller', undefined],
    ])('forbids %s from creating permissions', async (_label, actor) => {
      const h = makeHarness();

      await expect(h.service.create(createDto, actor)).rejects.toThrow(
        ForbiddenException,
      );
      expect(h.dataSource.transaction).not.toHaveBeenCalled();
    });

    it('lets the owner create permissions but never as system-generated', async () => {
      const h = makeHarness();

      const saved = await h.service.create(
        { ...createDto, is_system_generated: true },
        platformOwner,
      );

      expect(saved.is_system_generated).toBe(false);
      expect(h.auditService.logCritical).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'permission.created' }),
        h.manager,
      );
    });

    it('maps duplicate names to a conflict', async () => {
      const h = makeHarness({
        saveError: new QueryFailedError('INSERT', [], {
          code: '23505',
        } as any),
      });

      await expect(h.service.create(createDto, platformOwner)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it.each([
      ['a company admin', companyActor()],
      ['a super admin', superAdmin],
    ])('forbids %s from changing the catalog', async (_label, actor) => {
      const h = makeHarness();

      await expect(
        h.service.update(
          'perm-1',
          { assignable_to_company_role: true } as any,
          actor,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(h.dataSource.transaction).not.toHaveBeenCalled();
      expect(h.repo.save).not.toHaveBeenCalled();
    });

    it('throws when the permission does not exist', async () => {
      const h = makeHarness({ permission: null });

      await expect(
        h.service.update('perm-x', { display_name: 'X' } as any, platformOwner),
      ).rejects.toThrow(NotFoundException);
    });

    it('applies owner changes, bumps authorization and audits before/after', async () => {
      const h = makeHarness({
        permission: makePermission({ is_system_generated: true }),
      });

      const saved = await h.service.update(
        'perm-1',
        {
          assignment_scope: 'platform',
          assignable_to_company_role: false,
        } as any,
        platformOwner,
      );

      expect(saved.assignment_scope).toBe('platform');
      expect(saved.assignable_to_company_role).toBe(false);
      expect(saved.name).toBe('claims.view');
      expect(
        h.authorizationVersionService.bumpForPermission,
      ).toHaveBeenCalledWith('perm-1', h.manager);
      expect(h.auditService.logCritical).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'permission.updated',
          beforeState: expect.objectContaining({
            assignment_scope: 'shared',
            assignable_to_company_role: true,
          }),
        }),
        h.manager,
      );
    });

    it('forbids a company-scoped actor holding a tenant role named OWNER', async () => {
      const h = makeHarness();

      await expect(
        h.service.update(
          'perm-1',
          { assignable_to_company_role: true } as any,
          companyActor({ roles: ['COMPANY_ADMIN', 'OWNER'] }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('forbids non-owners from deleting permissions', async () => {
      const h = makeHarness();

      await expect(h.service.remove('perm-1', companyActor())).rejects.toThrow(
        ForbiddenException,
      );
      expect(h.repo.remove).not.toHaveBeenCalled();
    });

    it('refuses to delete an assigned permission', async () => {
      const h = makeHarness({ assignedCount: 3 });

      await expect(h.service.remove('perm-1', platformOwner)).rejects.toThrow(
        ConflictException,
      );
      expect(h.repo.remove).not.toHaveBeenCalled();
    });

    it('deletes an unassigned permission and audits it', async () => {
      const h = makeHarness();

      await h.service.remove('perm-1', platformOwner);

      expect(h.manager.query).toHaveBeenCalledWith(expect.any(String), [
        'perm-1',
      ]);
      expect(h.repo.remove).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'perm-1' }),
      );
      expect(h.auditService.logCritical).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'permission.deleted' }),
        h.manager,
      );
    });
  });

  describe('read visibility', () => {
    it('restricts company users to assignable tenant/shared permissions', async () => {
      const h = makeHarness();

      await h.service.findOne('perm-1', companyActor());

      expect(h.query.andWhere).toHaveBeenCalledWith(
        'permission.is_deprecated = false',
      );
      expect(h.query.andWhere).toHaveBeenCalledWith(expect.any(String), {
        scopes: ['tenant', 'shared'],
      });
    });

    it('does not filter the catalog for the platform owner', async () => {
      const h = makeHarness();

      await h.service.findOne('perm-1', platformOwner);

      expect(h.query.andWhere).not.toHaveBeenCalled();
    });
  });
});
