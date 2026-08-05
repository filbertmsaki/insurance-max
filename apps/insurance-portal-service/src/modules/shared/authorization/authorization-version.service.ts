import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class AuthorizationVersionService {
  constructor(private readonly dataSource: DataSource) {}

  async bumpMembership(
    membershipId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const executor = manager ?? this.dataSource.manager;

    await executor.query(
      `
        UPDATE "company_users"
        SET "authorization_version" = "authorization_version" + 1, "updated_at" = now()
        WHERE "id" = $1
      `,
      [membershipId],
    );
  }

  async bumpUser(userId: string, manager?: EntityManager): Promise<void> {
    const executor = manager ?? this.dataSource.manager;

    await executor.query(
      `
        UPDATE "users"
        SET "authorization_version" = "authorization_version" + 1, "updated_at" = now()
        WHERE "id" = $1
      `,
      [userId],
    );
  }

  async bumpForRole(roleId: string, manager?: EntityManager): Promise<void> {
    const executor = manager ?? this.dataSource.manager;

    await executor.query(
      `
        UPDATE "company_users" membership
        SET "authorization_version" = membership."authorization_version" + 1, "updated_at" = now()
        WHERE EXISTS (
          SELECT 1 FROM "company_user_roles" assignment
          WHERE assignment."company_user_id" = membership."id"
            AND assignment."role_id" = $1
        )
      `,
      [roleId],
    );

    await executor.query(
      `
        UPDATE "users" app_user
        SET "authorization_version" = app_user."authorization_version" + 1, "updated_at" = now()
        WHERE EXISTS (
          SELECT 1 FROM "role_user" assignment
          WHERE assignment."users_id" = app_user."id"
            AND assignment."roles_id" = $1
        )
      `,
      [roleId],
    );
  }

  async bumpForPermission(
    permissionId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const executor = manager ?? this.dataSource.manager;

    await executor.query(
      `
        UPDATE "company_users" membership
        SET "authorization_version" = membership."authorization_version" + 1, "updated_at" = now()
        WHERE
          EXISTS (
            SELECT 1 FROM "company_user_permissions" direct_assignment
            WHERE direct_assignment."company_user_id" = membership."id"
              AND direct_assignment."permission_id" = $1
          )
          OR EXISTS (
            SELECT 1 FROM "company_user_roles" company_role
            INNER JOIN "permission_role" role_permission
              ON role_permission."roles_id" = company_role."role_id"
            WHERE company_role."company_user_id" = membership."id"
              AND role_permission."permissions_id" = $1
          )
      `,
      [permissionId],
    );

    await executor.query(
      `
        UPDATE "users" app_user
        SET "authorization_version" = app_user."authorization_version" + 1, "updated_at" = now()
        WHERE
          EXISTS (
            SELECT 1 FROM "permission_user" direct_assignment
            WHERE direct_assignment."users_id" = app_user."id"
              AND direct_assignment."permissions_id" = $1
          )
          OR EXISTS (
            SELECT 1 FROM "role_user" platform_role
            INNER JOIN "permission_role" role_permission
              ON role_permission."roles_id" = platform_role."roles_id"
            WHERE platform_role."users_id" = app_user."id"
              AND role_permission."permissions_id" = $1
          )
      `,
      [permissionId],
    );
  }
}
