import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTiramisAccessAuditLogs1794600000000 implements MigrationInterface {
  name = 'CreateTiramisAccessAuditLogs1794600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tiramis_access_audit_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "request_id" varchar(128) NULL,
        "correlation_id" varchar(128) NULL,
        "calling_service" varchar(100) NOT NULL,
        "actor_user_id" varchar(100) NULL,
        "tenant_company_id" varchar(100) NULL,
        "service_scopes" text NULL,
        "method" varchar(20) NOT NULL,
        "path" varchar(255) NOT NULL,
        "status_code" integer NOT NULL,
        "allowed" boolean NOT NULL,
        "denial_reason" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tiramis_access_audit_logs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tiramis_access_audit_tenant_created"
      ON "tiramis_access_audit_logs" ("tenant_company_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tiramis_access_audit_request_id"
      ON "tiramis_access_audit_logs" ("request_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_access_audit_request_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_access_audit_tenant_created"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "tiramis_access_audit_logs"`);
  }
}
