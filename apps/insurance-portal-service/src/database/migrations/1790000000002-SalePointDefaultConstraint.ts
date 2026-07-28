import { MigrationInterface, QueryRunner } from 'typeorm';

export class SalePointDefaultConstraint1790000000002 implements MigrationInterface {
  name = 'SalePointDefaultConstraint1790000000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_tiramis_sale_points_one_default_per_branch" ON "tiramis_sale_points" ("branch_id") WHERE "is_default" = true AND "branch_id" IS NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_tiramis_sale_points_one_default_per_branch"`);
  }
}
