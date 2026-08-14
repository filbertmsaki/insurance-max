import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCallbackReceiptsAndDeadLetters1786699684007 implements MigrationInterface {
  name = 'AddCallbackReceiptsAndDeadLetters1786699684007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TABLE "tiramis_callback_receipts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "environment" character varying(30) NOT NULL, "request_id" character varying(100) NOT NULL, "response_id" character varying(100) NOT NULL, "root_name" character varying(100) NOT NULL, "response_status_code" character varying(50) NOT NULL, "response_status_desc" character varying(255) NOT NULL, "payload_hash" character varying(128), "signature_verified" integer NOT NULL DEFAULT '0', "processing_status" character varying(30) NOT NULL DEFAULT 'PROCESSING', "receive_count" integer NOT NULL DEFAULT '1', "last_received_at" TIMESTAMP, "acknowledgement_id" character varying(100), "acknowledgement_status_code" character varying(50), "acknowledgement_status_desc" character varying(255), "acknowledgement_xml" text, "last_error" text, CONSTRAINT "PK_b21b4d95691a2274c0530ff6d7e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5f1b7cb556f55106a52e7fe557" ON "tiramis_callback_receipts" ("response_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9d04fbd695db84ddb854e22433" ON "tiramis_callback_receipts" ("request_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_3d47fe0170e905c75128be484e" ON "tiramis_callback_receipts" ("environment", "request_id", "response_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "tiramis_callback_dead_letters" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "environment" character varying(30) NOT NULL, "root_name" character varying(100), "request_id" character varying(100), "response_id" character varying(100), "status_code" character varying(50), "status_desc" character varying(255), "signature" text, "raw_xml" text, "payload_hash" character varying(128), "reason" text NOT NULL, "is_processed" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_4546f305a48135e2b32c66de2d4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_536da6213691648da1ce558d08" ON "tiramis_callback_dead_letters" ("response_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7e6c943c33b0e794d421c3d7cc" ON "tiramis_callback_dead_letters" ("request_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_747e5985888d2cb63d0360fea6" ON "tiramis_callback_dead_letters" ("environment") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_747e5985888d2cb63d0360fea6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7e6c943c33b0e794d421c3d7cc"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_536da6213691648da1ce558d08"`,
    );
    await queryRunner.query(`DROP TABLE "tiramis_callback_dead_letters"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3d47fe0170e905c75128be484e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9d04fbd695db84ddb854e22433"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5f1b7cb556f55106a52e7fe557"`,
    );
    await queryRunner.query(`DROP TABLE "tiramis_callback_receipts"`);
  }
}
