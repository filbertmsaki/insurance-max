import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Motor Insurance (New) pilot gate (MF-1). Additive only.
 *
 * Inserts the permission without granting it to any role or user: pilot users
 * receive it as a per-user grant. Frozen values on purpose.
 */
const PERMISSION = {
  name: 'underwrite.motor-unified.preview',
  displayName: 'Motor Insurance (New): pilot access',
  description:
    'Show the unified Motor Insurance module during the pilot. Data access still requires the Motor or Fleet line permissions.',
};

export class MotorInsurancePreviewPermission1795700000000 implements MigrationInterface {
  name = 'MotorInsurancePreviewPermission1795700000000';

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
      VALUES (uuid_generate_v4(), $1, $2, $3, true, 'shared', true, true, false)
      ON CONFLICT ("name") DO NOTHING
    `,
      [PERMISSION.name, PERMISSION.displayName, PERMISSION.description],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      DELETE FROM "company_user_permissions"
      WHERE "permission_id" IN (SELECT "id" FROM "permissions" WHERE "name" = $1)
    `,
      [PERMISSION.name],
    );
    await queryRunner.query(
      `
      DELETE FROM "permission_role"
      WHERE "permissions_id" IN (SELECT "id" FROM "permissions" WHERE "name" = $1)
    `,
      [PERMISSION.name],
    );
    await queryRunner.query(`DELETE FROM "permissions" WHERE "name" = $1`, [
      PERMISSION.name,
    ]);
  }
}
