import { MigrationInterface, QueryRunner } from 'typeorm';

const COMPANY_USER_DASHBOARD_PERMISSIONS = [
  'dashboard:overview',
  'dashboard:sales',
  'dashboard:policies',
  'dashboard:tasks',
];

export class AllowCompanyUsersDashboardAccess1790294600000 implements MigrationInterface {
  name = 'AllowCompanyUsersDashboardAccess1790294600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      INSERT INTO "permission_role" ("roles_id", "permissions_id")
      SELECT role."id", permission."id"
      FROM "roles" role
      CROSS JOIN "permissions" permission
      WHERE role."name" = 'USER'
        AND (
          role."company_id" IS NOT NULL
          OR role."scope" = 'tenant_template'
        )
        AND permission."name" = ANY($1)
      ON CONFLICT DO NOTHING
    `,
      [COMPANY_USER_DASHBOARD_PERMISSIONS],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      DELETE FROM "permission_role" permission_role
      USING "roles" role, "permissions" permission
      WHERE permission_role."roles_id" = role."id"
        AND permission_role."permissions_id" = permission."id"
        AND role."name" = 'USER'
        AND (
          role."company_id" IS NOT NULL
          OR role."scope" = 'tenant_template'
        )
        AND permission."name" = ANY($1)
    `,
      [COMPANY_USER_DASHBOARD_PERMISSIONS],
    );
  }
}
