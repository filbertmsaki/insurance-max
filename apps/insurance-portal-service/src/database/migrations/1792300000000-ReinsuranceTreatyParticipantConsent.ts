import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReinsuranceTreatyParticipantConsent1792300000000 implements MigrationInterface {
  name = 'ReinsuranceTreatyParticipantConsent1792300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "reinsurance_treaty_participants"
      ADD COLUMN "invitation_responded_by" uuid,
      ADD COLUMN "invitation_responded_at" timestamptz,
      ADD COLUMN "invitation_response_note" text
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "reinsurance_treaty_participants"
      DROP COLUMN IF EXISTS "invitation_response_note",
      DROP COLUMN IF EXISTS "invitation_responded_at",
      DROP COLUMN IF EXISTS "invitation_responded_by"
    `);
  }
}
