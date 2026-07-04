import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTiramisCallbackReceipts1783194327679
  implements MigrationInterface
{
  name = 'CreateTiramisCallbackReceipts1783194327679';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "tiramis_callback_receipts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "environment" character varying(30) NOT NULL, "request_id" character varying(100) NOT NULL, "response_id" character varying(100) NOT NULL, "root_name" character varying(100) NOT NULL, "response_status_code" character varying(50) NOT NULL, "response_status_desc" character varying(255) NOT NULL, "payload_hash" character varying(128), "signature_verified" integer NOT NULL DEFAULT '0', "processing_status" character varying(30) NOT NULL DEFAULT 'PROCESSING', "receive_count" integer NOT NULL DEFAULT '1', "last_received_at" TIMESTAMP, "acknowledgement_id" character varying(100), "acknowledgement_status_code" character varying(50), "acknowledgement_status_desc" character varying(255), "acknowledgement_xml" text, "last_error" text, CONSTRAINT "PK_6f5bcb5c0d7e0ed63b93cf0c4f2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_8bdb0a1b2f0cf3ec0f6b7260b7" ON "tiramis_callback_receipts" ("environment", "request_id", "response_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6a30d7c44e0f8f2ad06d0d1d56" ON "tiramis_callback_receipts" ("request_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f8f3270f0ee1d77fdd9d9cf3d1" ON "tiramis_callback_receipts" ("response_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f8f3270f0ee1d77fdd9d9cf3d1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6a30d7c44e0f8f2ad06d0d1d56"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8bdb0a1b2f0cf3ec0f6b7260b7"`,
    );
    await queryRunner.query(`DROP TABLE "tiramis_callback_receipts"`);
  }
}
