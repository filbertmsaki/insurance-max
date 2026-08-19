import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientConfigurationIdToApiKeys1787116720910 implements MigrationInterface {
  name = 'AddClientConfigurationIdToApiKeys1787116720910';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_api_keys" ADD "client_configuration_id" uuid`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_tiramis_api_keys_client_configuration_id" ON "tiramis_api_keys" ("client_configuration_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "tiramis_api_keys" ADD CONSTRAINT "FK_tiramis_api_keys_client_configuration_id" FOREIGN KEY ("client_configuration_id") REFERENCES "tiramis_client_configurations"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    );

    // Backfill: match existing keys' free-text tenant fields against the
    // client configuration they already logically point to. Rows that
    // don't match cleanly (typo'd/decommissioned company or system codes,
    // or a null tenant environment) are intentionally left NULL here for
    // manual review rather than guessed at.
    await queryRunner.query(`
      UPDATE "tiramis_api_keys" AS ak
      SET "client_configuration_id" = cc.id
      FROM "tiramis_client_configurations" AS cc
      WHERE ak."tenant_company_code" = cc.company_code
        AND ak."tenant_system_code" = cc.system_code
        AND ak."tenant_environment" = cc.environment
        AND ak."client_configuration_id" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_api_keys" DROP CONSTRAINT "FK_tiramis_api_keys_client_configuration_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_tiramis_api_keys_client_configuration_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_api_keys" DROP COLUMN "client_configuration_id"`,
    );
  }
}
