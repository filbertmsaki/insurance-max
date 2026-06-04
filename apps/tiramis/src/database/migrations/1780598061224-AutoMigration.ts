import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoMigration1780598061224 implements MigrationInterface {
    name = 'AutoMigration1780598061224'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_30da4e184a5906a438a5866412"`);
        await queryRunner.query(`ALTER TABLE "tiramis_client_configurations" DROP COLUMN "system_code"`);
        await queryRunner.query(`ALTER TABLE "tiramis_client_configurations" ADD "system_code" character varying(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tiramis_claim_intimations" DROP COLUMN "system_code"`);
        await queryRunner.query(`ALTER TABLE "tiramis_claim_intimations" ADD "system_code" character varying(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tiramis_claim_payments" DROP COLUMN "system_code"`);
        await queryRunner.query(`ALTER TABLE "tiramis_claim_payments" ADD "system_code" character varying(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tiramis_claim_rejections" DROP COLUMN "system_code"`);
        await queryRunner.query(`ALTER TABLE "tiramis_claim_rejections" ADD "system_code" character varying(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tiramis_discharge_vouchers" DROP COLUMN "system_code"`);
        await queryRunner.query(`ALTER TABLE "tiramis_discharge_vouchers" ADD "system_code" character varying(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tiramis_claim_assessments" DROP COLUMN "system_code"`);
        await queryRunner.query(`ALTER TABLE "tiramis_claim_assessments" ADD "system_code" character varying(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tiramis_claim_notifications" DROP COLUMN "system_code"`);
        await queryRunner.query(`ALTER TABLE "tiramis_claim_notifications" ADD "system_code" character varying(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tiramis_cover_notes" DROP COLUMN "system_code"`);
        await queryRunner.query(`ALTER TABLE "tiramis_cover_notes" ADD "system_code" character varying(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tiramis_policies" DROP COLUMN "system_code"`);
        await queryRunner.query(`ALTER TABLE "tiramis_policies" ADD "system_code" character varying(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tiramis_reinsurances" DROP COLUMN "system_code"`);
        await queryRunner.query(`ALTER TABLE "tiramis_reinsurances" ADD "system_code" character varying(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tiramis_verification_requests" DROP COLUMN "system_code"`);
        await queryRunner.query(`ALTER TABLE "tiramis_verification_requests" ADD "system_code" character varying(50) NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_30da4e184a5906a438a5866412" ON "tiramis_client_configurations"  ("environment", "company_code", "system_code") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_30da4e184a5906a438a5866412"`);
        await queryRunner.query(`ALTER TABLE "tiramis_verification_requests" DROP COLUMN "system_code"`);
        await queryRunner.query(`ALTER TABLE "tiramis_verification_requests" ADD "system_code" character varying(12) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tiramis_reinsurances" DROP COLUMN "system_code"`);
        await queryRunner.query(`ALTER TABLE "tiramis_reinsurances" ADD "system_code" character varying(12) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tiramis_policies" DROP COLUMN "system_code"`);
        await queryRunner.query(`ALTER TABLE "tiramis_policies" ADD "system_code" character varying(12) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tiramis_cover_notes" DROP COLUMN "system_code"`);
        await queryRunner.query(`ALTER TABLE "tiramis_cover_notes" ADD "system_code" character varying(12) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tiramis_claim_notifications" DROP COLUMN "system_code"`);
        await queryRunner.query(`ALTER TABLE "tiramis_claim_notifications" ADD "system_code" character varying(12) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tiramis_claim_assessments" DROP COLUMN "system_code"`);
        await queryRunner.query(`ALTER TABLE "tiramis_claim_assessments" ADD "system_code" character varying(12) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tiramis_discharge_vouchers" DROP COLUMN "system_code"`);
        await queryRunner.query(`ALTER TABLE "tiramis_discharge_vouchers" ADD "system_code" character varying(12) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tiramis_claim_rejections" DROP COLUMN "system_code"`);
        await queryRunner.query(`ALTER TABLE "tiramis_claim_rejections" ADD "system_code" character varying(12) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tiramis_claim_payments" DROP COLUMN "system_code"`);
        await queryRunner.query(`ALTER TABLE "tiramis_claim_payments" ADD "system_code" character varying(12) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tiramis_claim_intimations" DROP COLUMN "system_code"`);
        await queryRunner.query(`ALTER TABLE "tiramis_claim_intimations" ADD "system_code" character varying(12) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tiramis_client_configurations" DROP COLUMN "system_code"`);
        await queryRunner.query(`ALTER TABLE "tiramis_client_configurations" ADD "system_code" character varying(12) NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_30da4e184a5906a438a5866412" ON "tiramis_client_configurations" USING btree ("company_code", "environment", "system_code") `);
    }

}
