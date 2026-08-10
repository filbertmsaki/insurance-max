import { MigrationInterface, QueryRunner } from 'typeorm';

export class CoverNoteVerificationMinEndpoint1795900000000 implements MigrationInterface {
  name = 'CoverNoteVerificationMinEndpoint1795900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "tiramis_service_endpoints"
      SET "endpoint_url" = '/ecovernote/api/covernote/verification/min/v1/request'
      WHERE "service_type" = 'COVER_NOTE_VERIFICATION'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "tiramis_service_endpoints"
      SET "endpoint_url" = '/ecovernote/api/covernote/verification/v1/request'
      WHERE "service_type" = 'COVER_NOTE_VERIFICATION'
    `);
  }
}
