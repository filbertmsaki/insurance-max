import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RoleScope } from '@insurance-max/contracts';
import { QuotationPolicyDataScope } from '../../shared/authorization/quotation-policy-data-scope.enum';
import { RolePermissionDataScopeDto } from './dtos/role-permission-data-scope.dto';
import { RolesService } from './roles.service';

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
    permissions: ['roles.create', 'roles.update', 'claims.view'],
    ...overrides,
  } as any;
}

function makePermission(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: id,
    assignment_scope: 'shared',
    is_deprecated: false,
    assignable_to_company_role: true,
    assignable_to_platform_role: true,
    is_system_generated: false,
    ...overrides,
  } as any;
}

const catalog = [
  makePermission('perm-claims-view', { name: 'claims.view' }),
  makePermission('perm-claims-approve', { name: 'claims.approve' }),
  makePermission('perm-deprecated', { is_deprecated: true }),
  makePermission('perm-platform-only', {
    assignment_scope: 'platform',
    assignable_to_company_role: false,
  }),
  makePermission('perm-tenant-only', {
    assignment_scope: 'tenant',
    assignable_to_platform_role: false,
  }),
];

function makeRole(overrides: Record<string, unknown> = {}) {
  return {
    id: 'role-1',
    name: 'UNDERWRITER',
    display_name: 'Underwriter',
    description: null,
    company_id: 'company-1',
    scope: RoleScope.TENANT,
    is_system_generated: false,
    is_administrative: false,
    permissions: [catalog[0]],
    permission_data_scopes: [],
    ...overrides,
  } as any;
}

function makeHarness(
  params: {
    roles?: any[];
    assignedCount?: number;
    activeCompanies?: string[];
  } = {},
) {
  const roles = params.roles ?? [makeRole()];
  const activeCompanies = params.activeCompanies ?? ['company-1', 'company-2'];

  // Emulates the SQL visibility filter in findAccessibleRoleOrFail.
  const roleQuery: any = {
    filters: {} as Record<string, any>,
  };
  for (const method of ['leftJoinAndSelect', 'distinct', 'orderBy']) {
    roleQuery[method] = jest.fn(() => roleQuery);
  }
  roleQuery.where = jest.fn((_sql: string, values: any) => {
    Object.assign(roleQuery.filters, values ?? {});
    return roleQuery;
  });
  roleQuery.andWhere = jest.fn((_sql: string, values: any) => {
    Object.assign(roleQuery.filters, values ?? {});
    return roleQuery;
  });
  roleQuery.getOne = jest.fn(async () => {
    const { id, companyId } = roleQuery.filters;
    return (
      roles.find(
        (role) =>
          role.id === id &&
          (companyId === undefined ||
            (role.scope === RoleScope.TENANT_TEMPLATE &&
              role.company_id === null) ||
            (role.scope === RoleScope.TENANT && role.company_id === companyId)),
      ) ?? null
    );
  });
  roleQuery.getMany = jest.fn(async () => roles);

  const rolesRepository = {
    createQueryBuilder: jest.fn(() => roleQuery),
    findOne: jest.fn(),
  } as any;

  const companyRepository = {
    findOne: jest.fn(async ({ where }: any) =>
      activeCompanies.includes(where.id) ? { id: where.id } : null,
    ),
  } as any;

  const roleRepo = {
    findOne: jest.fn(
      async ({ where }: any) =>
        roles.find((role) => role.id === where.id) ?? null,
    ),
    create: jest.fn((value: any) => ({ ...value })),
    save: jest.fn(async (value: any) => ({
      id: value.id ?? 'role-new',
      ...value,
    })),
    remove: jest.fn(async (value: any) => value),
  };

  const permissionRepo = {
    find: jest.fn(async ({ where }: any) =>
      catalog.filter((permission) =>
        where.some((clause: any) => clause.id === permission.id),
      ),
    ),
  };

  const scopeDeleteQuery: any = {};
  for (const method of ['delete', 'where', 'andWhere']) {
    scopeDeleteQuery[method] = jest.fn(() => scopeDeleteQuery);
  }
  scopeDeleteQuery.execute = jest.fn(async () => ({ affected: 0 }));

  const scopeRepo = {
    delete: jest.fn(async () => ({ affected: 0 })),
    create: jest.fn((value: any) => ({ ...value })),
    save: jest.fn(async (value: any) => value),
    find: jest.fn(async () => []),
    createQueryBuilder: jest.fn(() => scopeDeleteQuery),
  };

  const manager = {
    getRepository: (entity: any) => {
      switch (entity?.name) {
        case 'Role':
          return roleRepo;
        case 'Permission':
          return permissionRepo;
        case 'RolePermissionScope':
          return scopeRepo;
        default:
          throw new Error(`Unexpected entity ${entity?.name}`);
      }
    },
    query: jest.fn(async () => [{ count: String(params.assignedCount ?? 0) }]),
  };

  const dataSource = {
    transaction: jest.fn().mockImplementation(async (fn: any) => fn(manager)),
  } as any;

  const auditService = {
    logCritical: jest.fn().mockResolvedValue(undefined),
  } as any;
  const authorizationVersionService = {
    bumpForRole: jest.fn().mockResolvedValue(undefined),
  } as any;

  const service = new RolesService(
    rolesRepository,
    { find: jest.fn() } as any,
    companyRepository,
    dataSource,
    auditService,
    authorizationVersionService,
  );

  return {
    service,
    dataSource,
    manager,
    roleQuery,
    roleRepo,
    permissionRepo,
    scopeRepo,
    scopeDeleteQuery,
    companyRepository,
    auditService,
    authorizationVersionService,
  };
}

const baseDto = { name: 'CLAIMS_CLERK', display_name: 'Claims clerk' };

describe('RolesService', () => {
  describe('create - role scope resolution', () => {
    it.each([RoleScope.PLATFORM, RoleScope.TENANT_TEMPLATE])(
      'forbids company users from creating %s roles',
      async (scope) => {
        const h = makeHarness();

        await expect(
          h.service.create({ ...baseDto, scope }, companyActor()),
        ).rejects.toThrow(ForbiddenException);
        expect(h.dataSource.transaction).not.toHaveBeenCalled();
      },
    );

    it('forbids company users from creating administrative roles', async () => {
      const h = makeHarness();

      await expect(
        h.service.create(
          { ...baseDto, is_administrative: true },
          companyActor(),
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(h.roleRepo.save).not.toHaveBeenCalled();
    });

    it('forbids company users from creating system-generated roles', async () => {
      const h = makeHarness();

      await expect(
        h.service.create(
          { ...baseDto, is_system_generated: true },
          companyActor(),
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(h.roleRepo.save).not.toHaveBeenCalled();
    });

    it('forces company_id to the caller company, ignoring a foreign company_id', async () => {
      const h = makeHarness();

      const role = await h.service.create(
        { ...baseDto, company_id: 'company-2' },
        companyActor(),
      );

      expect(role.company_id).toBe('company-1');
      expect(role.scope).toBe(RoleScope.TENANT);
      expect(role.is_administrative).toBe(false);
      expect(role.is_system_generated).toBe(false);
      expect(h.companyRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'company-1', status: 'active' },
        }),
      );
    });

    it('rejects actors without an active company context', async () => {
      const h = makeHarness();

      await expect(h.service.create(baseDto, superAdmin)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(h.service.create(baseDto, undefined)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects role creation for an inactive company', async () => {
      const h = makeHarness({ activeCompanies: [] });

      await expect(h.service.create(baseDto, companyActor())).rejects.toThrow(
        NotFoundException,
      );
      expect(h.dataSource.transaction).not.toHaveBeenCalled();
    });

    it('lets platform owners create protected administrative platform roles', async () => {
      const h = makeHarness();

      const role = await h.service.create(
        { ...baseDto, is_system_generated: true, is_administrative: true },
        platformOwner,
      );

      expect(role.scope).toBe(RoleScope.PLATFORM);
      expect(role.company_id).toBeNull();
      expect(role.is_system_generated).toBe(true);
      expect(role.is_administrative).toBe(true);
      expect(h.auditService.logCritical).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'role.created' }),
        h.manager,
      );
    });

    it('requires company_id when a platform owner creates a tenant role', async () => {
      const h = makeHarness();

      await expect(
        h.service.create(
          { ...baseDto, scope: RoleScope.TENANT },
          platformOwner,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects company_id on platform or template roles created by the owner', async () => {
      const h = makeHarness();

      await expect(
        h.service.create(
          {
            ...baseDto,
            scope: RoleScope.TENANT_TEMPLATE,
            company_id: 'company-1',
          },
          platformOwner,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('forbids company users from creating a tenant role named OWNER', async () => {
      const h = makeHarness();

      await expect(
        h.service.create(
          { name: 'OWNER', display_name: 'Owner' },
          companyActor(),
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create - permission assignment', () => {
    it.each([
      ['deprecated', 'perm-deprecated'],
      ['platform-only', 'perm-platform-only'],
    ])(
      'rejects %s permissions on company roles',
      async (_label, permissionId) => {
        const h = makeHarness();

        await expect(
          h.service.create(
            { ...baseDto, permission_ids: ['perm-claims-view', permissionId] },
            companyActor(),
          ),
        ).rejects.toMatchObject({
          response: expect.objectContaining({
            code: 'PERMISSION_NOT_ASSIGNABLE',
          }),
        });
        expect(h.roleRepo.save).not.toHaveBeenCalled();
      },
    );

    it('rejects unknown permission ids', async () => {
      const h = makeHarness();

      await expect(
        h.service.create(
          { ...baseDto, permission_ids: ['perm-claims-view', 'perm-missing'] },
          companyActor(),
        ),
      ).rejects.toThrow(NotFoundException);
      expect(h.roleRepo.save).not.toHaveBeenCalled();
    });

    it('rejects tenant-only permissions on platform roles', async () => {
      const h = makeHarness();

      await expect(
        h.service.create(
          { ...baseDto, permission_ids: ['perm-tenant-only'] },
          platformOwner,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('attaches valid, de-duplicated permissions to a company role', async () => {
      const h = makeHarness();

      const role = await h.service.create(
        {
          ...baseDto,
          permission_ids: ['perm-claims-view', 'perm-claims-view'],
        },
        companyActor(),
      );

      expect(role.permissions.map((permission: any) => permission.id)).toEqual([
        'perm-claims-view',
      ]);
    });

    // BUG: resolvePermissions (roles.service.ts:106) never compares requested permissions against actor.permissions
    it.failing(
      'forbids company users from granting permissions they do not hold',
      async () => {
        const h = makeHarness();

        await expect(
          h.service.create(
            { ...baseDto, permission_ids: ['perm-claims-approve'] },
            companyActor({ permissions: ['roles.create', 'claims.view'] }),
          ),
        ).rejects.toThrow(ForbiddenException);
      },
    );
  });

  describe('permission data scopes', () => {
    it('rejects a data scope for a permission not on the role', async () => {
      const h = makeHarness();

      await expect(
        h.service.create(
          {
            ...baseDto,
            permission_ids: ['perm-claims-view'],
            permission_data_scopes: [
              {
                permission_id: 'perm-claims-approve',
                data_scope: QuotationPolicyDataScope.COMPANY,
              },
            ],
          },
          companyActor(),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(h.scopeRepo.save).not.toHaveBeenCalled();
    });

    it('rejects duplicate data scopes for the same permission', async () => {
      const h = makeHarness();

      await expect(
        h.service.create(
          {
            ...baseDto,
            permission_ids: ['perm-claims-view'],
            permission_data_scopes: [
              {
                permission_id: 'perm-claims-view',
                data_scope: QuotationPolicyDataScope.USER,
              },
              {
                permission_id: 'perm-claims-view',
                data_scope: QuotationPolicyDataScope.COMPANY,
              },
            ],
          },
          companyActor(),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('replaces scopes for the saved role only, without branch/department pins', async () => {
      const h = makeHarness();

      await h.service.create(
        {
          ...baseDto,
          permission_ids: ['perm-claims-view'],
          permission_data_scopes: [
            {
              permission_id: 'perm-claims-view',
              data_scope: QuotationPolicyDataScope.BRANCH,
            },
          ],
        },
        companyActor(),
      );

      expect(h.scopeRepo.delete).toHaveBeenCalledWith({ role_id: 'role-new' });
      expect(h.scopeRepo.save).toHaveBeenCalledWith([
        {
          role_id: 'role-new',
          permission_id: 'perm-claims-view',
          data_scope: QuotationPolicyDataScope.BRANCH,
          scope_branch_id: null,
          scope_department_id: null,
        },
      ]);
    });

    it('rejects invalid data scope values at the DTO boundary', async () => {
      const dto = plainToInstance(RolePermissionDataScopeDto, {
        permission_id: '0b9f1f4e-6a3c-4f55-9a8e-2f6f7f2b1c11',
        data_scope: 'GLOBAL',
      });

      const errors = await validate(dto);

      expect(errors.map((error) => error.property)).toEqual(['data_scope']);
    });

    it('does not touch scopes of another company role', async () => {
      const h = makeHarness({
        roles: [makeRole({ id: 'role-2', company_id: 'company-2' })],
      });

      await expect(
        h.service.update(
          'role-2',
          { permission_data_scopes: [] },
          companyActor(),
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(h.scopeRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws when the role does not exist', async () => {
      const h = makeHarness({ roles: [] });

      await expect(
        h.service.update('role-1', { display_name: 'X' }, companyActor()),
      ).rejects.toThrow(NotFoundException);
    });

    it('protects system-generated roles from company users', async () => {
      const h = makeHarness({
        roles: [makeRole({ is_system_generated: true })],
      });

      await expect(
        h.service.update('role-1', { display_name: 'Hacked' }, companyActor()),
      ).rejects.toThrow(ForbiddenException);
      expect(h.roleRepo.save).not.toHaveBeenCalled();
    });

    it('lets the platform owner update a system-generated role', async () => {
      const h = makeHarness({
        roles: [makeRole({ is_system_generated: true })],
      });

      const saved = await h.service.update(
        'role-1',
        { display_name: 'Renamed' },
        platformOwner,
      );

      expect(saved.display_name).toBe('Renamed');
      expect(h.authorizationVersionService.bumpForRole).toHaveBeenCalledWith(
        'role-1',
        h.manager,
      );
    });

    it("forbids updating another company's role", async () => {
      const h = makeHarness({
        roles: [makeRole({ company_id: 'company-2' })],
      });

      await expect(
        h.service.update('role-1', { display_name: 'X' }, companyActor()),
      ).rejects.toThrow(ForbiddenException);
      expect(h.roleRepo.save).not.toHaveBeenCalled();
    });

    it('forbids company users from modifying global template roles', async () => {
      const h = makeHarness({
        roles: [
          makeRole({ company_id: null, scope: RoleScope.TENANT_TEMPLATE }),
        ],
      });

      await expect(
        h.service.update('role-1', { display_name: 'X' }, companyActor()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('forbids moving a role into another company', async () => {
      const h = makeHarness();

      await expect(
        h.service.update('role-1', { company_id: 'company-2' }, companyActor()),
      ).rejects.toThrow(ForbiddenException);
      expect(h.roleRepo.save).not.toHaveBeenCalled();
    });

    it('forbids company users from changing role scope', async () => {
      const h = makeHarness();

      await expect(
        h.service.update(
          'role-1',
          { scope: RoleScope.PLATFORM },
          companyActor(),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('refuses scope changes while the role is assigned', async () => {
      const h = makeHarness({ assignedCount: 2 });

      await expect(
        h.service.update(
          'role-1',
          { scope: RoleScope.PLATFORM },
          platformOwner,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('forbids company users from flagging a role administrative', async () => {
      const h = makeHarness();

      await expect(
        h.service.update('role-1', { is_administrative: true }, companyActor()),
      ).rejects.toThrow(ForbiddenException);
      expect(h.roleRepo.save).not.toHaveBeenCalled();
    });

    it('forbids company users from flagging a role system-generated', async () => {
      const h = makeHarness();

      await expect(
        h.service.update(
          'role-1',
          { is_system_generated: true },
          companyActor(),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects platform-only permissions when updating a company role', async () => {
      const h = makeHarness();

      await expect(
        h.service.update(
          'role-1',
          { permission_ids: ['perm-platform-only'] },
          companyActor(),
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(h.roleRepo.save).not.toHaveBeenCalled();
    });

    it('prunes data scopes of removed permissions and audits the change', async () => {
      const h = makeHarness();

      const saved = await h.service.update(
        'role-1',
        { permission_ids: ['perm-claims-approve'] },
        companyActor(),
      );

      expect(saved.permissions.map((p: any) => p.id)).toEqual([
        'perm-claims-approve',
      ]);
      expect(h.scopeDeleteQuery.andWhere).toHaveBeenCalledWith(
        'permission_id NOT IN (:...permissionIds)',
        { permissionIds: ['perm-claims-approve'] },
      );
      expect(h.authorizationVersionService.bumpForRole).toHaveBeenCalled();
      expect(h.auditService.logCritical).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'role.updated',
          beforeState: expect.objectContaining({
            permission_ids: ['perm-claims-view'],
          }),
        }),
        h.manager,
      );
    });

    it("forbids a company actor holding a tenant role named OWNER from updating another company's role", async () => {
      const h = makeHarness({
        roles: [makeRole({ company_id: 'company-2' })],
      });

      await expect(
        h.service.update(
          'role-1',
          { display_name: 'X' },
          companyActor({ roles: ['OWNER'] }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it("hides another company's role", async () => {
      const h = makeHarness({
        roles: [makeRole({ company_id: 'company-2' })],
      });

      await expect(h.service.remove('role-1', companyActor())).rejects.toThrow(
        NotFoundException,
      );
      expect(h.roleQuery.andWhere).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ companyId: 'company-1' }),
      );
      expect(h.roleRepo.remove).not.toHaveBeenCalled();
    });

    it('forbids company users from deleting visible template roles', async () => {
      const h = makeHarness({
        roles: [
          makeRole({ company_id: null, scope: RoleScope.TENANT_TEMPLATE }),
        ],
      });

      await expect(h.service.remove('role-1', companyActor())).rejects.toThrow(
        ForbiddenException,
      );
      expect(h.roleRepo.remove).not.toHaveBeenCalled();
    });

    it('protects system-generated roles from deletion by company users', async () => {
      const h = makeHarness({
        roles: [makeRole({ is_system_generated: true })],
      });

      await expect(h.service.remove('role-1', companyActor())).rejects.toThrow(
        ForbiddenException,
      );
      expect(h.roleRepo.remove).not.toHaveBeenCalled();
    });

    it('refuses to delete an assigned role', async () => {
      const h = makeHarness({ assignedCount: 1 });

      await expect(h.service.remove('role-1', companyActor())).rejects.toThrow(
        ConflictException,
      );
      expect(h.roleRepo.remove).not.toHaveBeenCalled();
    });

    it('deletes an unassigned own-company role and audits it', async () => {
      const h = makeHarness();

      await h.service.remove('role-1', companyActor());

      expect(h.roleRepo.remove).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'role-1' }),
      );
      expect(h.auditService.logCritical).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'role.deleted',
          resourceId: 'role-1',
        }),
        h.manager,
      );
    });
  });
});
