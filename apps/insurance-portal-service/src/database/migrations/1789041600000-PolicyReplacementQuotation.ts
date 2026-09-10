import { MigrationInterface, QueryRunner } from 'typeorm';

export class PolicyReplacementQuotation1789041600000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE quotations
      ADD COLUMN replacement_source_policy_id uuid REFERENCES policies(id),
      ADD COLUMN replacement_source_version_id uuid REFERENCES policy_versions(id),
      ADD COLUMN replacement_reason text,
      ADD COLUMN replacement_applied_at timestamptz`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_quotation_pending_replacement"
      ON quotations (replacement_source_policy_id)
      WHERE replacement_source_policy_id IS NOT NULL AND deleted_at IS NULL
        AND quotation_status <> 'CANCELLED'`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "UQ_quotation_pending_replacement"');
    await queryRunner.query(`ALTER TABLE quotations DROP COLUMN replacement_source_policy_id,
      DROP COLUMN replacement_source_version_id, DROP COLUMN replacement_reason,
      DROP COLUMN replacement_applied_at`);
  }
}
