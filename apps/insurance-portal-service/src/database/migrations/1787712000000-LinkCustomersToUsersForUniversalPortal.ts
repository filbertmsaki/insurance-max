import { MigrationInterface, QueryRunner } from 'typeorm';

export class LinkCustomersToUsersForUniversalPortal1787712000000 implements MigrationInterface {
  name = 'LinkCustomersToUsersForUniversalPortal1787712000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customers"
      ADD COLUMN IF NOT EXISTS "user_id" uuid
    `);

    try {
      await queryRunner.query(`
        ALTER TABLE "customers"
        ADD CONSTRAINT "FK_customers_user_id"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE SET NULL
        ON UPDATE NO ACTION
      `);
    } catch {
      // Constraint already exists.
    }

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_customers_user_id"
      ON "customers" ("user_id")
      WHERE "user_id" IS NOT NULL AND "deleted_at" IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_customers_user_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "customers"
      DROP CONSTRAINT IF EXISTS "FK_customers_user_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "customers"
      DROP COLUMN IF EXISTS "user_id"
    `);
  }
}
