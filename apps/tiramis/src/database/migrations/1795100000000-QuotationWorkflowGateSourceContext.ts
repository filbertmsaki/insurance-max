import { MigrationInterface, QueryRunner } from 'typeorm';

export class QuotationWorkflowGateSourceContext1795100000000 implements MigrationInterface {
  name = 'QuotationWorkflowGateSourceContext1795100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS "source_quotation_id" character varying(100),
      ADD COLUMN IF NOT EXISTS "source_quotation_number" character varying(100),
      ADD COLUMN IF NOT EXISTS "source_workflow_revision" integer,
      ADD COLUMN IF NOT EXISTS "source_quotation_stage" character varying(40),
      ADD COLUMN IF NOT EXISTS "source_approval_status" character varying(40),
      ADD COLUMN IF NOT EXISTS "source_payment_status" character varying(40),
      ADD COLUMN IF NOT EXISTS "source_finalization_hash" character varying(64),
      ADD COLUMN IF NOT EXISTS "source_workflow_gate_hash" character varying(64)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tiramis_source_quotation"
      ON "tiramis_transactions" ("source_quotation_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tiramis_workflow_gate_hash"
      ON "tiramis_transactions" ("source_workflow_gate_hash")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_tiramis_workflow_gate_hash"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_tiramis_source_quotation"
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      DROP COLUMN IF EXISTS "source_workflow_gate_hash",
      DROP COLUMN IF EXISTS "source_finalization_hash",
      DROP COLUMN IF EXISTS "source_payment_status",
      DROP COLUMN IF EXISTS "source_approval_status",
      DROP COLUMN IF EXISTS "source_quotation_stage",
      DROP COLUMN IF EXISTS "source_workflow_revision",
      DROP COLUMN IF EXISTS "source_quotation_number",
      DROP COLUMN IF EXISTS "source_quotation_id"
    `);
  }
}
