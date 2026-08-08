import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditHashesToTiramisEvents1783194327692
  implements MigrationInterface
{
  name = 'AddAuditHashesToTiramisEvents1783194327692';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_events" ADD "payload_hash" character varying(128)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_events" ADD "payload_size_bytes" integer`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tiramis_submission_events_payload_hash" ON "tiramis_submission_events" ("payload_hash")`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_callback_dead_letters" ADD "payload_hash" character varying(128)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tiramis_callback_dead_letters_payload_hash" ON "tiramis_callback_dead_letters" ("payload_hash")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_tiramis_callback_dead_letters_payload_hash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_callback_dead_letters" DROP COLUMN "payload_hash"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_tiramis_submission_events_payload_hash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_events" DROP COLUMN "payload_size_bytes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_events" DROP COLUMN "payload_hash"`,
    );
  }
}
