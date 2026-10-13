import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  IsNull,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { paginateQueryBuilder } from '@insurance-max/portal-shared/utils/paginate-query.util';
import { RoleScope } from '@insurance-max/contracts';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  assertCanManageScopedRbacRecord,
  ensureCompanyScopedActor,
  resolveScopedRbacCompanyId,
} from '@insurance-max/portal-shared/utils/scoped-rbac.util';
import {
  assertCanCreateSystemGeneratedRbacRecord,
  assertCanMutateSystemGeneratedRbacRecord,
  hasOwnerRole,
  isReservedPlatformRoleName,
} from '@insurance-max/portal-shared/utils/system-generated-rbac.util';
import { Company } from '../companies/entities/company.entity';
import { Permission } from '../permissions/entities/permission.entity';
import { AuditService } from '../../shared/audit/audit.service';
import { AuthorizationVersionService } from '../../shared/authorization/authorization-version.service';
import { CreateRoleDto } from './dtos/create-role.dto';
import { FindRolesQueryDto } from './dtos/find-roles-query.dto';
import { UpdateRoleDto } from './dtos/update-role.dto';
import { Role } from './entities/role.entity';
import { RolePermissionScope } from './entities/role-permission-scope.entity';
import { QuotationPolicyDataScope } from '../../shared/authorization/quotation-policy-data-scope.enum';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionsRepository: Repository<Permission>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly authorizationVersionService: AuthorizationVersionService,
  ) {}

  private createBaseQuery() {
    return this.rolesRepository
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.company', 'company')
      .leftJoinAndSelect('role.permissions', 'permission')
      .leftJoinAndSelect('role.permission_data_scopes', 'permissionScope')
      .distinct(true);
  }

  private async assertCompanyExists(companyId: string): Promise<void> {
    const company = await this.companyRepository.findOne({
      where: { id: companyId, status: 'active' },
      select: { id: true },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }
  }

  private async findAccessibleRoleOrFail(
    id: string,
    actor?: AuthenticatedUser,
  ): Promise<Role> {
    const query = this.createBaseQuery().where('role.id = :id', { id });

    if (!hasOwnerRole(actor)) {
      const companyActor = ensureCompanyScopedActor(actor);
      query.andWhere(
        `
          (
            role.scope = :templateScope
            AND role.company_id IS NULL
          )
          OR
          (
            role.scope = :tenantScope
            AND role.company_id = :companyId
          )
        `,
        {
          templateScope: RoleScope.TENANT_TEMPLATE,
          tenantScope: RoleScope.TENANT,
          companyId: companyActor.companyId,
        },
      );
    }

    const role = await query.getOne();

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  /**
   * Restrict permission assignment by role scope (spec 3.14).
   */
  private async resolvePermissions(
    permissionIds: string[],
    roleScope: RoleScope,
    manager?: EntityManager,
  ): Promise<Permission[]> {
    const ids = Array.from(new Set(permissionIds));

    if (!ids.length) {
      return [];
    }

    const repository =
      manager?.getRepository(Permission) ?? this.permissionsRepository;

    const permissions = await repository.find({
      where: ids.map((id) => ({ id })),
    });

    if (permissions.length !== ids.length) {
      throw new NotFoundException('One or more permissions were not found.');
    }

    const companyRole =
      roleScope === RoleScope.TENANT || roleScope === RoleScope.TENANT_TEMPLATE;

    const invalid = permissions.filter(
      (permission) =>
        permission.is_deprecated ||
        (companyRole && !permission.assignable_to_company_role) ||
        (roleScope === RoleScope.PLATFORM &&
          !permission.assignable_to_platform_role),
    );

    if (invalid.length > 0) {
      throw new ForbiddenException({
        code: 'PERMISSION_NOT_ASSIGNABLE',
        message:
          'One or more permissions cannot be assigned to this role type.',
        details: {
          permissions: invalid.map((permission) => ({
            id: permission.id,
            name: permission.name,
            assignmentScope: permission.assignment_scope,
          })),
        },
      });
    }

    return permissions;
  }

  /**
   * Resolve role scope during creation (spec 3.14).
   */
  private resolveRoleScope(
    actor: AuthenticatedUser | undefined,
    dto: CreateRoleDto,
  ): { scope: RoleScope; companyId: string | null } {
    const platformOwner = hasOwnerRole(actor) && actor?.scope === 'platform';

    if (platformOwner) {
      const scope =
        dto.scope ?? (dto.company_id ? RoleScope.TENANT : RoleScope.PLATFORM);

      if (scope === RoleScope.TENANT && !dto.company_id) {
        throw new BadRequestException('A tenant role requires company_id.');
      }

      if (scope !== RoleScope.TENANT && dto.company_id) {
        throw new BadRequestException(
          'Platform and tenant-template roles cannot contain company_id.',
        );
      }

      return { scope, companyId: dto.company_id ?? null };
    }

    const companyActor = ensureCompanyScopedActor(actor);

    if (dto.scope && dto.scope !== RoleScope.TENANT) {
      throw new ForbiddenException(
        'Company users can only create company-scoped roles.',
      );
    }

    if (dto.is_system_generated || dto.is_administrative) {
      throw new ForbiddenException(
        'Company users cannot create protected or administrative roles.',
      );
    }

    return { scope: RoleScope.TENANT, companyId: companyActor.companyId };
  }

  /**
   * Company role names become the role names in that company's tokens, so a
   * tenant role may never impersonate a platform role such as OWNER.
   */
  private assertTenantRoleName(name: string | undefined) {
    if (isReservedPlatformRoleName(name)) {
      throw new ForbiddenException(
        `"${name?.trim()}" is reserved for platform roles`,
      );
    }
  }

  async create(
    createRoleDto: CreateRoleDto,
    actor?: AuthenticatedUser,
  ): Promise<Role> {
    assertCanCreateSystemGeneratedRbacRecord(
      actor,
      createRoleDto.is_system_generated,
      'role',
    );

    const { scope, companyId } = this.resolveRoleScope(actor, createRoleDto);

    if (companyId !== null) {
      this.assertTenantRoleName(createRoleDto.name);
      await this.assertCompanyExists(companyId);
    }

    return this.dataSource.transaction(async (manager) => {
      const permissions = await this.resolvePermissions(
        createRoleDto.permission_ids ?? [],
        scope,
        manager,
      );

      const roleRepository = manager.getRepository(Role);

      const role = roleRepository.create({
        name: createRoleDto.name,
        display_name: createRoleDto.display_name,
        description: createRoleDto.description ?? null,
        company_id: companyId,
        scope,
        is_system_generated: createRoleDto.is_system_generated ?? false,
        is_administrative: createRoleDto.is_administrative ?? false,
        permissions,
      });

      const saved = await roleRepository.save(role);

      await this.replacePermissionDataScopes(
        manager,
        saved.id,
        permissions.map((permission) => permission.id),
        createRoleDto.permission_data_scopes,
      );

      await this.auditService.logCritical(
        {
          userId: actor?.id,
          companyId: actor?.companyId,
          companyMembershipId: actor?.companyMembershipId,
          sessionId: actor?.sessionId,
          action: 'role.created',
          eventCategory: 'authorization',
          resource: 'role',
          resourceId: saved.id,
          afterState: {
            name: saved.name,
            display_name: saved.display_name,
            description: saved.description,
            scope: saved.scope,
            company_id: saved.company_id,
            permission_ids: saved.permissions.map(
              (permission) => permission.id,
            ),
            permission_data_scopes: createRoleDto.permission_data_scopes ?? [],
          },
        },
        manager,
      );

      return saved;
    });
  }

  /**
   * Company actors may read tenant-template roles but not modify them (spec 3.14).
   */
  async findAll(actor?: AuthenticatedUser): Promise<Role[]> {
    const query = this.createBaseQuery().orderBy('role.display_name', 'ASC');
    this.applyVisibilityScope(query, actor);
    return query.getMany();
  }

  /** Server-side table listing; same visibility rules as findAll. */
  async findPage(actor: AuthenticatedUser, query: FindRolesQueryDto) {
    const qb = this.createBaseQuery();
    this.applyVisibilityScope(qb, actor);
    if (query.scope) {
      qb.andWhere('role.scope = :filterScope', { filterScope: query.scope });
    }
    return paginateQueryBuilder(qb, query, {
      sortable: {
        display_name: 'role.display_name',
        name: 'role.name',
        scope: 'role.scope',
        created_at: 'role.created_at',
      },
      defaultSort: 'display_name',
      defaultOrder: 'ASC',
      searchable: ['role.name', 'role.display_name', 'role.description'],
      tieBreaker: 'role.id',
    });
  }

  private applyVisibilityScope(
    query: SelectQueryBuilder<Role>,
    actor?: AuthenticatedUser,
  ): void {
    if (hasOwnerRole(actor) && actor?.scope === 'platform') {
      return;
    }

    const companyActor = ensureCompanyScopedActor(actor);

    query.andWhere(
      `(
        (
          role.scope = :templateScope
          AND role.company_id IS NULL
        )
        OR
        (
          role.scope = :tenantScope
          AND role.company_id = :companyId
        )
      )`,
      {
        templateScope: RoleScope.TENANT_TEMPLATE,
        tenantScope: RoleScope.TENANT,
        companyId: companyActor.companyId,
      },
    );
  }

  async findOne(id: string, actor?: AuthenticatedUser): Promise<Role> {
    return this.findAccessibleRoleOrFail(id, actor);
  }

  async findOneByName(
    name: string,
    companyId: string | null = null,
  ): Promise<Role> {
    const role = await this.rolesRepository.findOne({
      where: {
        name,
        company_id: companyId === null ? IsNull() : companyId,
      },
      relations: { company: true, permissions: true },
    });

    if (!role) {
      throw new NotFoundException(`Role with name "${name}" not found`);
    }

    return role;
  }

  private resolveUpdatedCompanyId(
    actor: AuthenticatedUser | undefined,
    role: Role,
    requestedCompanyId: string | undefined,
  ): string | null {
    if (requestedCompanyId === undefined) {
      return role.company_id;
    }

    if (hasOwnerRole(actor)) {
      return requestedCompanyId;
    }

    const companyActor = ensureCompanyScopedActor(actor);

    if (requestedCompanyId !== companyActor.companyId) {
      throw new ForbiddenException(
        'You can only keep roles in your active company',
      );
    }

    return companyActor.companyId;
  }

  /**
   * Transactional role update with audit trail (spec 3.15).
   */
  async update(
    id: string,
    updateRoleDto: UpdateRoleDto,
    actor?: AuthenticatedUser,
  ): Promise<Role> {
    return this.dataSource.transaction(async (manager) => {
      const roleRepository = manager.getRepository(Role);

      const role = await roleRepository.findOne({
        where: { id },
        relations: { permissions: true, permission_data_scopes: true },
      });

      if (!role) {
        throw new NotFoundException('Role not found.');
      }

      assertCanManageScopedRbacRecord(actor, role, 'role');
      assertCanMutateSystemGeneratedRbacRecord(actor, role, 'role');

      if (role.scope === RoleScope.TENANT_TEMPLATE && !hasOwnerRole(actor)) {
        throw new ForbiddenException(
          'Tenant-template roles can only be modified by the platform owner.',
        );
      }

      assertCanCreateSystemGeneratedRbacRecord(
        actor,
        updateRoleDto.is_system_generated,
        'role',
      );

      const beforeState = {
        name: role.name,
        display_name: role.display_name,
        description: role.description,
        scope: role.scope,
        company_id: role.company_id,
        permission_ids: role.permissions.map((permission) => permission.id),
        permission_data_scopes: (role.permission_data_scopes ?? []).map(
          ({ permission_id, data_scope }) => ({ permission_id, data_scope }),
        ),
      };

      if (
        updateRoleDto.scope !== undefined &&
        updateRoleDto.scope !== role.scope
      ) {
        const assignments = await manager.query(
          `
            SELECT
              (
                SELECT count(*) FROM "company_user_roles" WHERE "role_id" = $1
              ) +
              (
                SELECT count(*) FROM "role_user" WHERE "roles_id" = $1
              ) AS count
          `,
          [role.id],
        );

        if (Number(assignments[0]?.count ?? 0) > 0) {
          throw new ConflictException(
            'Role scope cannot be changed while the role is assigned.',
          );
        }

        if (!hasOwnerRole(actor)) {
          throw new ForbiddenException(
            'Only the platform owner can change role scope.',
          );
        }

        role.scope = updateRoleDto.scope;
      }

      const updatedCompanyId = this.resolveUpdatedCompanyId(
        actor,
        role,
        updateRoleDto.company_id,
      );

      if (updatedCompanyId !== null) {
        await this.assertCompanyExists(updatedCompanyId);
      }

      if (updateRoleDto.permission_ids !== undefined) {
        role.permissions = await this.resolvePermissions(
          updateRoleDto.permission_ids,
          role.scope,
          manager,
        );
      }

      if (updateRoleDto.permission_data_scopes !== undefined) {
        await this.replacePermissionDataScopes(
          manager,
          role.id,
          (role.permissions ?? []).map((permission) => permission.id),
          updateRoleDto.permission_data_scopes,
        );
      } else if (updateRoleDto.permission_ids !== undefined) {
        const currentIds = (role.permissions ?? []).map(
          (permission) => permission.id,
        );
        const scopeRepository = manager.getRepository(RolePermissionScope);
        if (currentIds.length) {
          await scopeRepository
            .createQueryBuilder()
            .delete()
            .where('role_id = :roleId', { roleId: role.id })
            .andWhere('permission_id NOT IN (:...permissionIds)', {
              permissionIds: currentIds,
            })
            .execute();
        } else {
          await scopeRepository.delete({ role_id: role.id });
        }
      }

      if (updateRoleDto.name !== undefined && role.company_id !== null) {
        this.assertTenantRoleName(updateRoleDto.name);
      }
      role.name = updateRoleDto.name ?? role.name;
      role.display_name = updateRoleDto.display_name ?? role.display_name;
      role.description =
        updateRoleDto.description !== undefined
          ? (updateRoleDto.description ?? null)
          : role.description;
      role.company_id = updatedCompanyId;

      if (updateRoleDto.is_system_generated !== undefined) {
        role.is_system_generated = updateRoleDto.is_system_generated;
      }

      if (updateRoleDto.is_administrative !== undefined) {
        if (!hasOwnerRole(actor)) {
          throw new ForbiddenException(
            'Only the platform owner can classify administrative roles.',
          );
        }

        role.is_administrative = updateRoleDto.is_administrative;
      }

      const saved = await roleRepository.save(role);

      const savedScopes = await manager
        .getRepository(RolePermissionScope)
        .find({
          where: { role_id: saved.id },
        });

      await this.authorizationVersionService.bumpForRole(saved.id, manager);

      await this.auditService.logCritical(
        {
          userId: actor?.id,
          companyId: actor?.companyId,
          companyMembershipId: actor?.companyMembershipId,
          sessionId: actor?.sessionId,
          action: 'role.updated',
          eventCategory: 'authorization',
          resource: 'role',
          resourceId: saved.id,
          beforeState,
          afterState: {
            name: saved.name,
            display_name: saved.display_name,
            description: saved.description,
            scope: saved.scope,
            company_id: saved.company_id,
            permission_ids: saved.permissions.map(
              (permission) => permission.id,
            ),
            permission_data_scopes: savedScopes.map(
              ({ permission_id, data_scope }) => ({
                permission_id,
                data_scope,
              }),
            ),
          },
        },
        manager,
      );

      return saved;
    });
  }

  private async replacePermissionDataScopes(
    manager: EntityManager,
    roleId: string,
    permissionIds: string[],
    assignments: Array<{
      permission_id: string;
      data_scope: QuotationPolicyDataScope;
    }> = [],
  ): Promise<void> {
    const permissionSet = new Set(permissionIds);
    const configuredIds = assignments.map(
      (assignment) => assignment.permission_id,
    );
    if (
      new Set(configuredIds).size !== configuredIds.length ||
      configuredIds.some((id) => !permissionSet.has(id))
    ) {
      throw new BadRequestException(
        'Permission scopes must be unique and reference permissions assigned to this role.',
      );
    }

    const repository = manager.getRepository(RolePermissionScope);
    await repository.delete({ role_id: roleId });
    if (assignments.length) {
      await repository.save(
        assignments.map((assignment) =>
          repository.create({
            role_id: roleId,
            permission_id: assignment.permission_id,
            data_scope: assignment.data_scope,
            scope_branch_id: null,
            scope_department_id: null,
          }),
        ),
      );
    }
  }

  /**
   * Prevent deletion of assigned roles (spec 3.16), transactional + audited.
   */
  async remove(id: string, actor?: AuthenticatedUser): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      const roleRepository = manager.getRepository(Role);

      const role = await this.findAccessibleRoleOrFail(id, actor);

      assertCanMutateSystemGeneratedRbacRecord(actor, role, 'role');
      assertCanManageScopedRbacRecord(actor, role, 'role');

      const result = await manager.query(
        `
          SELECT
            (
              SELECT count(*) FROM "company_user_roles" WHERE "role_id" = $1
            ) +
            (
              SELECT count(*) FROM "role_user" WHERE "roles_id" = $1
            ) AS count
        `,
        [id],
      );

      if (Number(result[0]?.count ?? 0) > 0) {
        throw new ConflictException(
          'The role cannot be deleted while it is assigned to users.',
        );
      }

      await roleRepository.remove(role);

      await this.auditService.logCritical(
        {
          userId: actor?.id,
          companyId: actor?.companyId,
          companyMembershipId: actor?.companyMembershipId,
          sessionId: actor?.sessionId,
          action: 'role.deleted',
          eventCategory: 'authorization',
          resource: 'role',
          resourceId: id,
          beforeState: {
            name: role.name,
            display_name: role.display_name,
            scope: role.scope,
            company_id: role.company_id,
          },
        },
        manager,
      );
    });
  }
}
