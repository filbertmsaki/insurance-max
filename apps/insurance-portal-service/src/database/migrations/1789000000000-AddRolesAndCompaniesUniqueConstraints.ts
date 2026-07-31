import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRolesAndCompaniesUniqueConstraints1789000000000 implements MigrationInterface {
  name = 'AddRolesAndCompaniesUniqueConstraints1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_roles_global_name"
      ON "roles" ("name")
      WHERE "company_id" IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_roles_company_name"
      ON "roles" ("company_id", "name")
      WHERE "company_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_companies_name"
      ON "companies" ("name")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_companies_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_roles_company_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_roles_global_name"`);
  }
}
