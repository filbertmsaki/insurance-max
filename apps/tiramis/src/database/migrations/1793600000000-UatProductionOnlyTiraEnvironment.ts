import { MigrationInterface, QueryRunner } from 'typeorm';

const ENVIRONMENT_COLUMNS: Array<[string, string]> = [
  ['tiramis_api_keys', 'tenant_environment'],
  ['tiramis_callback_dead_letters', 'environment'],
  ['tiramis_callback_receipts', 'environment'],
  ['tiramis_client_configurations', 'environment'],
  ['tiramis_service_endpoints', 'environment'],
  ['tiramis_system_profiles', 'environment'],
  ['tiramis_transactions', 'environment'],
];

const SINGLETON_TABLES = [
  'tiramis_client_configurations',
  'tiramis_service_endpoints',
  'tiramis_system_profiles',
];

export class UatProductionOnlyTiraEnvironment1793600000000 implements MigrationInterface {
  name = 'UatProductionOnlyTiraEnvironment1793600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const activeEnvironment = this.activeEnvironment();

    for (const [table, column] of ENVIRONMENT_COLUMNS) {
      await this.normalizeEnvironmentColumn(queryRunner, table, column);
    }

    for (const table of SINGLETON_TABLES) {
      if (await queryRunner.hasTable(table)) {
        await queryRunner.query(
          `DELETE FROM "${table}" WHERE "environment" <> $1`,
          [activeEnvironment],
        );
        await queryRunner.query(`UPDATE "${table}" SET "environment" = $1`, [
          activeEnvironment,
        ]);
      }
    }

    await this.dedupeSystemProfiles(queryRunner, activeEnvironment);
    await this.dedupeServiceEndpoints(queryRunner);
    await this.normalizeApiKeys(queryRunner, activeEnvironment);
    await this.addAllowedEnvironmentChecks(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_system_profiles" DROP CONSTRAINT IF EXISTS "CHK_tiramis_system_profiles_environment_uat_production"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_service_endpoints" DROP CONSTRAINT IF EXISTS "CHK_tiramis_service_endpoints_environment_uat_production"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_client_configurations" DROP CONSTRAINT IF EXISTS "CHK_tiramis_client_configurations_environment_uat_production"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_api_keys" DROP CONSTRAINT IF EXISTS "CHK_tiramis_api_keys_tenant_environment_uat_production"`,
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

  private async dedupeSystemProfiles(
    queryRunner: QueryRunner,
    activeEnvironment: 'uat' | 'production',
  ): Promise<void> {
    if (!(await queryRunner.hasTable('tiramis_system_profiles'))) return;

    await queryRunner.query(
      `
      DELETE FROM "tiramis_system_profiles" loser
      USING "tiramis_system_profiles" keeper
      WHERE loser."id" <> keeper."id"
        AND loser."environment" = keeper."environment"
        AND keeper."environment" = $1
        AND (
          loser."updated_at" < keeper."updated_at"
          OR (
            loser."updated_at" = keeper."updated_at"
            AND loser."id"::text > keeper."id"::text
          )
        )`,
      [activeEnvironment],
    );
  }

  private async dedupeServiceEndpoints(
    queryRunner: QueryRunner,
  ): Promise<void> {
    if (!(await queryRunner.hasTable('tiramis_service_endpoints'))) return;

    await queryRunner.query(`
      DELETE FROM "tiramis_service_endpoints" loser
      USING "tiramis_service_endpoints" keeper
      WHERE loser."id" <> keeper."id"
        AND loser."environment" = keeper."environment"
        AND loser."service_type" = keeper."service_type"
        AND (
          loser."updated_at" < keeper."updated_at"
          OR (
            loser."updated_at" = keeper."updated_at"
            AND loser."id"::text > keeper."id"::text
          )
        )`);
  }

  private async normalizeApiKeys(
    queryRunner: QueryRunner,
    activeEnvironment: 'uat' | 'production',
  ): Promise<void> {
    if (
      !(await queryRunner.hasColumn('tiramis_api_keys', 'tenant_environment'))
    ) {
      return;
    }

    await queryRunner.query(
      `UPDATE "tiramis_api_keys"
       SET "tenant_environment" = $1
       WHERE "tenant_environment" IS NOT NULL`,
      [activeEnvironment],
    );
  }

  private async addAllowedEnvironmentChecks(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tiramis_system_profiles"
      DROP CONSTRAINT IF EXISTS "CHK_tiramis_system_profiles_environment_uat_production"`);
    await queryRunner.query(`
      ALTER TABLE "tiramis_system_profiles"
      ADD CONSTRAINT "CHK_tiramis_system_profiles_environment_uat_production"
      CHECK ("environment" IN ('uat', 'production'))`);

    await queryRunner.query(`
      ALTER TABLE "tiramis_service_endpoints"
      DROP CONSTRAINT IF EXISTS "CHK_tiramis_service_endpoints_environment_uat_production"`);
    await queryRunner.query(`
      ALTER TABLE "tiramis_service_endpoints"
      ADD CONSTRAINT "CHK_tiramis_service_endpoints_environment_uat_production"
      CHECK ("environment" IN ('uat', 'production'))`);

    await queryRunner.query(`
      ALTER TABLE "tiramis_client_configurations"
      DROP CONSTRAINT IF EXISTS "CHK_tiramis_client_configurations_environment_uat_production"`);
    await queryRunner.query(`
      ALTER TABLE "tiramis_client_configurations"
      ADD CONSTRAINT "CHK_tiramis_client_configurations_environment_uat_production"
      CHECK ("environment" IN ('uat', 'production'))`);

    await queryRunner.query(`
      ALTER TABLE "tiramis_api_keys"
      DROP CONSTRAINT IF EXISTS "CHK_tiramis_api_keys_tenant_environment_uat_production"`);
    await queryRunner.query(`
      ALTER TABLE "tiramis_api_keys"
      ADD CONSTRAINT "CHK_tiramis_api_keys_tenant_environment_uat_production"
      CHECK ("tenant_environment" IS NULL OR "tenant_environment" IN ('uat', 'production'))`);
  }
}
