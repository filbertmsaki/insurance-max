import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Configurable quotation approval. Data only — no schema change: the policy
 * itself lives in `company_configs` (key `quotation_approval_policy`).
 *
 * - quotations:direct-approve is NOT granted to any role: it is given to
 *   selected users, who must also be enabled in the approval policy.
 * - quotations:approval-policy:manage goes to the company administrator roles.
 * Frozen values on purpose.
 */
const PERMISSIONS = [
  {
    name: 'quotations:direct-approve',
    displayName: 'Complete and approve own quotations',
    description:
      'Approve own eligible quotations without a second approver, within the limits set in the quotation approval policy.',
    roles: [] as string[],
  },
  {
    name: 'quotations:approval-policy:manage',
    displayName: 'Manage quotation approval policy',
    description:
      'Configure automatic approval rules and which users may directly approve quotations, with their limits.',
    roles: ['ADMINISTRATOR', 'INSURANCE_ADMIN'],
  },
];

export class QuotationApprovalPolicyPermissions1795900000000 implements MigrationInterface {
  name = 'QuotationApprovalPolicyPermissions1795900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const permission of PERMISSIONS) {
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
      if (permission.roles.length === 0) continue;
      await queryRunner.query(
        `
        INSERT INTO "permission_role" ("roles_id", "permissions_id")
        SELECT role."id", permission."id"
        FROM "roles" role
        CROSS JOIN "permissions" permission
        WHERE role."name" = ANY($2)
          AND permission."name" = $1
        ON CONFLICT DO NOTHING
      `,
        [permission.name, permission.roles],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const permission of PERMISSIONS) {
      await queryRunner.query(
        `
        DELETE FROM "company_user_permissions"
        WHERE "permission_id" IN (SELECT "id" FROM "permissions" WHERE "name" = $1)
      `,
        [permission.name],
      );
      await queryRunner.query(
        `
        DELETE FROM "permission_role"
        WHERE "permissions_id" IN (SELECT "id" FROM "permissions" WHERE "name" = $1)
      `,
        [permission.name],
      );
      await queryRunner.query(`DELETE FROM "permissions" WHERE "name" = $1`, [
        permission.name,
      ]);
    }
    await queryRunner.query(
      `DELETE FROM "company_configs" WHERE "config_key" = 'quotation_approval_policy'`,
    );
  }
}
