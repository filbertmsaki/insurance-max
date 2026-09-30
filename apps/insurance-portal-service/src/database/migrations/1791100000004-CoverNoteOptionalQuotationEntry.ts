import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A vehicle added to a fleet by endorsement gets its own cover note but has
 * no quotation entry, so `cover_notes.quotation_entry_id` becomes nullable.
 * The unique index stays (NULLs never collide). No data changes.
 */
export class CoverNoteOptionalQuotationEntry1791100000004 implements MigrationInterface {
  name = 'CoverNoteOptionalQuotationEntry1791100000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cover_notes" ALTER COLUMN "quotation_entry_id" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Only reversible while no endorsement-added cover note exists.
    await queryRunner.query(
      `ALTER TABLE "cover_notes" ALTER COLUMN "quotation_entry_id" SET NOT NULL`,
    );
  }
}
