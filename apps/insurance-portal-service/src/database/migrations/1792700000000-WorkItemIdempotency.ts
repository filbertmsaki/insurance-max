import { MigrationInterface, QueryRunner } from 'typeorm';

export class WorkItemIdempotency1792700000000 implements MigrationInterface {
  name = 'WorkItemIdempotency1792700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM work_items
          WHERE idempotency_key IS NOT NULL
          GROUP BY company_id, idempotency_key
          HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION 'Cannot enable work item idempotency: duplicate company/key pairs already exist';
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_work_items_company_idempotency" ON "work_items" ("company_id", "idempotency_key") WHERE "idempotency_key" IS NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_work_items_company_idempotency"`,
    );
  }
}
