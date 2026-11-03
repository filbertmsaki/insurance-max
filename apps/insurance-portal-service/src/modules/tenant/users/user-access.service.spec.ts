import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { FindOperator, type DataSource, type EntityManager } from 'typeorm';
import { RoleScope } from '@insurance-max/contracts';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import type { CompaniesService } from '../../platform/companies/companies.service';
import { CompanyUser } from '../../platform/companies/entities/company-user.entity';
import { CompanyUserRole } from '../../platform/companies/entities/company-user-role.entity';
import { CompanyUserPermission } from '../../platform/companies/entities/company-user-permission.entity';
import { CompanyUserPermissionExclusion } from '../../platform/companies/entities/company-user-permission-exclusion.entity';
import { Permission } from '../../platform/permissions/entities/permission.entity';
import { Role } from '../../platform/roles/entities/role.entity';
import type { AuditService } from '../../shared/audit/audit.service';
import type { AuthorizationVersionService } from '../../shared/authorization/authorization-version.service';
import { QuotationPolicyDataScope } from '../../shared/authorization/quotation-policy-data-scope.enum';
import { Branch } from '../branches/entities/branch.entity';
import { BranchUser } from '../branches/entities/branch-user.entity';
import { Department } from '../departments/entities/department.entity';
import { DepartmentUser } from '../departments/entities/department-user.entity';
import { SELECT_INSURANCE_CHANNEL_PERMISSION } from '../quotations/authorization/insurance-channel-permission';
import { UserAccessService } from './user-access.service';

type Row = Record<string, any>;

/** Minimal in-memory repository supporting the TypeORM calls the service makes. */
function memoryRepo(rows: Row[]) {
  let sequence = rows.length;
  const matches = (row: Row, where: Row = {}) =>
    Object.entries(where).every(([key, expected]) =>
      expected instanceof FindOperator
        ? (expected.value as unknown[]).includes(row[key])
        : row[key] === expected,
    );
  const select = (criteria: unknown) =>
    Array.isArray(criteria)
      ? rows.filter((row) => (criteria as string[]).includes(row.id))
      : typeof criteria === 'string'
        ? rows.filter((row) => row.id === criteria)
        : rows.filter((row) => matches(row, criteria as Row));

  return {
    rows,
    find: jest.fn(async (options: { where?: Row } = {}) =>
      rows.filter((row) => matches(row, options.where)),
    ),
    findOne: jest.fn(
      async (options: { where?: Row }) =>
        rows.find((row) => matches(row, options.where)) ?? null,
    ),
    create: jest.fn((value: Row) => value),
    save: jest.fn(async (value: Row) => {
      const row = { id: value.id ?? `row-${++sequence}`, ...value };
      rows.push(row);
      return row;
    }),
    update: jest.fn(async (criteria: unknown, values: Row) => {
      select(criteria).forEach((row) => Object.assign(row, values));
    }),
    delete: jest.fn(async (criteria: unknown) => {
      for (const row of select(criteria)) rows.splice(rows.indexOf(row), 1);
    }),
  };
}

describe('UserAccessService', () => {
  const companyId = 'company-1';
  const membership = {
    id: 'membership-1',
    user_id: 'user-1',
    company_id: companyId,
    quotation_policy_data_scope: QuotationPolicyDataScope.USER,
  } as CompanyUser;

  const actor = (permissions: string[], roles: string[] = []) =>
    ({
      id: 'actor-1',
      sessionId: 'session-1',
      companyMembershipId: 'membership-actor',
      permissions,
      roles,
    }) as unknown as AuthenticatedUser;

  const allSections = actor([
    'users:create',
    'users:update',
    'users:assign-role',
    'users:manage-data-scope',
    'branches:manage-access',
    'departments:manage-users',
    'quotations:read',
  ]);

  let repos: Map<unknown, ReturnType<typeof memoryRepo>>;
  let manager: EntityManager;
  let companiesService: {
    assertNotLastCompanyAdministrator: jest.Mock;
    assertPermissionGrantScope: jest.Mock;
    assertRolesAllowedForCompany: jest.Mock;
  };
  let audit: { logCritical: jest.Mock };
  let versions: { bumpMembership: jest.Mock };
  let service: UserAccessService;

  beforeEach(() => {
    repos = new Map<unknown, ReturnType<typeof memoryRepo>>([
      [BranchUser, memoryRepo([])],
      [DepartmentUser, memoryRepo([])],
      [CompanyUserRole, memoryRepo([])],
      [CompanyUserPermission, memoryRepo([])],
      [CompanyUserPermissionExclusion, memoryRepo([])],
      [CompanyUser, memoryRepo([membership])],
      [
        Branch,
        memoryRepo([
          { id: 'branch-1', company_id: companyId, status: 'active' },
          { id: 'branch-2', company_id: companyId, status: 'active' },
        ]),
      ],
      [
        Department,
        memoryRepo([
          {
            id: 'dept-1',
            name: 'Motor',
            company_id: companyId,
            status: 'active',
            branch_ids: ['branch-2'],
          },
        ]),
      ],
      [
        Role,
        memoryRepo([
          {
            id: 'role-admin',
            display_name: 'Admin',
            scope: RoleScope.TENANT_TEMPLATE,
            company_id: null,
            is_administrative: true,
          },
          {
            id: 'role-user',
            display_name: 'User',
            scope: RoleScope.TENANT,
            company_id: companyId,
            is_administrative: false,
          },
          {
            id: 'role-foreign',
            display_name: 'Foreign',
            scope: RoleScope.TENANT,
            company_id: 'company-2',
            is_administrative: false,
          },
        ]),
      ],
      [
        Permission,
        memoryRepo([
          {
            id: 'perm-read',
            name: 'quotations:read',
            display_name: 'Read quotations',
            is_deprecated: false,
            assignable_to_company_role: true,
          },
          {
            id: 'perm-delete',
            name: 'quotations:delete',
            display_name: 'Delete quotations',
            is_deprecated: false,
            assignable_to_company_role: true,
          },
          {
            id: 'perm-channel',
            name: SELECT_INSURANCE_CHANNEL_PERMISSION,
            display_name: 'Select insurance channel',
            is_deprecated: false,
            assignable_to_company_role: true,
          },
        ]),
      ],
    ]);

    manager = {
      getRepository: (entity: unknown) => {
        const repo = repos.get(entity);
        if (!repo) throw new Error('Unexpected repository');
        return repo;
      },
      query: jest.fn().mockResolvedValue([]),
    } as unknown as EntityManager;

    companiesService = {
      assertNotLastCompanyAdministrator: jest.fn().mockResolvedValue(undefined),
      assertPermissionGrantScope: jest.fn().mockResolvedValue(undefined),
      assertRolesAllowedForCompany: jest.fn().mockResolvedValue(undefined),
    };
    audit = { logCritical: jest.fn().mockResolvedValue(undefined) };
    versions = { bumpMembership: jest.fn().mockResolvedValue(undefined) };

    service = new UserAccessService(
      {} as DataSource,
      companiesService as unknown as CompaniesService,
      audit as unknown as AuditService,
      versions as unknown as AuthorizationVersionService,
    );
  });

  const apply = (dto: Row, by = allSections) =>
    service.applyAccess(manager, companyId, membership, dto, by);

  describe('section permissions', () => {
    it('rejects sections the actor cannot manage', () => {
      expect(() =>
        service.assertSectionsAllowed(
          actor(['users:update']),
          { role_ids: [] },
          'update',
        ),
      ).toThrow(ForbiddenException);
    });

    it('lets users:create cover the organisation section on create only', () => {
      const creator = actor(['users:create']);
      expect(service.manageableSections(creator, 'create')).toEqual([
        'organisation',
      ]);
      expect(service.manageableSections(creator, 'update')).toEqual([]);
    });

    it('requires branches and departments together on update', () => {
      expect(() =>
        service.assertSectionsAllowed(
          allSections,
          { branch_ids: ['branch-1'], active_branch_id: 'branch-1' },
          'update',
        ),
      ).toThrow(BadRequestException);
    });
  });

  describe('organisation', () => {
    it('replaces branch and department assignments and flags the active ones', async () => {
      repos.get(BranchUser)!.rows.push({
        id: 'bu-old',
        branch_id: 'branch-1',
        company_user_id: membership.id,
        is_active_branch: true,
      });

      await apply({
        branch_ids: ['branch-2'],
        active_branch_id: 'branch-2',
        department_ids: ['dept-1'],
        active_department_id: 'dept-1',
      });

      expect(repos.get(BranchUser)!.rows).toEqual([
        expect.objectContaining({
          branch_id: 'branch-2',
          is_active_branch: true,
        }),
      ]);
      expect(repos.get(DepartmentUser)!.rows).toEqual([
        expect.objectContaining({
          department_id: 'dept-1',
          is_active_department: true,
        }),
      ]);
      expect(versions.bumpMembership).toHaveBeenCalledTimes(1);
      expect(audit.logCritical).toHaveBeenCalledTimes(1);
    });

    it('rejects a department outside the assigned branches', async () => {
      await expect(
        apply({
          branch_ids: ['branch-1'],
          active_branch_id: 'branch-1',
          department_ids: ['dept-1'],
          active_department_id: null,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('roles', () => {
    it('adds and removes roles to match the request', async () => {
      repos.get(CompanyUserRole)!.rows.push({
        id: 'cur-1',
        company_user_id: membership.id,
        role_id: 'role-user',
      });

      await apply({ role_ids: ['role-admin'] });

      expect(
        repos.get(CompanyUserRole)!.rows.map((row) => row.role_id),
      ).toEqual(['role-admin']);
    });

    it('leaves portal system roles untouched when roles are replaced', async () => {
      repos.get(CompanyUserRole)!.rows.push({
        id: 'cur-portal',
        company_user_id: membership.id,
        role_id: 'role-portal',
        role: { name: 'INTERMEDIARY_PORTAL' },
      });

      await apply({ role_ids: ['role-user'] });

      expect(
        repos
          .get(CompanyUserRole)!
          .rows.map((row) => row.role_id)
          .sort(),
      ).toEqual(['role-portal', 'role-user']);
    });

    it('checks newly added roles against the company type', async () => {
      companiesService.assertRolesAllowedForCompany.mockRejectedValue(
        new ForbiddenException('not for this company type'),
      );

      await expect(apply({ role_ids: ['role-admin'] })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('refuses roles that belong to another company', async () => {
      await expect(apply({ role_ids: ['role-foreign'] })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('protects the last company administrator', async () => {
      repos.get(CompanyUserRole)!.rows.push({
        id: 'cur-1',
        company_user_id: membership.id,
        role_id: 'role-admin',
      });
      companiesService.assertNotLastCompanyAdministrator.mockRejectedValue(
        new ConflictException('last admin'),
      );

      await expect(apply({ role_ids: ['role-user'] })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('direct permissions', () => {
    it('blocks granting a permission the actor does not hold', async () => {
      await expect(
        apply({
          permission_grants: [
            {
              permission_id: 'perm-delete',
              data_scope: QuotationPolicyDataScope.USER,
            },
          ],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lets company administrators grant permissions they do not hold', async () => {
      await apply(
        {
          permission_grants: [
            {
              permission_id: 'perm-delete',
              data_scope: QuotationPolicyDataScope.USER,
            },
          ],
        },
        actor(['users:assign-role'], ['COMPANY_ADMIN']),
      );

      expect(repos.get(CompanyUserPermission)!.rows).toEqual([
        expect.objectContaining({ permission_id: 'perm-delete' }),
      ]);
    });

    it('keeps an unchanged grant the actor does not hold', async () => {
      repos.get(CompanyUserPermission)!.rows.push({
        id: 'grant-1',
        company_user_id: membership.id,
        permission_id: 'perm-delete',
        permission: { name: 'quotations:delete' },
        data_scope: QuotationPolicyDataScope.USER,
        scope_branch_id: null,
        scope_department_id: null,
      });

      await apply({
        permission_grants: [
          {
            permission_id: 'perm-delete',
            data_scope: QuotationPolicyDataScope.USER,
          },
        ],
      });

      expect(versions.bumpMembership).not.toHaveBeenCalled();
    });

    it('does not let permission_grants remove insurance channel access', async () => {
      repos.get(CompanyUserPermission)!.rows.push({
        id: 'grant-channel',
        company_user_id: membership.id,
        permission_id: 'perm-channel',
        permission: { name: SELECT_INSURANCE_CHANNEL_PERMISSION },
        data_scope: QuotationPolicyDataScope.USER,
        scope_branch_id: null,
        scope_department_id: null,
      });

      await apply({ permission_grants: [] });

      expect(repos.get(CompanyUserPermission)!.rows).toHaveLength(1);
    });
  });

  describe('removed role permissions', () => {
    it('stores and clears per-member removals', async () => {
      await apply({ excluded_permission_ids: ['perm-read'] });
      expect(
        repos
          .get(CompanyUserPermissionExclusion)!
          .rows.map((row) => row.permission_id),
      ).toEqual(['perm-read']);
      expect(versions.bumpMembership).toHaveBeenCalledTimes(1);

      await apply({ excluded_permission_ids: [] });
      expect(repos.get(CompanyUserPermissionExclusion)!.rows).toHaveLength(0);
    });

    it('treats removals as part of the permissions section', () => {
      expect(() =>
        service.assertSectionsAllowed(
          actor(['users:update']),
          { excluded_permission_ids: ['perm-read'] },
          'update',
        ),
      ).toThrow(ForbiddenException);
    });
  });

  describe('data access', () => {
    it('updates the data scope and records one audit entry', async () => {
      await apply({
        quotation_policy_data_scope: QuotationPolicyDataScope.BRANCH,
      });

      expect(repos.get(CompanyUser)!.update).toHaveBeenCalledWith(
        membership.id,
        { quotation_policy_data_scope: QuotationPolicyDataScope.BRANCH },
      );
      expect(audit.logCritical).toHaveBeenCalledTimes(1);
      membership.quotation_policy_data_scope = QuotationPolicyDataScope.USER;
    });

    it('does nothing when the request matches the current state', async () => {
      await apply({
        role_ids: [],
        quotation_policy_data_scope: QuotationPolicyDataScope.USER,
      });

      expect(versions.bumpMembership).not.toHaveBeenCalled();
      expect(audit.logCritical).not.toHaveBeenCalled();
    });
  });
});
