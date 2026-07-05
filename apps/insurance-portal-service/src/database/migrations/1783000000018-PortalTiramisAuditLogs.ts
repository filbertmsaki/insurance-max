import { MigrationInterface, QueryRunner } from 'typeorm';

export class PortalTiramisAuditLogs1783000000018
  implements MigrationInterface
{
  name = 'PortalTiramisAuditLogs1783000000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tiramis_audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "action" character varying(100) NOT NULL,
        "request_type" character varying(80),
        "source_service" character varying(100) NOT NULL DEFAULT 'insurance-portal-service',
        "source_company_id" uuid,
        "source_user_id" uuid,
        "source_module" character varying(100),
        "source_record_id" character varying(150),
        "business_reference" character varying(150),
        "local_tracking_id" uuid,
        "tiramis_transaction_id" uuid,
        "tiramis_request_id" character varying(100),
        "status_before" character varying(80),
        "status_after" character varying(80),
        "success" boolean NOT NULL DEFAULT true,
        "error_message" text,
        "ip_address" character varying(100),
        "user_agent" text,
        "metadata" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_audit_action" ON "tiramis_audit_logs" ("action")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_audit_request_type" ON "tiramis_audit_logs" ("request_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_audit_source_company_id" ON "tiramis_audit_logs" ("source_company_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_audit_source_user_id" ON "tiramis_audit_logs" ("source_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_audit_source_module" ON "tiramis_audit_logs" ("source_module")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_audit_source_record_id" ON "tiramis_audit_logs" ("source_record_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_audit_business_reference" ON "tiramis_audit_logs" ("business_reference")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_audit_local_tracking_id" ON "tiramis_audit_logs" ("local_tracking_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_audit_created_at" ON "tiramis_audit_logs" ("created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tiramis_audit_created_at"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tiramis_audit_local_tracking_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tiramis_audit_business_reference"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tiramis_audit_source_record_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tiramis_audit_source_module"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tiramis_audit_source_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tiramis_audit_source_company_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tiramis_audit_request_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tiramis_audit_action"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tiramis_audit_logs"`);
  }
}
