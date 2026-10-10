import { MigrationInterface, QueryRunner } from 'typeorm';

const ENVIRONMENT_COLUMNS: Array<[string, string]> = [
  ['tiramis_company_configurations', 'environment'],
  ['tiramis_platform_settings', 'active_environment'],
  ['tiramis_submission_tracking', 'tiramis_environment'],
];

export class SingleTiraEnvironmentConfiguration1793500000000 implements MigrationInterface {
  name = 'SingleTiraEnvironmentConfiguration1793500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, column] of ENVIRONMENT_COLUMNS) {
      await this.normalizeEnvironmentColumn(queryRunner, table, column);
    }

    await this.addColumnIfMissing(
      queryRunner,
      'tiramis_platform_settings',
      'service_api_key_encrypted',
      'text',
    );
    await this.addColumnIfMissing(
      queryRunner,
      'tiramis_platform_settings',
      'validation_status',
      `character varying(20) NOT NULL DEFAULT 'NOT_VALIDATED'`,
    );
    await this.addColumnIfMissing(
      queryRunner,
      'tiramis_platform_settings',
      'validated_at',
      'TIMESTAMP WITH TIME ZONE',
    );

    await queryRunner.query(`
      UPDATE "tiramis_platform_settings"
      SET
        "service_api_key_encrypted" = COALESCE(
          "service_api_key_encrypted",
          "service_api_key_test_encrypted",
          "service_api_key_live_encrypted"
        ),
        "validation_status" = COALESCE(
          NULLIF("validation_status", 'NOT_VALIDATED'),
          NULLIF("test_validation_status", 'NOT_VALIDATED'),
          NULLIF("live_validation_status", 'NOT_VALIDATED'),
          'NOT_VALIDATED'
        ),
        "validated_at" = COALESCE(
          "validated_at",
          "test_validated_at",
          "live_validated_at"
        )`);

    for (const column of [
      'service_api_key_test_encrypted',
      'service_api_key_live_encrypted',
      'test_validation_status',
      'test_validated_at',
      'live_validation_status',
      'live_validated_at',
      'environment_switched_at',
      'environment_switched_by',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "tiramis_platform_settings" DROP COLUMN IF EXISTS "${column}"`,
      );
    }

    await queryRunner.query(`
      DELETE FROM "tiramis_company_configurations" loser
      USING "tiramis_company_configurations" keeper
      WHERE loser."company_id" = keeper."company_id"
        AND loser."id" <> keeper."id"
        AND (
          loser."created_at" > keeper."created_at"
          OR (
            loser."created_at" = keeper."created_at"
            AND loser."id"::text > keeper."id"::text
          )
        )`);

    await queryRunner.query(
      `ALTER TABLE "tiramis_company_configurations" DROP CONSTRAINT IF EXISTS "UQ_tiramis_company_config_company_environment"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_company_config_environment"`,
    );
    await queryRunner.query(`
      ALTER TABLE "tiramis_company_configurations"
      ADD CONSTRAINT "UQ_tiramis_company_config_company" UNIQUE ("company_id")`);

    await queryRunner.query(`
      UPDATE "companies"
      SET "settings" = COALESCE("settings", '{}'::jsonb)
        || jsonb_build_object(
          'tiramis_target_environment',
          CASE
            WHEN "settings"->>'tiramis_target_environment' = 'live' THEN 'production'
            WHEN "settings"->>'tiramis_target_environment' = 'test' THEN 'local'
            ELSE COALESCE("settings"->>'tiramis_target_environment', 'local')
          END
        )
      WHERE "settings" ? 'tiramis_target_environment'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_company_configurations" DROP CONSTRAINT IF EXISTS "UQ_tiramis_company_config_company"`,
    );
    await queryRunner.query(`
      ALTER TABLE "tiramis_company_configurations"
      ADD CONSTRAINT "UQ_tiramis_company_config_company_environment" UNIQUE ("company_id", "environment")`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_company_config_environment" ON "tiramis_company_configurations" ("environment")`,
    );

    await this.addColumnIfMissing(
      queryRunner,
      'tiramis_platform_settings',
      'service_api_key_test_encrypted',
      'text',
    );
    await this.addColumnIfMissing(
      queryRunner,
      'tiramis_platform_settings',
      'service_api_key_live_encrypted',
      'text',
    );
    await this.addColumnIfMissing(
      queryRunner,
      'tiramis_platform_settings',
      'test_validation_status',
      `character varying(20) NOT NULL DEFAULT 'NOT_VALIDATED'`,
    );
    await this.addColumnIfMissing(
      queryRunner,
      'tiramis_platform_settings',
      'test_validated_at',
      'TIMESTAMP WITH TIME ZONE',
    );
    await this.addColumnIfMissing(
      queryRunner,
      'tiramis_platform_settings',
      'live_validation_status',
      `character varying(20) NOT NULL DEFAULT 'NOT_VALIDATED'`,
    );
    await this.addColumnIfMissing(
      queryRunner,
      'tiramis_platform_settings',
      'live_validated_at',
      'TIMESTAMP WITH TIME ZONE',
    );
  }

  private async addColumnIfMissing(
    queryRunner: QueryRunner,
    table: string,
    column: string,
    definition: string,
  ): Promise<void> {
    const exists = await queryRunner.hasColumn(table, column);

    if (!exists) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`,
      );
    }
  }

  private async normalizeEnvironmentColumn(
    queryRunner: QueryRunner,
    table: string,
    column: string,
  ): Promise<void> {
    const exists = await queryRunner.hasColumn(table, column);

    if (!exists) {
      return;
    }

    await queryRunner.query(`
      UPDATE "${table}"
      SET "${column}" = CASE
        WHEN "${column}" = 'test' THEN 'local'
        WHEN "${column}" = 'live' THEN 'production'
        ELSE "${column}"
      END
      WHERE "${column}" IN ('test', 'live')`);
  }
}
