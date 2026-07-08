import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDefaultFlagToTiramisSalePoints1783600000000 implements MigrationInterface {
  name = 'AddDefaultFlagToTiramisSalePoints1783600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tiramis_sale_points"
      ADD COLUMN IF NOT EXISTS "is_default" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      UPDATE "tiramis_sale_points"
      SET "is_default" = true
      WHERE "sale_point_code" = 'SP500'
        AND "is_active" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tiramis_sale_points"
      DROP COLUMN IF EXISTS "is_default"
    `);
  }
}
