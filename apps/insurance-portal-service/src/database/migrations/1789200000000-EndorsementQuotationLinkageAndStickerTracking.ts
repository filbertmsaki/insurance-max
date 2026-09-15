import { MigrationInterface, QueryRunner } from 'typeorm';

export class EndorsementQuotationLinkageAndStickerTracking1789200000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    // Link the background quotation an endorsement/cancellation/renewal
    // creates back to its originating PolicyTransaction and Policy, plus
    // the immediately-preceding quotation for that policy. Previously
    // these links existed only inside `draft_payload` JSONB with no FK,
    // index, or query path — see PolicyTransactionQuotationFactoryService.
    await queryRunner.query(`ALTER TABLE quotations
      ADD COLUMN source_policy_transaction_id uuid REFERENCES policy_transactions(id),
      ADD COLUMN source_policy_id uuid REFERENCES policies(id),
      ADD COLUMN previous_quotation_id uuid REFERENCES quotations(id)`);
    await queryRunner.query(`CREATE INDEX "IDX_quotations_source_policy_transaction_id"
      ON quotations (source_policy_transaction_id)
      WHERE source_policy_transaction_id IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX "IDX_quotations_source_policy_id"
      ON quotations (source_policy_id)
      WHERE source_policy_id IS NOT NULL`);

    // Motor sticker numbers around an endorsement. Per the TIRAMIS spec,
    // MotorCoverNoteRefRes returns a new StickerNumber for normal
    // endorsements but cancellations never receive one — both columns stay
    // null for a cancellation by design, not by omission.
    await queryRunner.query(`ALTER TABLE policy_endorsements
      ADD COLUMN previous_sticker_number varchar(100),
      ADD COLUMN replacement_sticker_number varchar(100)`);

    // First-class current sticker number on the policy itself (mirrors
    // `cover_note_no`) and on each policy version (mirrors
    // `regulatory_reference`), so an applied endorsement's sticker is
    // queryable directly instead of only living inside JSONB snapshots.
    // For a fleet policy this holds only the single/primary sticker;
    // per-fleet-entry stickers remain tracked on `motor_policy_details`
    // per risk.
    await queryRunner.query(
      `ALTER TABLE policies ADD COLUMN sticker_no varchar(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE policy_versions ADD COLUMN regulatory_sticker_number varchar(100)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE policy_versions DROP COLUMN regulatory_sticker_number`,
    );
    await queryRunner.query(
      `ALTER TABLE policies DROP COLUMN sticker_no`,
    );
    await queryRunner.query(`ALTER TABLE policy_endorsements
      DROP COLUMN previous_sticker_number,
      DROP COLUMN replacement_sticker_number`);
    await queryRunner.query(
      'DROP INDEX "IDX_quotations_source_policy_id"',
    );
    await queryRunner.query(
      'DROP INDEX "IDX_quotations_source_policy_transaction_id"',
    );
    await queryRunner.query(`ALTER TABLE quotations
      DROP COLUMN previous_quotation_id,
      DROP COLUMN source_policy_id,
      DROP COLUMN source_policy_transaction_id`);
  }
}
