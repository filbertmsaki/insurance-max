import { MigrationInterface, QueryRunner } from 'typeorm';

export class AutoMigration1780599000000 implements MigrationInterface {
  name = 'AutoMigration1780599000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_client_configurations" RENAME COLUMN "private_key_path" TO "client_private_certificate_path"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_client_configurations" RENAME COLUMN "private_key_password" TO "client_private_certificate_password"`,
    );
    await queryRunner.query(
      `UPDATE "tiramis_client_configurations" SET "tira_public_certificate_path" = COALESCE("tira_public_certificate_path", "public_certificate_path") WHERE "public_certificate_path" IS NOT NULL`,
    );
    await queryRunner.query(
      `UPDATE "tiramis_client_configurations" SET "tira_public_certificate_password" = COALESCE("tira_public_certificate_password", "public_certificate_password") WHERE "public_certificate_password" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_client_configurations" DROP COLUMN "public_certificate_path"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_client_configurations" DROP COLUMN "public_certificate_password"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_client_configurations" ADD "public_certificate_path" character varying(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_client_configurations" ADD "public_certificate_password" character varying(255)`,
    );
    await queryRunner.query(
      `UPDATE "tiramis_client_configurations" SET "public_certificate_path" = COALESCE("public_certificate_path", "tira_public_certificate_path") WHERE "tira_public_certificate_path" IS NOT NULL`,
    );
    await queryRunner.query(
      `UPDATE "tiramis_client_configurations" SET "public_certificate_password" = COALESCE("public_certificate_password", "tira_public_certificate_password") WHERE "tira_public_certificate_password" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_client_configurations" RENAME COLUMN "client_private_certificate_password" TO "private_key_password"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_client_configurations" RENAME COLUMN "client_private_certificate_path" TO "private_key_path"`,
    );
  }
}
