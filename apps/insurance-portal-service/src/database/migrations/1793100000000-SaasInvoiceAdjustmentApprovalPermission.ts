import { MigrationInterface, QueryRunner } from 'typeorm';

const PERMISSION = 'platform:saas-invoice-adjust-approve';

export class SaasInvoiceAdjustmentApprovalPermission1793100000000 implements MigrationInterface {
  name = 'SaasInvoiceAdjustmentApprovalPermission1793100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      INSERT INTO "permissions" (
        "id",
        "name",
        "display_name",
        "description",
        "is_system_generated",
        "assignment_scope",
        "assignable_to_company_role",
        "assignable_to_platform_role",
        "is_deprecated"
      )
      VALUES (
        uuid_generate_v4(),
        $1,
        'Approve SaaS invoice adjustments',
        'Approve SaaS invoice adjustments and run dunning actions that mutate invoice state.',
        true,
        'platform',
        false,
        true,
        false
      )
      ON CONFLICT ("name") DO NOTHING
    `,
      [PERMISSION],
    );

    await queryRunner.query(
      `
      INSERT INTO "permission_role" ("roles_id", "permissions_id")
      SELECT role."id", permission."id"
      FROM "roles" role
      CROSS JOIN "permissions" permission
      WHERE role."name" = 'OWNER'
        AND permission."name" = $1
      ON CONFLICT DO NOTHING
    `,
      [PERMISSION],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      DELETE FROM "permission_role" permission_role
      USING "permissions" permission
      WHERE permission_role."permissions_id" = permission."id"
        AND permission."name" = $1
    `,
      [PERMISSION],
    );

    await queryRunner.query(`DELETE FROM "permissions" WHERE "name" = $1`, [
      PERMISSION,
    ]);
  }
}
