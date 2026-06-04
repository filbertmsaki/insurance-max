import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoMigration1780597884562 implements MigrationInterface {
    name = 'AutoMigration1780597884562'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tiramis_client_configurations" ADD "sale_point_code" character varying(12)`);
        await queryRunner.query(`ALTER TABLE "tiramis_client_configurations" ADD "public_certificate_password" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "tiramis_client_configurations" ADD "tira_public_certificate_password" character varying(255)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tiramis_client_configurations" DROP COLUMN "tira_public_certificate_password"`);
        await queryRunner.query(`ALTER TABLE "tiramis_client_configurations" DROP COLUMN "public_certificate_password"`);
        await queryRunner.query(`ALTER TABLE "tiramis_client_configurations" DROP COLUMN "sale_point_code"`);
    }

}
