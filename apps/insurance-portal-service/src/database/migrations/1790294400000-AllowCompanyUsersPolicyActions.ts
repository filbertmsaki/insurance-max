import { MigrationInterface, QueryRunner } from 'typeorm';

const COMPANY_USER_POLICY_PERMISSIONS = [
  'policies:read',
  'policy-transactions:read',
  'endorsements:create',
  'endorsements:update-draft',
  'endorsements:complete',
  'endorsements:submit-tiramis',
  'cancellations:read',
  'cancellations:create',
  'cancellations:complete',
  'cancellations:submit-tiramis',
];

export class AllowCompanyUsersPolicyActions1790294400000 implements MigrationInterface {
  name = 'AllowCompanyUsersPolicyActions1790294400000';

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
      [COMPANY_USER_POLICY_PERMISSIONS],
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
      [COMPANY_USER_POLICY_PERMISSIONS],
    );
  }
}
