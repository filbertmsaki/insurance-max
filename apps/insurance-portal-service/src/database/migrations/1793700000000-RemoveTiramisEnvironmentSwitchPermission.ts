import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveTiramisEnvironmentSwitchPermission1793700000000 implements MigrationInterface {
  name = 'RemoveTiramisEnvironmentSwitchPermission1793700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "permission_role" pr
      USING "permissions" p
      WHERE pr."permissions_id" = p."id"
        AND p."name" = 'platform:tiramis-integration:switch-environment'`);

    await queryRunner.query(`
      DELETE FROM "permissions"
      WHERE "name" = 'platform:tiramis-integration:switch-environment'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "permissions" (
        "id", "name", "display_name", "description", "is_system_generated",
        "assignment_scope", "assignable_to_company_role",
        "assignable_to_platform_role", "is_deprecated"
      )
      VALUES (
        uuid_generate_v4(),
        'platform:tiramis-integration:switch-environment',
        'Switch TIRAMIS environment',
        'Switch the platform-wide active TIRA environment between UAT and Production.',
        true,
        'platform',
        false,
        true,
        true
      )
      ON CONFLICT ("name") DO NOTHING`);
  }
}
