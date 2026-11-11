import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cover-level underwriting access (Short-Term Single / Short-Term Fleet).
 *
 * 1. `quotations.underwrite_cover`, classified for existing rows. A row is
 *    Short-Term only when every risk (stored risks and draft payload risks)
 *    is the transit risk, the product is the Short-Term product and the
 *    cover period is at most 30 days. Everything else, including mixed
 *    records and drafts without risks, gets its whole line (MOTOR, FLEET,
 *    NON_MOTOR), which only line holders may access: ambiguous history never
 *    becomes visible to a restricted grant.
 * 2. New permissions: `underwrite.<line>.submit` and the restricted cover
 *    permissions `underwrite.short_term[_fleet].<action>`. Cover permissions
 *    are granted to nobody.
 * 3. Gate backfill. The general `tenant/quotations` and policy routes now
 *    enforce cover gates. Each role (and direct membership grant set) that
 *    holds a quotation/policy permission but no gate for the matching action
 *    receives that gate on the lines it already works in (every line when it
 *    holds no line gate at all), which is exactly the access it had before.
 *
 * Values are a frozen snapshot on purpose: migrations must not change
 * meaning when the application constants evolve.
 */
const LINE_KEYS = ['motor', 'fleet', 'non_motor'] as const;
const LINE_LABELS: Record<(typeof LINE_KEYS)[number], string> = {
  motor: 'Motor',
  fleet: 'Fleet',
  non_motor: 'Non-Motor',
};

/** Every line action that existed before this migration, plus `submit`. */
const LINE_ACTIONS = [
  'view',
  'create',
  'edit',
  'delete',
  'submit',
  'approve',
  'policies.view',
  'policies.edit',
  'renewals.view',
  'renewals.manage',
  'endorsements.view',
  'endorsements.manage',
  'cancellations.view',
  'cancellations.manage',
  'tira.retry',
];

const SHORT_TERM = {
  productCode: 'SP014001000000',
  riskCode: 'SP014001000007',
  maxCoverDays: 30,
};

const COVERS = [
  {
    key: 'short_term',
    label: 'Short-Term Single',
    description:
      'Short-Term (In-Transit), one vehicle (SP014001000000 / SP014001000007, up to 30 days)',
    line: 'Motor',
  },
  {
    key: 'short_term_fleet',
    label: 'Short-Term Fleet',
    description:
      'Short-Term (In-Transit), fleet (SP014001000000 / SP014001000007, up to 30 days)',
    line: 'Fleet',
  },
] as const;

const COVER_ACTIONS: Array<{ action: string; label: string }> = [
  { action: 'view', label: 'View quotations' },
  { action: 'create', label: 'Create and complete quotations' },
  { action: 'edit', label: 'Edit quotations' },
  { action: 'delete', label: 'Delete draft quotations' },
  {
    action: 'submit',
    label: 'Submit for approval, request payment and submit to TIRA',
  },
  { action: 'approve', label: 'Approve quotations' },
  { action: 'policies.view', label: 'View policies and documents' },
  { action: 'tira.retry', label: 'Retry failed TIRA submissions' },
];

const SUBMIT_LEGACY = [
  'quotations:submit-approval',
  'quotations:request-payment',
  'quotations:submit-tiramis',
];

export const UNDERWRITE_COVER_MIGRATION_PERMISSIONS: Array<{
  name: string;
  displayName: string;
  description: string;
  legacy: string[];
}> = [
  ...LINE_KEYS.map((key) => ({
    name: `underwrite.${key}.submit`,
    displayName: `Underwrite ${LINE_LABELS[key]}: submit quotations`,
    description: `Submit quotations for approval, request payment and submit to TIRA in the line (${LINE_LABELS[key]})`,
    legacy: SUBMIT_LEGACY,
  })),
  ...COVERS.flatMap((cover) =>
    COVER_ACTIONS.map((item) => ({
      name: `underwrite.${cover.key}.${item.action}`,
      displayName: `Underwrite ${cover.label}: ${item.label.toLowerCase()}`,
      description: `${item.label} for ${cover.description} only. Does not grant other ${cover.line} business.`,
      legacy: [] as string[],
    })),
  ),
];

/** Scope permission → cover action enforced on the general routes. */
const SCOPE_PERMISSION_ACTIONS: Record<string, string> = {
  'quotations:read': 'view',
  'quotations:create': 'create',
  'quotations:complete': 'create',
  'quotations:update': 'edit',
  'quotations:cancel': 'edit',
  'quotations:delete-draft': 'delete',
  'quotations:delete': 'delete',
  'quotations:submit-approval': 'submit',
  'quotations:request-payment': 'submit',
  'quotations:submit-tiramis': 'submit',
  'quotations:retry-tiramis': 'tira.retry',
  'quotations:approve': 'approve',
  'quotations:approve-high-risk': 'approve',
  'quotations:direct-approve': 'approve',
  'quotations:request-changes': 'approve',
  'quotations:reject': 'approve',
  'policies:read': 'policies.view',
  'policies:update': 'policies.edit',
};

function linePermissionNames(key: string): string[] {
  return LINE_ACTIONS.map((action) => `underwrite.${key}.${action}`);
}

/** Holder sources: roles and direct membership grants. */
const SOURCES = [
  {
    table: 'permission_role',
    holder: 'roles_id',
    permission: 'permissions_id',
    conflict: 'ON CONFLICT DO NOTHING',
  },
  {
    table: 'company_user_permissions',
    holder: 'company_user_id',
    permission: 'permission_id',
    conflict: 'ON CONFLICT ("company_user_id", "permission_id") DO NOTHING',
  },
] as const;

export class UnderwriteCoverAccess1796000000000 implements MigrationInterface {
  name = 'UnderwriteCoverAccess1796000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "underwrite_cover" character varying(32)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quotations_company_underwrite_cover"
      ON "quotations" ("company_id", "underwrite_cover")
    `);

    await queryRunner.query(
      `
      WITH risk_codes AS (
        SELECT cover_note.quotation_id, UPPER(TRIM(risk.risk_code)) AS code
        FROM quotation_cover_notes cover_note
        JOIN quotation_cover_note_entries entry
          ON entry.cover_note_id = cover_note.id
        JOIN quotation_entry_risks risk ON risk.entry_id = entry.id
        UNION
        SELECT quotation.id, UPPER(TRIM(payload_risk #>> '{}'))
        FROM quotations quotation
        CROSS JOIN LATERAL jsonb_path_query(
          quotation.draft_payload,
          'strict $.**.risk_code'
        ) AS payload_risk
        WHERE quotation.draft_payload IS NOT NULL
          AND jsonb_typeof(payload_risk) = 'string'
      ),
      facts AS (
        SELECT
          quotation.id,
          quotation.quotation_flow::text AS flow,
          UPPER(TRIM(product.product_code)) AS product_code,
          COUNT(codes.code) FILTER (WHERE codes.code <> '') AS risk_count,
          COUNT(codes.code) FILTER (WHERE codes.code = $1) AS transit_count,
          MAX(cover_note.cover_note_end_date) - MIN(cover_note.cover_note_start_date) AS period
        FROM quotations quotation
        LEFT JOIN insurance_products product ON product.id = quotation.product_id
        LEFT JOIN risk_codes codes ON codes.quotation_id = quotation.id
        LEFT JOIN quotation_cover_notes cover_note
          ON cover_note.quotation_id = quotation.id
        WHERE quotation.underwrite_cover IS NULL
        GROUP BY quotation.id, quotation.quotation_flow, product.product_code
      )
      UPDATE quotations quotation
      SET underwrite_cover = CASE
        WHEN facts.flow NOT IN ('MOTOR_SINGLE', 'MOTOR_FLEET') THEN 'NON_MOTOR'
        WHEN facts.risk_count > 0
          AND facts.transit_count = facts.risk_count
          AND facts.product_code = $2
          AND (facts.period IS NULL
            OR (facts.period >= interval '0'
              AND facts.period <= make_interval(days => $3)))
          THEN CASE facts.flow
            WHEN 'MOTOR_FLEET' THEN 'SHORT_TERM_FLEET'
            ELSE 'SHORT_TERM_SINGLE'
          END
        WHEN facts.flow = 'MOTOR_FLEET' THEN 'FLEET'
        ELSE 'MOTOR'
      END
      FROM facts
      WHERE facts.id = quotation.id
    `,
      [SHORT_TERM.riskCode, SHORT_TERM.productCode, SHORT_TERM.maxCoverDays],
    );

    for (const permission of UNDERWRITE_COVER_MIGRATION_PERMISSIONS) {
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
    }

    const actions = [...new Set(Object.values(SCOPE_PERMISSION_ACTIONS))];
    for (const action of actions) {
      const legacy = Object.entries(SCOPE_PERMISSION_ACTIONS)
        .filter(([, value]) => value === action)
        .map(([name]) => name);
      const gates = [
        ...LINE_KEYS.map((key) => `underwrite.${key}.${action}`),
        ...COVERS.map((cover) => `underwrite.${cover.key}.${action}`),
      ];
      // One statement per source so every line is decided from the state
      // before this action's grants (granting Motor first must not hide the
      // "no gate yet" condition from Fleet).
      for (const source of SOURCES) {
        await queryRunner.query(
          `
          INSERT INTO "${source.table}" ("${source.holder}", "${source.permission}")
          SELECT DISTINCT holder."${source.holder}", target."id"
          FROM "${source.table}" holder
          JOIN "permissions" legacy ON legacy."id" = holder."${source.permission}"
          CROSS JOIN unnest($1::text[]) AS line(key)
          JOIN "permissions" target
            ON target."name" = 'underwrite.' || line.key || '.' || $2
          WHERE legacy."name" = ANY($3::text[])
            AND NOT EXISTS (
              SELECT 1 FROM "${source.table}" gate
              JOIN "permissions" gate_permission
                ON gate_permission."id" = gate."${source.permission}"
              WHERE gate."${source.holder}" = holder."${source.holder}"
                AND gate_permission."name" = ANY($4::text[])
            )
            AND (
              EXISTS (
                SELECT 1 FROM "${source.table}" line_gate
                JOIN "permissions" line_permission
                  ON line_permission."id" = line_gate."${source.permission}"
                WHERE line_gate."${source.holder}" = holder."${source.holder}"
                  AND line_permission."name" = ANY($5::text[])
                  AND starts_with(line_permission."name", 'underwrite.' || line.key || '.')
              )
              OR NOT EXISTS (
                SELECT 1 FROM "${source.table}" any_gate
                JOIN "permissions" any_permission
                  ON any_permission."id" = any_gate."${source.permission}"
                WHERE any_gate."${source.holder}" = holder."${source.holder}"
                  AND any_permission."name" = ANY($5::text[])
              )
            )
          ${source.conflict}
        `,
          [
            [...LINE_KEYS],
            action,
            legacy,
            gates,
            LINE_KEYS.flatMap(linePermissionNames),
          ],
        );
      }
    }
  }

  /**
   * Removes the column and the permissions this migration created. Gates
   * backfilled onto pre-existing line permissions are kept: they restate
   * access the holders already had on the general routes.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    const names = UNDERWRITE_COVER_MIGRATION_PERMISSIONS.map(
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
      `DROP INDEX IF EXISTS "IDX_quotations_company_underwrite_cover"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP COLUMN IF EXISTS "underwrite_cover"`,
    );
  }
}
