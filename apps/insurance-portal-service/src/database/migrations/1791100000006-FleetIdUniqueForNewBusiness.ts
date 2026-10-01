import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Endorsement and cancellation quotations resend the policy's issued FleetId
 * to TIRA, so `fleet_id` is unique only among new-business cover notes.
 */
export class FleetIdUniqueForNewBusiness1791100000006 implements MigrationInterface {
  name = 'FleetIdUniqueForNewBusiness1791100000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "quotation_cover_notes" ADD "is_policy_transaction" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`
      UPDATE quotation_cover_notes qcn
         SET is_policy_transaction = true
        FROM quotations q
       WHERE q.id = qcn.quotation_id
         AND q.source_policy_transaction_id IS NOT NULL
    `);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_quotation_cover_notes_fleet_id"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_quotation_cover_notes_fleet_id" ON "quotation_cover_notes" ("fleet_id") WHERE fleet_id IS NOT NULL AND is_policy_transaction = false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_quotation_cover_notes_fleet_id"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_quotation_cover_notes_fleet_id" ON "quotation_cover_notes" ("fleet_id") WHERE fleet_id IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_cover_notes" DROP COLUMN "is_policy_transaction"`,
    );
  }
}
