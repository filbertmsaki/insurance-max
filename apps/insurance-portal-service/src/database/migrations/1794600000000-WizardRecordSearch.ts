import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Must equal `customerSearchDocumentSql()` without the table alias
 * (`customers/utils/customer-search.util.ts`); otherwise PostgreSQL will not
 * use the index for the wizard customer search. A unit test checks this.
 */
export const CUSTOMER_SEARCH_INDEX_EXPRESSION =
  "lower(coalesce(customer_no, '') || ' ' || coalesce(display_name, '') || ' ' || " +
  "coalesce(first_name, '') || ' ' || coalesce(middle_name, '') || ' ' || " +
  "coalesce(last_name, '') || ' ' || coalesce(company_name, '') || ' ' || " +
  "regexp_replace(coalesce(id_number, ''), '[^A-Za-z0-9]', '', 'g') || ' ' || " +
  "regexp_replace(coalesce(nida_no, ''), '[^A-Za-z0-9]', '', 'g') || ' ' || " +
  "regexp_replace(coalesce(passport_no, ''), '[^A-Za-z0-9]', '', 'g') || ' ' || " +
  "regexp_replace(coalesce(driving_license_no, ''), '[^A-Za-z0-9]', '', 'g') || ' ' || " +
  "regexp_replace(coalesce(voter_no, ''), '[^A-Za-z0-9]', '', 'g') || ' ' || " +
  "regexp_replace(coalesce(zanid_no, ''), '[^A-Za-z0-9]', '', 'g') || ' ' || " +
  "regexp_replace(coalesce(tin, ''), '[^A-Za-z0-9]', '', 'g') || ' ' || " +
  "regexp_replace(coalesce(registration_no, ''), '[^A-Za-z0-9]', '', 'g') || ' ' || " +
  "regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') || ' ' || " +
  "regexp_replace(coalesce(alternate_phone, ''), '[^0-9]', '', 'g'))";

/**
 * Server-side search for the quotation wizards:
 * - trigram index over one customer "search document" (names, identifiers
 *   without separators, phone digits);
 * - backfills the normalised vehicle identifiers that quotation-created
 *   vehicles never received, and indexes them for registration / chassis
 *   lookups.
 */
export class WizardRecordSearch1794600000000 implements MigrationInterface {
  name = 'WizardRecordSearch1794600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    await queryRunner.query(`
      UPDATE "motor_vehicles"
         SET "registration_no_normalized" =
             NULLIF(regexp_replace(upper("registration_no"), '[^A-Z0-9]', '', 'g'), '')
       WHERE "registration_no" IS NOT NULL
         AND "registration_no_normalized" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "motor_vehicles"
         SET "chassis_no_normalized" =
             NULLIF(regexp_replace(upper("chassis_no"), '[^A-Z0-9]', '', 'g'), '')
       WHERE "chassis_no" IS NOT NULL
         AND "chassis_no_normalized" IS NULL
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_customers_search_trgm" ON "customers" USING gin ((${CUSTOMER_SEARCH_INDEX_EXPRESSION}) gin_trgm_ops) WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_motor_vehicles_registration_no_normalized_trgm" ON "motor_vehicles" USING gin ("registration_no_normalized" gin_trgm_ops) WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_motor_vehicles_chassis_no_normalized_trgm" ON "motor_vehicles" USING gin ("chassis_no_normalized" gin_trgm_ops) WHERE "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_motor_vehicles_chassis_no_normalized_trgm"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_motor_vehicles_registration_no_normalized_trgm"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_customers_search_trgm"`,
    );
    // The backfilled identifiers and the pg_trgm extension are kept: the
    // values are correct data and other objects may depend on the extension.
  }
}
