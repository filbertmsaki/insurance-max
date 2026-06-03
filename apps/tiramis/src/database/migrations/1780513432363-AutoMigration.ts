import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoMigration1780513432363 implements MigrationInterface {
    name = 'AutoMigration1780513432363'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "tiramis_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying(120) NOT NULL, "description" text, CONSTRAINT "PK_c96189d3d986af552bd74b6da77" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "tiramis_items"`);
    }

}
