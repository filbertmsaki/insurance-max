import { MigrationInterface, QueryRunner } from 'typeorm';

const SELECT_INSURANCE_CHANNEL_PERMISSION =
  'quotations:select-insurance-channel';

/**
 * Insurance channel selection becomes a per-user grant (company membership
 * permission) instead of a role permission. Members who currently hold it
 * through a role keep it as a direct grant, then the role links are removed.
 */
export class InsuranceChannelAccessPerUser1791300000000 implements MigrationInterface {
  name = 'InsuranceChannelAccessPerUser1791300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      INSERT INTO "company_user_permissions" ("id", "company_user_id", "permission_id")
      SELECT DISTINCT ON (membership_role."company_user_id")
        uuid_generate_v4(), membership_role."company_user_id", permission."id"
      FROM "company_user_roles" membership_role
      JOIN "permission_role" permission_role
        ON permission_role."roles_id" = membership_role."role_id"
      JOIN "permissions" permission
        ON permission."id" = permission_role."permissions_id"
      WHERE permission."name" = $1
      ON CONFLICT ("company_user_id", "permission_id") DO NOTHING
    `,
      [SELECT_INSURANCE_CHANNEL_PERMISSION],
    );

    await queryRunner.query(
      `
      DELETE FROM "permission_role" permission_role
      USING "permissions" permission
      WHERE permission_role."permissions_id" = permission."id"
        AND permission."name" = $1
    `,
      [SELECT_INSURANCE_CHANNEL_PERMISSION],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      INSERT INTO "permission_role" ("roles_id", "permissions_id")
      SELECT role."id", permission."id"
      FROM "roles" role
      CROSS JOIN "permissions" permission
      WHERE role."is_administrative" = true
        AND permission."name" = $1
      ON CONFLICT DO NOTHING
    `,
      [SELECT_INSURANCE_CHANNEL_PERMISSION],
    );
  }
}
