import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPortalWebhookUrlToTransactions1790700000000 implements MigrationInterface {
  name = 'AddPortalWebhookUrlToTransactions1790700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_transactions" ADD "portal_webhook_url" character varying(500)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_transactions" DROP COLUMN "portal_webhook_url"`,
    );
  }
}
