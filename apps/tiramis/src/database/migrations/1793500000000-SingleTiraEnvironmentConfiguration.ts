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

export class SingleTiraEnvironmentConfiguration1793500000000
  implements MigrationInterface
{
  name = 'SingleTiraEnvironmentConfiguration1793500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, column] of ENVIRONMENT_COLUMNS) {
      await this.normalizeEnvironmentColumn(queryRunner, table, column);
    }

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_431d444d17189d9ffeb50b1ec8"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_30da4e184a5906a438a5866412"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_708112a775077b60804e3b6c0f"`);

    await queryRunner.query(`
      DELETE FROM "tiramis_client_configurations" loser
      USING "tiramis_client_configurations" keeper
      WHERE loser."company_code" = keeper."company_code"
        AND loser."id" <> keeper."id"
        AND (
          loser."created_at" > keeper."created_at"
          OR (
            loser."created_at" = keeper."created_at"
            AND loser."id"::text > keeper."id"::text
          )
        )`);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tiramis_client_config_company_code_single"
      ON "tiramis_client_configurations" ("company_code")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_client_config_company_code_single"`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_431d444d17189d9ffeb50b1ec8"
      ON "tiramis_client_configurations" ("environment", "company_code")`);
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
