import { MigrationInterface, QueryRunner } from 'typeorm';

const ENVIRONMENT_COLUMNS: Array<[string, string]> = [
  ['tiramis_company_configurations', 'environment'],
  ['tiramis_platform_settings', 'active_environment'],
  ['tiramis_submission_tracking', 'tiramis_environment'],
];

export class UatProductionOnlyTiraEnvironment1793600000000 implements MigrationInterface {
  name = 'UatProductionOnlyTiraEnvironment1793600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const activeEnvironment = this.activeEnvironment();

    for (const [table, column] of ENVIRONMENT_COLUMNS) {
      await this.normalizeEnvironmentColumn(queryRunner, table, column);
    }

    if (await queryRunner.hasTable('tiramis_company_configurations')) {
      await queryRunner.query(
        `UPDATE "tiramis_company_configurations" SET "environment" = $1`,
        [activeEnvironment],
      );
    }

    if (await queryRunner.hasTable('tiramis_platform_settings')) {
      await queryRunner.query(
        `UPDATE "tiramis_platform_settings"
         SET "active_environment" = $1`,
        [activeEnvironment],
      );
    }

    await queryRunner.query(`
      UPDATE "companies"
      SET "settings" = "settings" - 'tiramis_target_environment'
      WHERE "settings" ? 'tiramis_target_environment'`);

    await this.addAllowedEnvironmentChecks(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_company_configurations" DROP CONSTRAINT IF EXISTS "CHK_tiramis_company_configurations_environment_uat_production"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_platform_settings" DROP CONSTRAINT IF EXISTS "CHK_tiramis_platform_settings_active_environment_uat_production"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" DROP CONSTRAINT IF EXISTS "CHK_tiramis_submission_tracking_environment_uat_production"`,
    );
  }

  private activeEnvironment(): 'uat' | 'production' {
    return process.env.TIRA_ENV?.trim().toLowerCase() === 'production'
      ? 'production'
      : 'uat';
  }

  private async normalizeEnvironmentColumn(
    queryRunner: QueryRunner,
    table: string,
    column: string,
  ): Promise<void> {
    if (!(await queryRunner.hasColumn(table, column))) return;

    await queryRunner.query(`
      UPDATE "${table}"
      SET "${column}" = CASE
        WHEN "${column}" IN ('test', 'local') THEN 'uat'
        WHEN "${column}" = 'live' THEN 'production'
        ELSE "${column}"
      END
      WHERE "${column}" IN ('test', 'local', 'live')`);
  }

  private async addAllowedEnvironmentChecks(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tiramis_company_configurations"
      DROP CONSTRAINT IF EXISTS "CHK_tiramis_company_configurations_environment_uat_production"`);
    await queryRunner.query(`
      ALTER TABLE "tiramis_company_configurations"
      ADD CONSTRAINT "CHK_tiramis_company_configurations_environment_uat_production"
      CHECK ("environment" IN ('uat', 'production'))`);

    await queryRunner.query(`
      ALTER TABLE "tiramis_platform_settings"
      DROP CONSTRAINT IF EXISTS "CHK_tiramis_platform_settings_active_environment_uat_production"`);
    await queryRunner.query(`
      ALTER TABLE "tiramis_platform_settings"
      ADD CONSTRAINT "CHK_tiramis_platform_settings_active_environment_uat_production"
      CHECK ("active_environment" IN ('uat', 'production'))`);

    await queryRunner.query(`
      ALTER TABLE "tiramis_submission_tracking"
      DROP CONSTRAINT IF EXISTS "CHK_tiramis_submission_tracking_environment_uat_production"`);
    await queryRunner.query(`
      ALTER TABLE "tiramis_submission_tracking"
      ADD CONSTRAINT "CHK_tiramis_submission_tracking_environment_uat_production"
      CHECK ("tiramis_environment" IS NULL OR "tiramis_environment" IN ('uat', 'production'))`);
  }
}
