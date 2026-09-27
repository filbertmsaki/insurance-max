import { MigrationInterface, QueryRunner } from 'typeorm';

const SELECT_INSURANCE_CHANNEL_PERMISSION =
  'quotations:select-insurance-channel';

export class InsuranceChannelSelectionPermission1790500000000 implements MigrationInterface {
  name = 'InsuranceChannelSelectionPermission1790500000000';

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
        'Select Quotation Insurance Channel',
        'Allow selecting Agency, Broker, Bancassurance, or API insurance channels on quotations and related policy issuance flows.',
        true,
        'shared',
        true,
        true,
        false
      )
      ON CONFLICT ("name") DO NOTHING
    `,
      [SELECT_INSURANCE_CHANNEL_PERMISSION],
    );

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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      DELETE FROM "permission_role" permission_role
      USING "permissions" permission
      WHERE permission_role."permissions_id" = permission."id"
        AND permission."name" = $1
    `,
      [SELECT_INSURANCE_CHANNEL_PERMISSION],
    );

    await queryRunner.query(`DELETE FROM "permissions" WHERE "name" = $1`, [
      SELECT_INSURANCE_CHANNEL_PERMISSION,
    ]);
  }
}
