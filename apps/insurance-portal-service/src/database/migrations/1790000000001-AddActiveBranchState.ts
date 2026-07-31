import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActiveBranchState1790000000001 implements MigrationInterface {
  name = 'AddActiveBranchState1790000000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "branch_users" ADD "is_active_branch" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_users" ADD "assigned_by" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_users" ADD "activated_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_users" ADD "activated_by" uuid`,
    );
    await queryRunner.query(
      `WITH ranked_primary AS (
         SELECT "id", ROW_NUMBER() OVER (
           PARTITION BY "company_user_id"
           ORDER BY "created_at" ASC, "id" ASC
         ) AS row_number
         FROM "branch_users"
         WHERE "is_primary" = true
       )
       UPDATE "branch_users" AS branch_user
       SET "is_active_branch" = true,
           "activated_at" = COALESCE(branch_user."updated_at", now())
       FROM ranked_primary
       WHERE branch_user."id" = ranked_primary."id"
         AND ranked_primary.row_number = 1`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_branch_users_one_active_branch" ON "branch_users" ("company_user_id") WHERE "is_active_branch" = true`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_branch_users_one_active_branch"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_users" DROP COLUMN "activated_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_users" DROP COLUMN "activated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_users" DROP COLUMN "assigned_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_users" DROP COLUMN "is_active_branch"`,
    );
  }
}
