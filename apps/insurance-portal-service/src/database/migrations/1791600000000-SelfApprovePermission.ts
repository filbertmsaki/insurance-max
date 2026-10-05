import { MigrationInterface, QueryRunner } from 'typeorm';

const SELF_APPROVE_PERMISSION = 'approvals:self-approve';
// Kept in step with the seed (001-initial-rbac.seed.ts).
const GRANTED_ROLES = ['ADMINISTRATOR', 'INSURANCE_ADMIN'];

export class SelfApprovePermission1791600000000 implements MigrationInterface {
  name = 'SelfApprovePermission1791600000000';

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
        'Self-approve (bypass maker-checker)',
        'Allow approving a quotation, endorsement or cancellation the user submitted themselves. Each self-approval is flagged in the approval history.',
        true,
        'shared',
        true,
        true,
        false
      )
      ON CONFLICT ("name") DO NOTHING
    `,
      [SELF_APPROVE_PERMISSION],
    );

    await queryRunner.query(
      `
      INSERT INTO "permission_role" ("roles_id", "permissions_id")
      SELECT role."id", permission."id"
      FROM "roles" role
      CROSS JOIN "permissions" permission
      WHERE role."name" = ANY($2)
        AND permission."name" = $1
      ON CONFLICT DO NOTHING
    `,
      [SELF_APPROVE_PERMISSION, GRANTED_ROLES],
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
      [SELF_APPROVE_PERMISSION],
    );

    await queryRunner.query(`DELETE FROM "permissions" WHERE "name" = $1`, [
      SELF_APPROVE_PERMISSION,
    ]);
  }
}
