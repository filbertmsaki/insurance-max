import { MigrationInterface, QueryRunner } from 'typeorm';

export class CanonicalPortalIntegration1795300000000
  implements MigrationInterface
{
  name = 'CanonicalPortalIntegration1795300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS "schema_version" character varying(100)
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS "contract_version" character varying(20)
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS "command" character varying(40)
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS "request_type" character varying(80)
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS "canonical_status" character varying(60)
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS "idempotency_key" character varying(180)
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS "correlation_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS "causation_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS "resource_version" integer NOT NULL DEFAULT 1
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS "envelope" jsonb
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS "payload_hash" character varying(64)
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS "context_hash" character varying(64)
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS "envelope_hash" character varying(64)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tiramis_transactions_request_type"
      ON "tiramis_transactions" ("request_type")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tiramis_transactions_idempotency_key"
      ON "tiramis_transactions" ("idempotency_key")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tiramis_ingress_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "source_company_id" character varying(100) NOT NULL,
        "source_module" character varying(100) NOT NULL,
        "source_record_id" character varying(150) NOT NULL,
        "workflow_revision" integer,
        "command" character varying(40) NOT NULL,
        "request_type" character varying(80) NOT NULL,
        "schema_version" character varying(100) NOT NULL,
        "contract_version" character varying(20) NOT NULL,
        "idempotency_key" character varying(180) NOT NULL,
        "correlation_id" uuid NOT NULL,
        "causation_id" uuid,
        "transaction_id" uuid NOT NULL,
        "request_id" character varying(100) NOT NULL,
        "resource_version" integer NOT NULL DEFAULT 1,
        "payload_hash" character varying(64) NOT NULL,
        "context_hash" character varying(64) NOT NULL,
        "envelope_hash" character varying(64) NOT NULL,
        "envelope" jsonb NOT NULL,
        "acceptance_payload" jsonb NOT NULL,
        CONSTRAINT "PK_tiramis_ingress_requests" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tiramis_ingress_request_idempotency" UNIQUE (
          "source_company_id",
          "request_type",
          "idempotency_key"
        )
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tiramis_ingress_requests"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_transactions_idempotency_key"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_transactions_request_type"`,
    );
  }
}
