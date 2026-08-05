import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PermissionAssignmentScope } from '@insurance-max/contracts';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  assertCanMutateSystemGeneratedRbacRecord,
  hasOwnerRole,
} from '@insurance-max/portal-shared/utils/system-generated-rbac.util';
import { ensureCompanyScopedActor } from '@insurance-max/portal-shared/utils/scoped-rbac.util';
import { isDuplicateEntryError } from '@insurance-max/portal-shared/utils/db-error.util';
import { AuditService } from '../../shared/audit/audit.service';
import { AuthorizationVersionService } from '../../shared/authorization/authorization-version.service';
import { CreatePermissionDto } from './dtos/create-permission.dto';
import { UpdatePermissionDto } from './dtos/update-permission.dto';
import { Permission } from './entities/permission.entity';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionsRepository: Repository<Permission>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly authorizationVersionService: AuthorizationVersionService,
  ) {}

  private createBaseQuery() {
    return this.permissionsRepository.createQueryBuilder('permission');
  }

  private async findAccessiblePermissionOrFail(
    id: string,
    actor?: AuthenticatedUser,
  ): Promise<Permission> {
    void actor;

    const permission = await this.createBaseQuery()
      .where('permission.id = :id', { id })
      .getOne();

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    return permission;
  }

  private assertCanManagePermissions(actor?: AuthenticatedUser): void {
    if (!hasOwnerRole(actor)) {
      throw new ForbiddenException(
        'Only users with the OWNER role can modify permissions',
      );
    }
  }

  async create(
    createPermissionDto: CreatePermissionDto,
    actor?: AuthenticatedUser,
  ): Promise<Permission> {
    this.assertCanManagePermissions(actor);

    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Permission);

      const permission = repository.create({
        name: createPermissionDto.name,
        display_name: createPermissionDto.display_name,
        description: createPermissionDto.description ?? null,
        assignment_scope: createPermissionDto.assignment_scope,
        assignable_to_company_role:
          createPermissionDto.assignable_to_company_role,
        assignable_to_platform_role:
          createPermissionDto.assignable_to_platform_role,
        is_system_generated: false,
      });

      let saved: Permission;
      try {
        saved = await repository.save(permission);
      } catch (error) {
        if (isDuplicateEntryError(error)) {
          throw new ConflictException('Permission name already exists');
        }
        throw error;
      }

      await this.auditService.logCritical(
        {
          userId: actor?.id,
          companyId: actor?.companyId,
          companyMembershipId: actor?.companyMembershipId,
          sessionId: actor?.sessionId,
          action: 'permission.created',
          eventCategory: 'authorization',
          resource: 'permission',
          resourceId: saved.id,
          afterState: {
            name: saved.name,
            display_name: saved.display_name,
            assignment_scope: saved.assignment_scope,
            assignable_to_company_role: saved.assignable_to_company_role,
            assignable_to_platform_role: saved.assignable_to_platform_role,
          },
        },
        manager,
      );

      return saved;
    });
  }

  /**
   * Filter visible permissions (spec 3.17). Company actors may only read
   * assignable, non-deprecated tenant/shared permissions.
   */
  async findAll(actor?: AuthenticatedUser): Promise<Permission[]> {
    const query = this.createBaseQuery()
      .where('permission.is_deprecated = false')
      .orderBy('permission.name', 'ASC');

    if (hasOwnerRole(actor) && actor?.scope === 'platform') {
      return query.getMany();
    }

    ensureCompanyScopedActor(actor);

    query.andWhere(
      `
        permission.assignable_to_company_role = true
        AND permission.assignment_scope IN (:tenantScope, :sharedScope)
      `,
      {
        tenantScope: PermissionAssignmentScope.TENANT,
        sharedScope: PermissionAssignmentScope.SHARED,
      },
    );

    return query.getMany();
  }

  async findOne(id: string, actor?: AuthenticatedUser): Promise<Permission> {
    return this.findAccessiblePermissionOrFail(id, actor);
  }

  async update(
    id: string,
    updatePermissionDto: UpdatePermissionDto,
    actor?: AuthenticatedUser,
  ): Promise<Permission> {
    this.assertCanManagePermissions(actor);

    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Permission);

      const permission = await repository.findOne({ where: { id } });

      if (!permission) {
        throw new NotFoundException('Permission not found');
      }

      assertCanMutateSystemGeneratedRbacRecord(
        actor,
        permission,
        'permission',
      );

      const beforeState = {
        name: permission.name,
        display_name: permission.display_name,
        description: permission.description,
        assignment_scope: permission.assignment_scope,
        assignable_to_company_role: permission.assignable_to_company_role,
        assignable_to_platform_role: permission.assignable_to_platform_role,
      };

      permission.name = updatePermissionDto.name ?? permission.name;
      permission.display_name =
        updatePermissionDto.display_name ?? permission.display_name;
      permission.description =
        updatePermissionDto.description !== undefined
          ? (updatePermissionDto.description ?? null)
          : permission.description;
      permission.assignment_scope =
        updatePermissionDto.assignment_scope ?? permission.assignment_scope;
      permission.assignable_to_company_role =
        updatePermissionDto.assignable_to_company_role ??
        permission.assignable_to_company_role;
      permission.assignable_to_platform_role =
        updatePermissionDto.assignable_to_platform_role ??
        permission.assignable_to_platform_role;

      const saved = await repository.save(permission);

      await this.authorizationVersionService.bumpForPermission(
        saved.id,
        manager,
      );

      await this.auditService.logCritical(
        {
          userId: actor?.id,
          companyId: actor?.companyId,
          companyMembershipId: actor?.companyMembershipId,
          sessionId: actor?.sessionId,
          action: 'permission.updated',
          eventCategory: 'authorization',
          resource: 'permission',
          resourceId: saved.id,
          beforeState,
          afterState: {
            name: saved.name,
            display_name: saved.display_name,
            description: saved.description,
            assignment_scope: saved.assignment_scope,
            assignable_to_company_role: saved.assignable_to_company_role,
            assignable_to_platform_role: saved.assignable_to_platform_role,
          },
        },
        manager,
      );

      return saved;
    });
  }

  /**
   * Prevent deletion of assigned permissions (spec 3.16).
   */
  async remove(id: string, actor?: AuthenticatedUser): Promise<void> {
    this.assertCanManagePermissions(actor);

    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Permission);

      const permission = await repository.findOne({ where: { id } });

      if (!permission) {
        throw new NotFoundException('Permission not found');
      }

      assertCanMutateSystemGeneratedRbacRecord(
        actor,
        permission,
        'permission',
      );

      const result = await manager.query(
        `
          SELECT
            (
              SELECT count(*) FROM "permission_role" WHERE "permissions_id" = $1
            ) +
            (
              SELECT count(*) FROM "permission_user" WHERE "permissions_id" = $1
            ) +
            (
              SELECT count(*) FROM "company_user_permissions" WHERE "permission_id" = $1
            ) AS count
        `,
        [id],
      );

      if (Number(result[0]?.count ?? 0) > 0) {
        throw new ConflictException(
          'The permission cannot be deleted while it is assigned.',
        );
      }

      await repository.remove(permission);

      await this.auditService.logCritical(
        {
          userId: actor?.id,
          companyId: actor?.companyId,
          companyMembershipId: actor?.companyMembershipId,
          sessionId: actor?.sessionId,
          action: 'permission.deleted',
          eventCategory: 'authorization',
          resource: 'permission',
          resourceId: id,
          beforeState: {
            name: permission.name,
            display_name: permission.display_name,
          },
        },
        manager,
      );
    });
  }
}
