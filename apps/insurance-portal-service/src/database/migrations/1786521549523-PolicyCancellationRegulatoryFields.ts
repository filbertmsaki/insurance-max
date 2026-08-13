import { MigrationInterface, QueryRunner } from 'typeorm';

export class PolicyCancellationRegulatoryFields1786521549523 implements MigrationInterface {
  name = 'PolicyCancellationRegulatoryFields1786521549523';

  async up(queryRunner: QueryRunner) {
    await queryRunner.query(`
      ALTER TABLE "policy_cancellations"
      ADD COLUMN IF NOT EXISTS "tira_endorsement_type" integer NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "policy_cancellations"
      ADD COLUMN IF NOT EXISTS "previous_cover_note_reference" varchar(100) NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "policy_cancellations"
      ADD COLUMN IF NOT EXISTS "cancellation_cover_note_reference" varchar(100) NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "policy_cancellations"
      ADD COLUMN IF NOT EXISTS "rule_snapshot" jsonb NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "policy_cancellations"
      ADD COLUMN IF NOT EXISTS "rule_snapshot_hash" varchar(64) NULL
    `);
  }

  async down(queryRunner: QueryRunner) {
    await queryRunner.query(`
      ALTER TABLE "policy_cancellations"
      DROP COLUMN IF EXISTS "rule_snapshot_hash"
    `);

    await queryRunner.query(`
      ALTER TABLE "policy_cancellations"
      DROP COLUMN IF EXISTS "rule_snapshot"
    `);

    await queryRunner.query(`
      ALTER TABLE "policy_cancellations"
      DROP COLUMN IF EXISTS "cancellation_cover_note_reference"
    `);

    await queryRunner.query(`
      ALTER TABLE "policy_cancellations"
      DROP COLUMN IF EXISTS "previous_cover_note_reference"
    `);

    await queryRunner.query(`
      ALTER TABLE "policy_cancellations"
      DROP COLUMN IF EXISTS "tira_endorsement_type"
    `);
  }
}
