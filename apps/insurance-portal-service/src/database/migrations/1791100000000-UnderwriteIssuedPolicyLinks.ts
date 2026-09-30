import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Underwrite issuance follow-ups (additive, re-runnable):
 *
 * - `policy_non_motor_risk_details`: the Non-Motor risk details a policy was
 *   issued with, frozen from `quotation_non_motor_details`. One row per
 *   policy. (`non_motor_policy_details` needs a subject matter, which
 *   Underwrite quotations do not capture.)
 * - Backfills `motor_fleets.policy_id` / `motor_fleet_items.policy_risk_id`
 *   and the Non-Motor snapshot for policies issued before this change.
 */
export class UnderwriteIssuedPolicyLinks1791100000000 implements MigrationInterface {
  name = 'UnderwriteIssuedPolicyLinks1791100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "policy_non_motor_risk_details" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "policy_id" uuid NOT NULL,
        "quotation_id" uuid,
        "product_id" uuid,
        "sub_class_id" uuid,
        "risk_data" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "schema_snapshot" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "risk_location" character varying(255),
        "limit_of_liability" numeric(18,2),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_policy_non_motor_risk_details" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_policy_non_motor_risk_details_policy" UNIQUE ("policy_id"),
        CONSTRAINT "FK_policy_non_motor_risk_details_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_policy_non_motor_risk_details_policy" FOREIGN KEY ("policy_id")
          REFERENCES "policies"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      INSERT INTO "policy_non_motor_risk_details"
        (company_id, policy_id, quotation_id, product_id, sub_class_id,
         risk_data, schema_snapshot, risk_location, limit_of_liability)
      SELECT detail.company_id, policy.id, detail.quotation_id,
             detail.product_id, detail.sub_class_id, detail.risk_data,
             detail.schema_snapshot, detail.risk_location,
             detail.limit_of_liability
        FROM policies policy
        JOIN quotations quotation ON quotation.id = policy.quotation_id
        JOIN quotation_non_motor_details detail
          ON detail.quotation_id = quotation.id
       WHERE quotation.quotation_flow = 'NON_MOTOR'
      ON CONFLICT (policy_id) DO NOTHING
    `);

    // The latest issued policy per fleet quotation owns the fleet.
    await queryRunner.query(`
      UPDATE motor_fleets fleet
         SET policy_id = issued.policy_id,
             status = CASE WHEN fleet.status IN ('DRAFT', 'QUOTED') THEN 'ACTIVE' ELSE fleet.status END,
             updated_at = now()
        FROM (
          SELECT DISTINCT ON (policy.quotation_id)
                 policy.quotation_id, policy.id AS policy_id
            FROM policies policy
            JOIN quotations quotation ON quotation.id = policy.quotation_id
           WHERE quotation.quotation_flow = 'MOTOR_FLEET'
             AND policy.deleted_at IS NULL
           ORDER BY policy.quotation_id, policy.created_at DESC
        ) issued
       WHERE fleet.quotation_id = issued.quotation_id
         AND fleet.policy_id IS NULL
         AND fleet.deleted_at IS NULL
    `);

    await queryRunner.query(`
      UPDATE motor_fleet_items item
         SET policy_risk_id = policy_risk.id,
             updated_at = now()
        FROM motor_fleets fleet, policy_risks policy_risk
       WHERE fleet.id = item.fleet_id
         AND fleet.policy_id IS NOT NULL
         AND fleet.deleted_at IS NULL
         AND item.deleted_at IS NULL
         AND item.policy_risk_id IS NULL
         AND policy_risk.policy_id = fleet.policy_id
         AND policy_risk.deleted_at IS NULL
         AND policy_risk.quotation_entry_risk_id = item.quotation_entry_risk_id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Fleet links are left in place: they are correct data, and the columns
    // pre-date this migration.
    await queryRunner.query(
      `DROP TABLE IF EXISTS "policy_non_motor_risk_details"`,
    );
  }
}
