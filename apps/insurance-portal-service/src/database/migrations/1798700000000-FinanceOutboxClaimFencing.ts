import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Worker fencing for finance_outbox_events. Each claim increments
 * claim_generation; outcome writes must present the generation they claimed,
 * so a worker whose lease expired cannot overwrite a newer claim's outcome.
 * Additive only: existing rows keep their status and payload.
 */
export class FinanceOutboxClaimFencing1798700000000 implements MigrationInterface {
  name = 'FinanceOutboxClaimFencing1798700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE finance_outbox_events
      ADD COLUMN claim_generation bigint NOT NULL DEFAULT 0,
      ADD COLUMN claimed_by varchar(120) NULL,
      ADD COLUMN claimed_at timestamptz NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE finance_outbox_events
      DROP COLUMN claimed_at,
      DROP COLUMN claimed_by,
      DROP COLUMN claim_generation`);
  }
}
