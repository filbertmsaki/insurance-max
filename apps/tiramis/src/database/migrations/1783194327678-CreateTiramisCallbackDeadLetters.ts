import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTiramisCallbackDeadLetters1783194327678 implements MigrationInterface {
  name = 'CreateTiramisCallbackDeadLetters1783194327678';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "tiramis_callback_dead_letters" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "environment" character varying(30) NOT NULL, "root_name" character varying(100), "request_id" character varying(100), "response_id" character varying(100), "status_code" character varying(50), "status_desc" character varying(255), "signature" text, "raw_xml" text, "reason" text NOT NULL, "is_processed" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_3aa8fa2b2cecfa89d4cc8151d31" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9ecfdb4db3efde6ed8f277b032" ON "tiramis_callback_dead_letters" ("environment") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9d4cfde36f2f3d6ec4b162e11f" ON "tiramis_callback_dead_letters" ("request_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4fe0cbce054a3e239ca7135584" ON "tiramis_callback_dead_letters" ("response_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4fe0cbce054a3e239ca7135584"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9d4cfde36f2f3d6ec4b162e11f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9ecfdb4db3efde6ed8f277b032"`,
    );
    await queryRunner.query(`DROP TABLE "tiramis_callback_dead_letters"`);
  }
}
