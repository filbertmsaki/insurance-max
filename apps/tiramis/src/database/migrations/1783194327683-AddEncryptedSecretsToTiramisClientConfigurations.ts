import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEncryptedSecretsToTiramisClientConfigurations1783194327683 implements MigrationInterface {
  name = 'AddEncryptedSecretsToTiramisClientConfigurations1783194327683';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_client_configurations" ADD "client_key_encrypted" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_client_configurations" ADD "client_private_certificate_password_encrypted" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_client_configurations" ADD "tira_public_certificate_password_encrypted" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_client_configurations" DROP COLUMN "tira_public_certificate_password_encrypted"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_client_configurations" DROP COLUMN "client_private_certificate_password_encrypted"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_client_configurations" DROP COLUMN "client_key_encrypted"`,
    );
  }
}
