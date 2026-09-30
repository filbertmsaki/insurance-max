import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Underwrite module foundation (additive only).
 *
 * 1. `policies.business_line` (MOTOR | FLEET | NON_MOTOR), backfilled from the
 *    source quotation flow, falling back to the product business line.
 * 2. Line-level `underwrite.*` permissions, granted to every role and direct
 *    membership grant that already holds the equivalent legacy permission.
 *
 * The permission list is a frozen snapshot on purpose: migrations must not
 * change meaning when the application constants evolve.
 */
const LINES = [
  { key: 'motor', label: 'Motor' },
  { key: 'fleet', label: 'Fleet' },
  { key: 'non_motor', label: 'Non-Motor' },
] as const;

const ACTIONS: Array<{
  action: string;
  displayName: string;
  description: string;
  legacy: string[];
}> = [
  {
    action: 'view',
    displayName: 'view quotations',
    description: 'Access the line and view its quotations',
    legacy: ['quotations:read'],
  },
  {
    action: 'create',
    displayName: 'create quotations',
    description: 'Create and complete quotations in the line',
    legacy: ['quotations:create'],
  },
  {
    action: 'edit',
    displayName: 'edit quotations',
    description: 'Edit quotations in the line',
    legacy: ['quotations:update'],
  },
  {
    action: 'delete',
    displayName: 'delete quotations',
    description: 'Delete draft quotations in the line',
    legacy: ['quotations:delete-draft', 'quotations:delete'],
  },
  {
    action: 'approve',
    displayName: 'approve',
    description: 'Approve quotations and policy transactions in the line',
    legacy: [
      'quotations:approve',
      'endorsements:approve',
      'cancellations:approve',
    ],
  },
  {
    action: 'policies.view',
    displayName: 'view policies',
    description: 'View policies in the line',
    legacy: ['policies:read'],
  },
  {
    action: 'policies.edit',
    displayName: 'edit policies',
    description: 'Amend administrative policy details in the line',
    legacy: ['policies:update'],
  },
  {
    action: 'renewals.view',
    displayName: 'view renewals',
    description: 'View renewals in the line',
    legacy: ['renewals:read'],
  },
  {
    action: 'renewals.manage',
    displayName: 'manage renewals',
    description: 'Start and progress renewals in the line',
    legacy: ['renewals:create'],
  },
  {
    action: 'endorsements.view',
    displayName: 'view endorsements',
    description: 'View endorsements in the line',
    legacy: ['endorsements:create', 'policy-transactions:read'],
  },
  {
    action: 'endorsements.manage',
    displayName: 'manage endorsements',
    description: 'Create and progress endorsements in the line',
    legacy: ['endorsements:create'],
  },
  {
    action: 'cancellations.view',
    displayName: 'view cancellations',
    description: 'View cancellations in the line',
    legacy: ['cancellations:read'],
  },
  {
    action: 'cancellations.manage',
    displayName: 'manage cancellations',
    description: 'Create and progress cancellations in the line',
    legacy: ['cancellations:create'],
  },
  {
    action: 'tira.retry',
    displayName: 'retry TIRA submissions',
    description: 'Retry or resubmit failed TIRA submissions in the line',
    legacy: [
      'quotations:retry-tiramis',
      'endorsements:retry-tiramis',
      'cancellations:submit-tiramis',
    ],
  },
];

export const UNDERWRITE_MIGRATION_PERMISSIONS: Array<{
  name: string;
  displayName: string;
  description: string;
  legacy: string[];
}> = [
  {
    name: 'underwrite.dashboard.view',
    displayName: 'Underwrite: view dashboard',
    description: 'View the Underwrite overview dashboard',
    legacy: ['quotations:read', 'policies:read'],
  },
  ...LINES.flatMap((line) =>
    ACTIONS.map((action) => ({
      name: `underwrite.${line.key}.${action.action}`,
      displayName: `Underwrite ${line.label}: ${action.displayName}`,
      description: `${action.description} (${line.label})`,
      legacy: action.legacy,
    })),
  ),
];

export class UnderwriteLinesAndPermissions1790800000000 implements MigrationInterface {
  name = 'UnderwriteLinesAndPermissions1790800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "policies"
      ADD COLUMN IF NOT EXISTS "business_line" character varying(20)
    `);

    await queryRunner.query(`
      UPDATE "policies" policy
      SET "business_line" = CASE quotation."quotation_flow"
        WHEN 'MOTOR_FLEET' THEN 'FLEET'
        WHEN 'MOTOR_SINGLE' THEN 'MOTOR'
        ELSE 'NON_MOTOR'
      END
      FROM "quotations" quotation
      WHERE quotation."id" = policy."quotation_id"
        AND policy."business_line" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "policies" policy
      SET "business_line" = CASE product."business_line"
        WHEN 'MOTOR' THEN 'MOTOR'
        ELSE 'NON_MOTOR'
      END
      FROM "insurance_products" product
      WHERE product."id" = policy."product_id"
        AND policy."business_line" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_policies_company_business_line"
      ON "policies" ("company_id", "business_line")
    `);

    for (const permission of UNDERWRITE_MIGRATION_PERMISSIONS) {
      await queryRunner.query(
        `
        INSERT INTO "permissions" (
          "id",
          "name",
          "display_name",
          "description",
          "is_system_generated",
          "assignment_scope",
          "assignable_to_company_role",
          "assignable_to_platform_role",
          "is_deprecated"
        )
        VALUES (uuid_generate_v4(), $1, $2, $3, true, 'shared', true, true, false)
        ON CONFLICT ("name") DO NOTHING
      `,
        [permission.name, permission.displayName, permission.description],
      );

      await queryRunner.query(
        `
        INSERT INTO "permission_role" ("roles_id", "permissions_id")
        SELECT DISTINCT existing."roles_id", target."id"
        FROM "permission_role" existing
        JOIN "permissions" legacy ON legacy."id" = existing."permissions_id"
        JOIN "permissions" target ON target."name" = $1
        WHERE legacy."name" = ANY($2::text[])
        ON CONFLICT DO NOTHING
      `,
        [permission.name, permission.legacy],
      );

      await queryRunner.query(
        `
        INSERT INTO "company_user_permissions" ("company_user_id", "permission_id")
        SELECT DISTINCT existing."company_user_id", target."id"
        FROM "company_user_permissions" existing
        JOIN "permissions" legacy ON legacy."id" = existing."permission_id"
        JOIN "permissions" target ON target."name" = $1
        WHERE legacy."name" = ANY($2::text[])
        ON CONFLICT ("company_user_id", "permission_id") DO NOTHING
      `,
        [permission.name, permission.legacy],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const names = UNDERWRITE_MIGRATION_PERMISSIONS.map(
      (permission) => permission.name,
    );

    await queryRunner.query(
      `
      DELETE FROM "company_user_permissions" grant_row
      USING "permissions" permission
      WHERE grant_row."permission_id" = permission."id"
        AND permission."name" = ANY($1::text[])
    `,
      [names],
    );
    await queryRunner.query(
      `
      DELETE FROM "permission_role" permission_role
      USING "permissions" permission
      WHERE permission_role."permissions_id" = permission."id"
        AND permission."name" = ANY($1::text[])
    `,
      [names],
    );
    await queryRunner.query(
      `DELETE FROM "permissions" WHERE "name" = ANY($1::text[])`,
      [names],
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_policies_company_business_line"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policies" DROP COLUMN IF EXISTS "business_line"`,
    );
  }
}
