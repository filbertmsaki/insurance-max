import { MigrationInterface, QueryRunner } from 'typeorm';

export class IdentifierSequences1786521549524 implements MigrationInterface {
  name = 'IdentifierSequences1786521549524';

  async up(queryRunner: QueryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "identifier_sequences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "identifier_type" varchar(50) NOT NULL,
        "sequence_date" varchar(20) NOT NULL,
        "sequence_time_bucket" varchar(20) NOT NULL DEFAULT '',
        "current_value" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_identifier_sequences" PRIMARY KEY ("id"),
        CONSTRAINT "FK_identifier_sequences_company"
          FOREIGN KEY ("company_id") REFERENCES "companies"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_identifier_sequences_scope"
      ON "identifier_sequences" (
        "company_id",
        "identifier_type",
        "sequence_date",
        "sequence_time_bucket"
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_identifier_sequences_company_type"
      ON "identifier_sequences" ("company_id", "identifier_type")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "generated_identifiers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "identifier_type" varchar(50) NOT NULL,
        "identifier_value" varchar(150) NOT NULL,
        "company_id" uuid NOT NULL,
        "related_entity_type" varchar(80) NULL,
        "related_entity_id" uuid NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_generated_identifiers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_generated_identifiers_value"
          UNIQUE ("identifier_value"),
        CONSTRAINT "FK_generated_identifiers_company"
          FOREIGN KEY ("company_id") REFERENCES "companies"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_generated_identifiers_company_type"
      ON "generated_identifiers" ("company_id", "identifier_type")
    `);
  }

  async down(queryRunner: QueryRunner) {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_generated_identifiers_company_type"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "generated_identifiers"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_identifier_sequences_company_type"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_identifier_sequences_scope"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "identifier_sequences"
    `);
  }
}
