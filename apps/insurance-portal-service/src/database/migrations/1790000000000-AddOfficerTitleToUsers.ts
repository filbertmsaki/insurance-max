import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOfficerTitleToUsers1790000000000
  implements MigrationInterface
{
  name = 'AddOfficerTitleToUsers1790000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "officer_title" character varying(120) NOT NULL DEFAULT 'Underwriter'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "officer_title"`,
    );
  }
}
