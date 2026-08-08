import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixDocumentStatusConstraint1796000000000 implements MigrationInterface {
  name = 'FixDocumentStatusConstraint1796000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "documents"
      ALTER COLUMN "status" TYPE varchar(30),
      ALTER COLUMN "status" SET DEFAULT 'UPLOAD_PENDING'
    `);

    await queryRunner.query(`
      UPDATE "documents"
      SET "status" = CASE
        WHEN "status" = 'PENDING' THEN 'UPLOAD_PENDING'
        WHEN "status" = 'VERIFIED' THEN 'AVAILABLE'
        WHEN "status" = 'REJECTED' THEN 'REJECTED'
        ELSE COALESCE("status", 'UPLOAD_PENDING')
      END
    `);

    await queryRunner.query(`
      ALTER TABLE "documents"
      DROP CONSTRAINT IF EXISTS "CHK_document_status"
    `);

    await queryRunner.query(`
      ALTER TABLE "documents"
      ADD CONSTRAINT "CHK_document_status" CHECK (
        "status" IN (
          'UPLOAD_PENDING',
          'UPLOADED',
          'SCAN_PENDING',
          'SCANNING',
          'AVAILABLE',
          'QUARANTINED',
          'REJECTED',
          'SUPERSEDED',
          'REVOKED',
          'ARCHIVED',
          'DELETED'
        )
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "documents"
      DROP CONSTRAINT IF EXISTS "CHK_document_status"
    `);

    await queryRunner.query(`
      ALTER TABLE "documents"
      ALTER COLUMN "status" SET DEFAULT 'PENDING',
      ALTER COLUMN "status" TYPE varchar(20)
        USING CASE
          WHEN "status" = 'AVAILABLE' THEN 'VERIFIED'
          WHEN "status" = 'REJECTED' THEN 'REJECTED'
          ELSE 'PENDING'
        END
    `);

    await queryRunner.query(`
      ALTER TABLE "documents"
      ADD CONSTRAINT "CHK_document_status" CHECK (
        "status" IN ('PENDING', 'VERIFIED', 'REJECTED')
      )
    `);
  }
}
