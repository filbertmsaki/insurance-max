import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { RoleScope } from '@insurance-max/contracts';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { CompaniesService } from '../../platform/companies/companies.service';
import {
  actorAdministersCompany,
  actorCanDelegatePermission,
  isRoleAllowedForCompanyType,
  isSystemRole,
  isPermissionGrantableToMembership,
  isRoleAssignableToCompany,
} from '../../platform/companies/access-rules';
import { Company } from '../../platform/companies/entities/company.entity';
import { CompanyUser } from '../../platform/companies/entities/company-user.entity';
import { CompanyUserRole } from '../../platform/companies/entities/company-user-role.entity';
import { CompanyUserPermission } from '../../platform/companies/entities/company-user-permission.entity';
import { CompanyUserPermissionExclusion } from '../../platform/companies/entities/company-user-permission-exclusion.entity';
import { Permission } from '../../platform/permissions/entities/permission.entity';
import { Role } from '../../platform/roles/entities/role.entity';
import { AuditService } from '../../shared/audit/audit.service';
import { AuthorizationVersionService } from '../../shared/authorization/authorization-version.service';
import { QuotationPolicyDataScope } from '../../shared/authorization/quotation-policy-data-scope.enum';
import { Branch } from '../branches/entities/branch.entity';
import { BranchUser } from '../branches/entities/branch-user.entity';
import {
  Department,
  departmentServesBranch,
} from '../departments/entities/department.entity';
import { DepartmentUser } from '../departments/entities/department-user.entity';
import { SELECT_INSURANCE_CHANNEL_PERMISSION } from '../quotations/authorization/insurance-channel-permission';
import { UpdateUserAccessDto } from './dtos/user-access.dto';

export interface PermissionGrantState {
  permission_id: string;
  /** null inherits the membership's quotation_policy_data_scope. */
  data_scope: QuotationPolicyDataScope | null;
  scope_branch_id: string | null;
  scope_department_id: string | null;
}

export interface UserAccessState {
  branch_ids: string[];
  active_branch_id: string | null;
  department_ids: string[];
  active_department_id: string | null;
  role_ids: string[];
  permission_grants: PermissionGrantState[];
  /** Role permissions this member does not get. */
  excluded_permission_ids: string[];
  quotation_policy_data_scope: QuotationPolicyDataScope;
  insurance_channel_access: boolean;
}

export type UserAccessSection =
  | 'organisation'
  | 'roles'
  | 'permissions'
  | 'data_access';

type AccessMode = 'create' | 'update';

const SECTION_PERMISSIONS: Record<
  UserAccessSection,
  Record<AccessMode, string[]>
> = {
  // Creating a user always places them in a branch, so users:create covers it.
  organisation: {
    create: ['users:create'],
    update: ['branches:manage-access', 'departments:manage-users'],
  },
  roles: { create: ['users:assign-role'], update: ['users:assign-role'] },
  permissions: {
    create: ['users:assign-role'],
    update: ['users:assign-role'],
  },
  data_access: {
    create: ['users:manage-data-scope'],
    update: ['users:manage-data-scope'],
  },
};

/** Holding any of these lets an actor open a user's access for editing. */
export const USER_ACCESS_EDIT_PERMISSIONS = [
  'users:update',
  'users:assign-role',
  'users:manage-data-scope',
  'branches:manage-access',
  'departments:manage-users',
];

/**
 * Reads and replaces a company membership's access (organisation, roles,
 * direct permissions, data access) in one transaction with one
 * authorization-version bump and one audit entry.
 */
@Injectable()
export class UserAccessService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly companiesService: CompaniesService,
    private readonly auditService: AuditService,
    private readonly authorizationVersionService: AuthorizationVersionService,
  ) {}

  // ── Section permissions ────────────────────────────────────────────────

  manageableSections(
    actor: Pick<AuthenticatedUser, 'permissions'>,
    mode: AccessMode,
  ): UserAccessSection[] {
    return (Object.keys(SECTION_PERMISSIONS) as UserAccessSection[]).filter(
      (section) =>
        SECTION_PERMISSIONS[section][mode].every((permission) =>
          actor.permissions?.includes(permission),
        ),
    );
  }

  /** Rejects a request that touches a section the actor may not manage. */
  assertSectionsAllowed(
    actor: Pick<AuthenticatedUser, 'permissions'>,
    dto: Partial<UpdateUserAccessDto>,
    mode: AccessMode,
  ): void {
    const allowed = this.manageableSections(actor, mode);
    const touched = this.touchedSections(dto);

    if (
      mode === 'update' &&
      touched.includes('organisation') &&
      (dto.branch_ids === undefined || dto.department_ids === undefined)
    ) {
      throw new BadRequestException(
        'Branches and departments must be submitted together.',
      );
    }

    const denied = touched.filter((section) => !allowed.includes(section));
    if (denied.length) {
      throw new ForbiddenException({
        code: 'USER_ACCESS_SECTION_FORBIDDEN',
        message: `You are not allowed to manage: ${denied.join(', ')}.`,
      });
    }
  }

  private touchedSections(
    dto: Partial<UpdateUserAccessDto>,
  ): UserAccessSection[] {
    const sections: UserAccessSection[] = [];
    if (dto.branch_ids !== undefined || dto.department_ids !== undefined) {
      sections.push('organisation');
    }
    if (dto.role_ids !== undefined) sections.push('roles');
    if (
      dto.permission_grants !== undefined ||
      dto.excluded_permission_ids !== undefined
    ) {
      sections.push('permissions');
    }
    if (
      dto.quotation_policy_data_scope !== undefined ||
      dto.insurance_channel_access !== undefined
    ) {
      sections.push('data_access');
    }
    return sections;
  }

  // ── Options ────────────────────────────────────────────────────────────

  async getOptions(companyId: string, actor: AuthenticatedUser) {
    const [company, allRoles, permissions, branches, departments] =
      await Promise.all([
        this.dataSource.getRepository(Company).findOneOrFail({
          where: { id: companyId },
          select: { id: true, company_type: true },
        }),
        this.dataSource
          .getRepository(Role)
          .createQueryBuilder('role')
          .leftJoinAndSelect('role.permissions', 'permission')
          .where(
            '((role.scope = :tenant AND role.company_id = :companyId) OR (role.scope = :template AND role.company_id IS NULL))',
            {
              tenant: RoleScope.TENANT,
              template: RoleScope.TENANT_TEMPLATE,
              companyId,
            },
          )
          .orderBy('role.display_name', 'ASC')
          .getMany(),
        this.dataSource.getRepository(Permission).find({
          where: { is_deprecated: false, assignable_to_company_role: true },
          order: { name: 'ASC' },
        }),
        this.dataSource.getRepository(Branch).find({
          where: { company_id: companyId, status: 'active' },
          order: { name: 'ASC' },
        }),
        this.dataSource.getRepository(Department).find({
          where: { company_id: companyId, status: 'active' },
          order: { name: 'ASC' },
        }),
      ]);

    // One entry per role name: the company's own copy wins over the shared
    // template. Portal system roles and other company types' admin roles
    // are never offered.
    const byName = new Map<string, Role>();
    for (const role of allRoles) {
      if (
        isSystemRole(role.name) ||
        !isRoleAllowedForCompanyType(role.name, company.company_type)
      ) {
        continue;
      }
      const existing = byName.get(role.name);
      if (!existing || (existing.company_id === null && role.company_id)) {
        byName.set(role.name, role);
      }
    }
    const roles = [...byName.values()].sort((a, b) =>
      a.display_name.localeCompare(b.display_name),
    );

    return {
      sections: {
        create: this.manageableSections(actor, 'create'),
        update: this.manageableSections(actor, 'update'),
      },
      roles: roles.map((role) => ({
        id: role.id,
        name: role.name,
        display_name: role.display_name,
        description: role.description,
        is_administrative: role.is_administrative,
        permissions: (role.permissions ?? []).map((permission) => ({
          id: permission.id,
          name: permission.name,
          display_name: permission.display_name,
        })),
      })),
      permissions: permissions
        .filter(
          (permission) =>
            permission.name !== SELECT_INSURANCE_CHANNEL_PERMISSION &&
            actorCanDelegatePermission(actor, permission.name),
        )
        .map((permission) => ({
          id: permission.id,
          name: permission.name,
          display_name: permission.display_name,
          description: permission.description,
          category: permission.name.includes(':')
            ? permission.name.split(':')[0]
            : 'general',
        })),
      branches: branches.map((branch) => ({
        id: branch.id,
        name: branch.name,
        code: branch.code,
      })),
      departments: departments.map((department) => ({
        id: department.id,
        name: department.name,
        code: department.code,
        branch_ids: department.branch_ids,
      })),
      data_scopes: Object.values(QuotationPolicyDataScope),
      can_grant_insurance_channel: actorCanDelegatePermission(
        actor,
        SELECT_INSURANCE_CHANNEL_PERMISSION,
      ),
      administers_company: actorAdministersCompany(actor),
    };
  }

  // ── Read ───────────────────────────────────────────────────────────────

  async getAccess(
    companyId: string,
    userId: string,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<UserAccessState> {
    const membership = await this.findActiveMembership(
      manager,
      companyId,
      userId,
    );
    return this.readState(manager, membership);
  }

  private async readState(
    manager: EntityManager,
    membership: CompanyUser,
  ): Promise<UserAccessState> {
    const [branchUsers, departmentUsers, roleAssignments, grants, exclusions] =
      await Promise.all([
        manager
          .getRepository(BranchUser)
          .find({ where: { company_user_id: membership.id } }),
        manager
          .getRepository(DepartmentUser)
          .find({ where: { company_user_id: membership.id } }),
        manager.getRepository(CompanyUserRole).find({
          where: { company_user_id: membership.id },
          relations: { role: true },
        }),
        manager.getRepository(CompanyUserPermission).find({
          where: { company_user_id: membership.id },
          relations: { permission: true },
        }),
        manager
          .getRepository(CompanyUserPermissionExclusion)
          .find({ where: { company_user_id: membership.id } }),
      ]);

    return {
      branch_ids: branchUsers.map((assignment) => assignment.branch_id),
      active_branch_id:
        branchUsers.find((assignment) => assignment.is_active_branch)
          ?.branch_id ?? null,
      department_ids: departmentUsers.map(
        (assignment) => assignment.department_id,
      ),
      active_department_id:
        departmentUsers.find((assignment) => assignment.is_active_department)
          ?.department_id ?? null,
      // System roles belong to the portal flow and are left out of edits.
      role_ids: roleAssignments
        .filter((assignment) => !isSystemRole(assignment.role?.name ?? ''))
        .map((assignment) => assignment.role_id),
      permission_grants: grants
        .filter(
          (grant) =>
            grant.permission?.name !== SELECT_INSURANCE_CHANNEL_PERMISSION,
        )
        .map((grant) => ({
          permission_id: grant.permission_id,
          data_scope: grant.data_scope ?? null,
          scope_branch_id: grant.scope_branch_id ?? null,
          scope_department_id: grant.scope_department_id ?? null,
        })),
      excluded_permission_ids: exclusions
        .map((exclusion) => exclusion.permission_id)
        .sort(),
      quotation_policy_data_scope: membership.quotation_policy_data_scope,
      insurance_channel_access: grants.some(
        (grant) =>
          grant.permission?.name === SELECT_INSURANCE_CHANNEL_PERMISSION,
      ),
    };
  }

  // ── Write ──────────────────────────────────────────────────────────────

  async updateAccess(
    companyId: string,
    userId: string,
    dto: UpdateUserAccessDto,
    actor: AuthenticatedUser,
  ): Promise<UserAccessState> {
    this.assertSectionsAllowed(actor, dto, 'update');

    return this.dataSource.transaction(async (manager) => {
      const membership = await this.findActiveMembership(
        manager,
        companyId,
        userId,
        true,
      );
      await this.applyAccess(manager, companyId, membership, dto, actor);
      return this.readState(manager, membership);
    });
  }

  /**
   * Applies every section present in `dto` to the membership. Callers own
   * the transaction and the section permission check.
   */
  async applyAccess(
    manager: EntityManager,
    companyId: string,
    membership: CompanyUser,
    dto: Partial<UpdateUserAccessDto>,
    actor: AuthenticatedUser,
    action = 'user.access.updated',
  ): Promise<void> {
    const before = await this.readState(manager, membership);

    if (dto.branch_ids !== undefined) {
      await this.applyOrganisation(manager, companyId, membership, {
        branchIds: dto.branch_ids,
        activeBranchId: dto.active_branch_id!,
        departmentIds: dto.department_ids ?? before.department_ids,
        activeDepartmentId:
          dto.department_ids !== undefined
            ? (dto.active_department_id ?? null)
            : before.active_department_id,
      });
    }
    if (dto.role_ids !== undefined) {
      await this.applyRoles(
        manager,
        companyId,
        membership,
        before.role_ids,
        dto.role_ids,
      );
    }
    if (dto.permission_grants !== undefined) {
      await this.applyPermissionGrants(
        manager,
        companyId,
        membership,
        before.permission_grants,
        dto.permission_grants.map((grant) => ({
          permission_id: grant.permission_id,
          data_scope: grant.data_scope ?? null,
          scope_branch_id: grant.scope_branch_id ?? null,
          scope_department_id: grant.scope_department_id ?? null,
        })),
        actor,
      );
    }
    if (dto.excluded_permission_ids !== undefined) {
      await this.applyExclusions(
        manager,
        membership,
        before.excluded_permission_ids,
        dto.excluded_permission_ids,
      );
    }
    // A removal only makes sense while a role still grants the permission.
    await this.pruneStaleExclusions(manager, membership.id);
    if (
      dto.quotation_policy_data_scope !== undefined &&
      dto.quotation_policy_data_scope !== membership.quotation_policy_data_scope
    ) {
      membership.quotation_policy_data_scope = dto.quotation_policy_data_scope;
      await manager.getRepository(CompanyUser).update(membership.id, {
        quotation_policy_data_scope: dto.quotation_policy_data_scope,
      });
    }
    if (
      dto.insurance_channel_access !== undefined &&
      dto.insurance_channel_access !== before.insurance_channel_access
    ) {
      await this.applyInsuranceChannel(
        manager,
        membership,
        dto.insurance_channel_access,
        actor,
      );
    }

    await this.assertGrantTargetsStillAssigned(manager, membership.id);

    const after = await this.readState(manager, membership);
    if (JSON.stringify(before) === JSON.stringify(after)) {
      return;
    }

    await this.authorizationVersionService.bumpMembership(
      membership.id,
      manager,
    );
    await this.auditService.logCritical(
      {
        userId: actor.id,
        companyId,
        companyMembershipId: actor.companyMembershipId,
        branchId: actor.activeBranchId ?? null,
        sessionId: actor.sessionId,
        action,
        eventCategory: 'authorization',
        resource: 'company_user',
        resourceId: membership.id,
        metadata: { userId: membership.user_id },
        beforeState: { ...before },
        afterState: { ...after },
      },
      manager,
    );
  }

  private async applyOrganisation(
    manager: EntityManager,
    companyId: string,
    membership: CompanyUser,
    desired: {
      branchIds: string[];
      activeBranchId: string;
      departmentIds: string[];
      activeDepartmentId: string | null;
    },
  ): Promise<void> {
    if (!desired.branchIds.includes(desired.activeBranchId)) {
      throw new BadRequestException(
        'active_branch_id must be one of branch_ids',
      );
    }
    if (
      desired.activeDepartmentId &&
      !desired.departmentIds.includes(desired.activeDepartmentId)
    ) {
      throw new BadRequestException(
        'active_department_id must be one of department_ids',
      );
    }

    const branches = await manager.getRepository(Branch).find({
      where: {
        id: In(desired.branchIds),
        company_id: companyId,
        status: 'active',
      },
    });
    if (branches.length !== desired.branchIds.length) {
      throw new NotFoundException(
        'One or more branches were not found or are not active',
      );
    }

    const departments = desired.departmentIds.length
      ? await manager.getRepository(Department).find({
          where: {
            id: In(desired.departmentIds),
            company_id: companyId,
            status: 'active',
          },
        })
      : [];
    if (departments.length !== desired.departmentIds.length) {
      throw new NotFoundException(
        'One or more departments were not found or are not active',
      );
    }
    for (const department of departments) {
      if (
        department.branch_ids.length > 0 &&
        !department.branch_ids.some((id) => desired.branchIds.includes(id))
      ) {
        throw new BadRequestException(
          `Department ${department.name} does not operate in any branch the user is assigned to.`,
        );
      }
      if (
        department.id === desired.activeDepartmentId &&
        !departmentServesBranch(department, desired.activeBranchId)
      ) {
        throw new BadRequestException(
          'The active department must operate in the active branch or be company-wide.',
        );
      }
    }

    const now = new Date();

    const branchRepo = manager.getRepository(BranchUser);
    const currentBranches = await branchRepo.find({
      where: { company_user_id: membership.id },
    });
    const removedBranches = currentBranches.filter(
      (assignment) => !desired.branchIds.includes(assignment.branch_id),
    );
    if (removedBranches.length) {
      await branchRepo.delete(removedBranches.map((item) => item.id));
    }
    for (const branchId of desired.branchIds) {
      const isActive = branchId === desired.activeBranchId;
      const existing = currentBranches.find(
        (assignment) => assignment.branch_id === branchId,
      );
      if (!existing) {
        await branchRepo.save(
          branchRepo.create({
            branch_id: branchId,
            company_user_id: membership.id,
            is_primary: isActive,
            is_active_branch: isActive,
            assigned_by: null,
            activated_at: isActive ? now : null,
            activated_by: null,
          }),
        );
      } else if (existing.is_active_branch !== isActive) {
        await branchRepo.update(existing.id, {
          is_primary: isActive,
          is_active_branch: isActive,
          ...(isActive ? { activated_at: now } : {}),
        });
      }
    }

    const departmentRepo = manager.getRepository(DepartmentUser);
    const currentDepartments = await departmentRepo.find({
      where: { company_user_id: membership.id },
    });
    const removedDepartments = currentDepartments.filter(
      (assignment) => !desired.departmentIds.includes(assignment.department_id),
    );
    if (removedDepartments.length) {
      await departmentRepo.delete(removedDepartments.map((item) => item.id));
    }
    for (const departmentId of desired.departmentIds) {
      const isActive = departmentId === desired.activeDepartmentId;
      const existing = currentDepartments.find(
        (assignment) => assignment.department_id === departmentId,
      );
      if (!existing) {
        await departmentRepo.save(
          departmentRepo.create({
            company_id: companyId,
            department_id: departmentId,
            company_user_id: membership.id,
            is_primary: isActive,
            is_active_department: isActive,
            assigned_by: null,
            activated_at: isActive ? now : null,
            activated_by: null,
          }),
        );
      } else if (existing.is_active_department !== isActive) {
        await departmentRepo.update(existing.id, {
          is_primary: isActive,
          is_active_department: isActive,
          ...(isActive ? { activated_at: now } : {}),
        });
      }
    }
  }

  private async applyRoles(
    manager: EntityManager,
    companyId: string,
    membership: CompanyUser,
    currentRoleIds: string[],
    desiredRoleIds: string[],
  ): Promise<void> {
    const roleIds = [...new Set([...currentRoleIds, ...desiredRoleIds])];
    const roles = roleIds.length
      ? await manager.getRepository(Role).find({ where: { id: In(roleIds) } })
      : [];
    const roleById = new Map(roles.map((role) => [role.id, role]));

    for (const roleId of desiredRoleIds) {
      const role = roleById.get(roleId);
      if (!role) throw new NotFoundException('Role not found.');
      if (!isRoleAssignableToCompany(role, companyId)) {
        throw new ForbiddenException({
          code: 'ROLE_NOT_ASSIGNABLE_TO_COMPANY',
          message: `The role ${role.display_name} cannot be assigned within this company.`,
        });
      }
    }

    const removed = currentRoleIds.filter((id) => !desiredRoleIds.includes(id));
    const added = desiredRoleIds.filter((id) => !currentRoleIds.includes(id));

    await this.companiesService.assertRolesAllowedForCompany(
      added.map((id) => roleById.get(id)!),
      companyId,
      manager,
    );

    const losesAdministration =
      removed.some((id) => roleById.get(id)?.is_administrative) &&
      !desiredRoleIds.some((id) => roleById.get(id)?.is_administrative);
    if (losesAdministration) {
      await this.companiesService.assertNotLastCompanyAdministrator(
        companyId,
        membership.id,
        manager,
      );
    }

    const assignmentRepo = manager.getRepository(CompanyUserRole);
    if (removed.length) {
      await assignmentRepo.delete({
        company_user_id: membership.id,
        role_id: In(removed),
      });
    }
    for (const roleId of added) {
      await assignmentRepo.save(
        assignmentRepo.create({
          company_user_id: membership.id,
          role_id: roleId,
        }),
      );
    }
  }

  private async applyPermissionGrants(
    manager: EntityManager,
    companyId: string,
    membership: CompanyUser,
    current: PermissionGrantState[],
    desired: PermissionGrantState[],
    actor: AuthenticatedUser,
  ): Promise<void> {
    const desiredIds = desired.map((grant) => grant.permission_id);
    if (new Set(desiredIds).size !== desiredIds.length) {
      throw new BadRequestException('Each permission may be granted once.');
    }

    const permissions = desiredIds.length
      ? await manager
          .getRepository(Permission)
          .find({ where: { id: In(desiredIds) } })
      : [];
    const permissionById = new Map(
      permissions.map((permission) => [permission.id, permission]),
    );

    const assignmentRepo = manager.getRepository(CompanyUserPermission);

    for (const grant of desired) {
      const permission = permissionById.get(grant.permission_id);
      if (!permission) throw new NotFoundException('Permission not found.');
      if (permission.name === SELECT_INSURANCE_CHANNEL_PERMISSION) {
        throw new BadRequestException(
          'Insurance channel access is managed through insurance_channel_access.',
        );
      }

      const existing = current.find(
        (item) => item.permission_id === grant.permission_id,
      );
      const unchanged =
        existing && JSON.stringify(existing) === JSON.stringify(grant);
      if (unchanged) continue;

      if (!isPermissionGrantableToMembership(permission)) {
        throw new ForbiddenException({
          code: 'PERMISSION_NOT_ASSIGNABLE',
          message: `${permission.display_name} cannot be granted to a company membership.`,
        });
      }
      if (!actorCanDelegatePermission(actor, permission.name)) {
        throw new ForbiddenException({
          code: 'CANNOT_DELEGATE_UNHELD_PERMISSION',
          message: `You may only grant permissions you hold (${permission.display_name}).`,
        });
      }
      await this.companiesService.assertPermissionGrantScope(
        companyId,
        membership.id,
        {
          dataScope: grant.data_scope ?? membership.quotation_policy_data_scope,
          branchId: grant.scope_branch_id,
          departmentId: grant.scope_department_id,
        },
        manager,
      );

      const values = {
        data_scope: grant.data_scope,
        scope_branch_id: grant.scope_branch_id,
        scope_department_id: grant.scope_department_id,
      };
      if (existing) {
        await assignmentRepo.update(
          {
            company_user_id: membership.id,
            permission_id: grant.permission_id,
          },
          values,
        );
      } else {
        await assignmentRepo.save(
          assignmentRepo.create({
            company_user_id: membership.id,
            permission_id: grant.permission_id,
            ...values,
          }),
        );
      }
    }

    const removed = current
      .map((grant) => grant.permission_id)
      .filter((id) => !desiredIds.includes(id));
    if (removed.length) {
      await assignmentRepo.delete({
        company_user_id: membership.id,
        permission_id: In(removed),
      });
    }
  }

  /** Removing access needs no delegation check; it only ever narrows. */
  private async applyExclusions(
    manager: EntityManager,
    membership: CompanyUser,
    current: string[],
    desired: string[],
  ): Promise<void> {
    const repo = manager.getRepository(CompanyUserPermissionExclusion);
    const removed = current.filter((id) => !desired.includes(id));
    const added = [...new Set(desired)].filter((id) => !current.includes(id));

    if (removed.length) {
      await repo.delete({
        company_user_id: membership.id,
        permission_id: In(removed),
      });
    }
    for (const permissionId of added) {
      await repo.save(
        repo.create({
          company_user_id: membership.id,
          permission_id: permissionId,
        }),
      );
    }
  }

  private async pruneStaleExclusions(
    manager: EntityManager,
    membershipId: string,
  ): Promise<void> {
    await manager.query(
      `
        DELETE FROM company_user_permission_exclusions exclusion
        WHERE exclusion.company_user_id = $1
          AND NOT EXISTS (
            SELECT 1 FROM company_user_roles assignment
            JOIN permission_role role_permission
              ON role_permission.roles_id = assignment.role_id
            WHERE assignment.company_user_id = $1
              AND role_permission.permissions_id = exclusion.permission_id)
      `,
      [membershipId],
    );
  }

  private async applyInsuranceChannel(
    manager: EntityManager,
    membership: CompanyUser,
    granted: boolean,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const permission = await manager
      .getRepository(Permission)
      .findOne({ where: { name: SELECT_INSURANCE_CHANNEL_PERMISSION } });
    if (!permission) {
      throw new NotFoundException(
        'Insurance channel permission is not configured.',
      );
    }

    const assignmentRepo = manager.getRepository(CompanyUserPermission);
    if (!granted) {
      await assignmentRepo.delete({
        company_user_id: membership.id,
        permission_id: permission.id,
      });
      return;
    }

    if (!actorCanDelegatePermission(actor, permission.name)) {
      throw new ForbiddenException({
        code: 'CANNOT_DELEGATE_UNHELD_PERMISSION',
        message: 'You may only grant insurance channel access if you hold it.',
      });
    }
    await assignmentRepo.save(
      assignmentRepo.create({
        company_user_id: membership.id,
        permission_id: permission.id,
        data_scope: QuotationPolicyDataScope.USER,
        scope_branch_id: null,
        scope_department_id: null,
      }),
    );
  }

  /** Branch/department-targeted grants must keep pointing at assignments the user holds. */
  private async assertGrantTargetsStillAssigned(
    manager: EntityManager,
    membershipId: string,
  ): Promise<void> {
    const orphaned: Array<{ id: string }> = await manager.query(
      `
        SELECT grant_row.id
        FROM company_user_permissions grant_row
        WHERE grant_row.company_user_id = $1
          AND (
            (grant_row.scope_branch_id IS NOT NULL AND NOT EXISTS (
              SELECT 1 FROM branch_users bu
              WHERE bu.company_user_id = $1 AND bu.branch_id = grant_row.scope_branch_id))
            OR (grant_row.scope_department_id IS NOT NULL AND NOT EXISTS (
              SELECT 1 FROM department_users du
              WHERE du.company_user_id = $1 AND du.department_id = grant_row.scope_department_id))
          )
        LIMIT 1
      `,
      [membershipId],
    );
    if (orphaned.length) {
      throw new BadRequestException(
        'A permission grant targets a branch or department the user is no longer assigned to. Update or remove that grant first.',
      );
    }
  }

  private async findActiveMembership(
    manager: EntityManager,
    companyId: string,
    userId: string,
    lock = false,
  ): Promise<CompanyUser> {
    const qb = manager
      .getRepository(CompanyUser)
      .createQueryBuilder('membership')
      .where('membership.company_id = :companyId', { companyId })
      .andWhere('membership.user_id = :userId', { userId })
      .andWhere('membership.status = :status', { status: 'active' });
    if (lock) qb.setLock('pessimistic_write');

    const membership = await qb.getOne();
    if (!membership) {
      throw new NotFoundException('Active company membership was not found.');
    }
    return membership;
  }
}
