import { MigrationInterface, QueryRunner } from 'typeorm';

export class TiramisCoverNoteIdempotency1792700000000 implements MigrationInterface {
  name = 'TiramisCoverNoteIdempotency1792700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM tiramis_transactions
          WHERE idempotency_key IS NOT NULL
          GROUP BY client_configuration_id, idempotency_key
          HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION 'Cannot enable TIRAMIS idempotency: duplicate configuration/key pairs already exist';
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_22ff35f2d3783535cfd40747ec"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_tiramis_transactions_configuration_idempotency" ON "tiramis_transactions" ("client_configuration_id", "idempotency_key") WHERE "idempotency_key" IS NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_tiramis_transactions_configuration_idempotency"`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_22ff35f2d3783535cfd40747ec" ON "tiramis_transactions" ("idempotency_key")`,
    );
  }
}
