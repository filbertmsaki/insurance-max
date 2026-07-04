import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRetryFieldsToTiramisSubmissionAttempts1783194327682
  implements MigrationInterface
{
  name = 'AddRetryFieldsToTiramisSubmissionAttempts1783194327682';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_attempts" ADD "retry_count" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_attempts" ADD "max_retries" integer NOT NULL DEFAULT '5'`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_attempts" ADD "is_retryable" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_attempts" ADD "next_retry_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_attempts" ADD "last_retry_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_attempts" ADD "final_callback_deadline_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_attempts" ADD "final_callback_overdue_notified" integer NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_attempts" DROP COLUMN "final_callback_overdue_notified"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_attempts" DROP COLUMN "final_callback_deadline_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_attempts" DROP COLUMN "last_retry_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_attempts" DROP COLUMN "next_retry_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_attempts" DROP COLUMN "is_retryable"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_attempts" DROP COLUMN "max_retries"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_attempts" DROP COLUMN "retry_count"`,
    );
  }
}
