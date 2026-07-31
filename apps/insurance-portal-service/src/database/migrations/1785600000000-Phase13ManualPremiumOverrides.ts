import { MigrationInterface, QueryRunner } from 'typeorm';

const PERMISSIONS = [
  {
    name: 'pricing.override.request',
    displayName: 'Request manual premium overrides',
    description:
      'Allow requesting a manual premium override on quotation risks',
  },
  {
    name: 'pricing.override.approve',
    displayName: 'Approve manual premium overrides',
    description:
      'Allow approving manual premium override requests on quotation risks',
  },
  {
    name: 'pricing.override.reject',
    displayName: 'Reject manual premium overrides',
    description:
      'Allow rejecting manual premium override requests on quotation risks',
  },
  {
    name: 'pricing.override.view',
    displayName: 'View manual premium overrides',
    description:
      'Allow viewing manual premium override history on quotation risks',
  },
] as const;

const REQUEST_AND_VIEW_ROLES = [
  'SUPER_ADMIN',
  'OWNER',
  'INSURANCE_ADMIN',
  'REINSURANCE_ADMIN',
  'BROKER_ADMIN',
  'AGENCY_ADMIN',
  'BANCASSURANCE_ADMIN',
] as const;

const APPROVER_ROLES = [
  'SUPER_ADMIN',
  'OWNER',
  'INSURANCE_ADMIN',
  'REINSURANCE_ADMIN',
] as const;

export class Phase13ManualPremiumOverrides1785600000000 implements MigrationInterface {
  name = 'Phase13ManualPremiumOverrides1785600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quotation_risk_premium_overrides" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "risk_id" uuid NOT NULL,
        "sequence_no" integer NOT NULL,
        "original_calculated_premium" numeric(20,4) NOT NULL,
        "proposed_premium" numeric(20,4) NOT NULL,
        "difference_amount" numeric(20,4) NOT NULL,
        "difference_percentage" numeric(18,10),
        "override_reason" character varying(150) NOT NULL,
        "supporting_notes" text,
        "requested_by" uuid,
        "requested_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "approval_status" character varying(20) NOT NULL DEFAULT 'PENDING',
        "approved_by" uuid,
        "approved_at" TIMESTAMP WITH TIME ZONE,
        "rejection_reason" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_qrpo_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_qrpo_risk_id" FOREIGN KEY ("risk_id") REFERENCES "quotation_entry_risks"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_qrpo_requested_by" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "FK_qrpo_approved_by" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_qrpo_risk_id"
      ON "quotation_risk_premium_overrides" ("risk_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_qrpo_risk_sequence"
      ON "quotation_risk_premium_overrides" ("risk_id", "sequence_no")
    `);
    await queryRunner
      .query(
        `
      ALTER TABLE "quotation_risk_premium_overrides"
      ADD CONSTRAINT "CHK_qrpo_status"
      CHECK ("approval_status" IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'))
    `,
      )
      .catch(() => undefined);

    for (const permission of PERMISSIONS) {
      await queryRunner.query(
        `
          INSERT INTO "permissions" (
            "name",
            "display_name",
            "description",
            "is_system_generated"
          )
          VALUES ($1, $2, $3, true)
          ON CONFLICT ("name")
          DO UPDATE SET
            "display_name" = EXCLUDED."display_name",
            "description" = EXCLUDED."description",
            "is_system_generated" = true
        `,
        [permission.name, permission.displayName, permission.description],
      );
    }

    for (const roleName of REQUEST_AND_VIEW_ROLES) {
      await queryRunner.query(
        `
          INSERT INTO "permission_role" ("roles_id", "permissions_id")
          SELECT role.id, permission.id
          FROM "roles" role
          INNER JOIN "permissions" permission
            ON permission.name IN ('pricing.override.request', 'pricing.override.view')
          WHERE role.name = $1
          ON CONFLICT DO NOTHING
        `,
        [roleName],
      );
    }

    for (const roleName of APPROVER_ROLES) {
      await queryRunner.query(
        `
          INSERT INTO "permission_role" ("roles_id", "permissions_id")
          SELECT role.id, permission.id
          FROM "roles" role
          INNER JOIN "permissions" permission
            ON permission.name IN ('pricing.override.approve', 'pricing.override.reject', 'pricing.override.view')
          WHERE role.name = $1
          ON CONFLICT DO NOTHING
        `,
        [roleName],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "quotation_risk_premium_overrides" DROP CONSTRAINT IF EXISTS "CHK_qrpo_status"`,
    );

    await queryRunner.query(`
      DELETE FROM "permission_role"
      WHERE "permissions_id" IN (
        SELECT id
        FROM "permissions"
        WHERE "name" IN (
          'pricing.override.request',
          'pricing.override.approve',
          'pricing.override.reject',
          'pricing.override.view'
        )
      )
    `);

    await queryRunner.query(`
      DELETE FROM "permissions"
      WHERE "name" IN (
        'pricing.override.request',
        'pricing.override.approve',
        'pricing.override.reject',
        'pricing.override.view'
      )
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_qrpo_risk_sequence"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_qrpo_risk_id"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "quotation_risk_premium_overrides"`,
    );
  }
}
