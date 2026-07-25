import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFinalCallbackOverdueToPortalTiraSubmissionStatus1783000000011 implements MigrationInterface {
  name = 'AddFinalCallbackOverdueToPortalTiraSubmissionStatus1783000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."portal_tira_submission_status_enum" ADD VALUE IF NOT EXISTS 'FINAL_CALLBACK_OVERDUE'`,
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL enum value removal is intentionally not automated here.
  }
}
