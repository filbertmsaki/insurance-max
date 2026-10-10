import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The TIRA system identity (client code/key, system code, certificates, base
 * and callback URLs, signature algorithm) is platform-wide and now comes only
 * from the environment. Company configurations keep company settings only and
 * are unique per (environment, company); service endpoints are per environment.
 */
export class SystemLevelTiraIdentity1793200000000 implements MigrationInterface {
  name = 'SystemLevelTiraIdentity1793200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const duplicates: Array<{ environment: string; company_code: string }> =
      await queryRunner.query(
        `SELECT "environment", "company_code"
           FROM "tiramis_client_configurations"
          GROUP BY "environment", "company_code"
         HAVING COUNT(*) > 1`,
      );
    if (duplicates.length) {
      throw new Error(
        `Cannot make TIRA identity system-level: these companies have more than one configuration per environment (one per system code). Keep one row each, then rerun: ${duplicates
          .map((row) => `${row.company_code}/${row.environment}`)
          .join(', ')}`,
      );
    }

    // Service endpoints: per environment instead of per company configuration.
    await queryRunner.query(
      `ALTER TABLE "tiramis_service_endpoints" ADD "environment" character varying(30)`,
    );
    await queryRunner.query(
      `UPDATE "tiramis_service_endpoints" e
          SET "environment" = c."environment"
         FROM "tiramis_client_configurations" c
        WHERE c."id" = e."client_configuration_id"`,
    );
    // Endpoints are identical across companies; keep one row per environment.
    await queryRunner.query(
      `DELETE FROM "tiramis_service_endpoints" e
        USING "tiramis_service_endpoints" keep
        WHERE e."environment" = keep."environment"
          AND e."service_type" = keep."service_type"
          AND (e."created_at", e."id") > (keep."created_at", keep."id")`,
    );
    await queryRunner.query(
      `DELETE FROM "tiramis_service_endpoints" WHERE "environment" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_service_endpoints" ALTER COLUMN "environment" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_service_endpoints" DROP CONSTRAINT "FK_4b1078525bf8596f299d59f8120"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bb05af80f05d76970291c523b2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_service_endpoints" DROP COLUMN "client_configuration_id"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_9a520e0ac373afde2259e5056c" ON "tiramis_service_endpoints" ("environment", "service_type")`,
    );

    // Company configurations: unique per (environment, company); system columns go.
    await queryRunner.query(
      `DROP INDEX "public"."IDX_30da4e184a5906a438a5866412"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_431d444d17189d9ffeb50b1ec8" ON "tiramis_client_configurations" ("environment", "company_code")`,
    );
    for (const column of SYSTEM_COLUMNS) {
      await queryRunner.query(
        `ALTER TABLE "tiramis_client_configurations" DROP COLUMN IF EXISTS "${column}"`,
      );
    }

    // API keys are bound to company + environment; the system code is platform-wide.
    await queryRunner.query(
      `ALTER TABLE "tiramis_api_keys" DROP COLUMN IF EXISTS "tenant_system_code"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_api_keys" ADD "tenant_system_code" character varying(80)`,
    );

    // System values were never stored per company after up(); restore the
    // columns with placeholders so the previous code can start, then re-enter
    // the real values.
    await queryRunner.query(
      `ALTER TABLE "tiramis_client_configurations"
         ADD "system_code" character varying(50) NOT NULL DEFAULT '(env)',
         ADD "client_code" character varying(100) NOT NULL DEFAULT '(env)',
         ADD "client_key" character varying(255) NOT NULL DEFAULT '(env)',
         ADD "client_key_encrypted" text,
         ADD "base_url" character varying(500) NOT NULL DEFAULT '(env)',
         ADD "callback_base_url" character varying(500) NOT NULL DEFAULT '(env)',
         ADD "client_private_certificate_path" character varying(500),
         ADD "client_private_certificate_password" character varying(255),
         ADD "client_private_certificate_password_encrypted" text,
         ADD "tira_public_certificate_path" character varying(500),
         ADD "tira_public_certificate_password" character varying(255),
         ADD "tira_public_certificate_password_encrypted" text,
         ADD "signature_algorithm" character varying(100)`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_431d444d17189d9ffeb50b1ec8"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_30da4e184a5906a438a5866412" ON "tiramis_client_configurations" ("environment", "company_code", "system_code")`,
    );

    // Endpoints back to per configuration: copy each environment's endpoints
    // to every configuration in that environment.
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9a520e0ac373afde2259e5056c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_service_endpoints" ADD "client_configuration_id" uuid`,
    );
    await queryRunner.query(
      `INSERT INTO "tiramis_service_endpoints"
         ("client_configuration_id", "environment", "service_type", "endpoint_url", "http_method", "content_type", "is_active")
       SELECT c."id", e."environment", e."service_type", e."endpoint_url", e."http_method", e."content_type", e."is_active"
         FROM "tiramis_service_endpoints" e
         JOIN "tiramis_client_configurations" c ON c."environment" = e."environment"
        WHERE e."client_configuration_id" IS NULL`,
    );
    await queryRunner.query(
      `DELETE FROM "tiramis_service_endpoints" WHERE "client_configuration_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_service_endpoints" ALTER COLUMN "client_configuration_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_service_endpoints" DROP COLUMN "environment"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_bb05af80f05d76970291c523b2" ON "tiramis_service_endpoints" ("client_configuration_id", "service_type")`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_service_endpoints" ADD CONSTRAINT "FK_4b1078525bf8596f299d59f8120" FOREIGN KEY ("client_configuration_id") REFERENCES "tiramis_client_configurations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}

const SYSTEM_COLUMNS = [
  'system_code',
  'client_code',
  'client_key',
  'client_key_encrypted',
  'base_url',
  'callback_base_url',
  'client_private_certificate_path',
  'client_private_certificate_password',
  'client_private_certificate_password_encrypted',
  'tira_public_certificate_path',
  'tira_public_certificate_password',
  'tira_public_certificate_password_encrypted',
  'signature_algorithm',
];
