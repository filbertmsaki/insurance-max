import { MigrationInterface, QueryRunner } from 'typeorm';

const PERMISSIONS = [
  {
    name: 'reconciliation:read',
    displayName: 'Read reconciliation batches',
    description: 'Allow viewing finance reconciliation batches and items',
  },
  {
    name: 'reconciliation:create',
    displayName: 'Create reconciliation batches',
    description: 'Allow creating finance reconciliation batches',
  },
  {
    name: 'reconciliation:import',
    displayName: 'Import reconciliation statements',
    description: 'Allow importing reconciliation statement lines',
  },
  {
    name: 'reconciliation:match',
    displayName: 'Match reconciliation items',
    description: 'Allow matching reconciliation items to payments and receipts',
  },
  {
    name: 'reconciliation:approve',
    displayName: 'Approve reconciliation batches',
    description: 'Allow approving matched reconciliation batches',
  },
  {
    name: 'reconciliation:post',
    displayName: 'Post reconciliation batches',
    description: 'Allow posting approved reconciliation batches',
  },
] as const;

const TIRAMIS_CONFIGURATION_PERMISSIONS = [
  'company-tiramis-config:read',
  'company-tiramis-config:update',
  'company-tiramis-config:validate',
] as const;

const TIRAMIS_CONFIGURATION_ROLE_NAMES = [
  'ADMINISTRATOR',
  'INSURANCE_ADMIN',
] as const;

export class Phase18OperationalWorkflowPermissions1796303000000 implements MigrationInterface {
  name = 'Phase18OperationalWorkflowPermissions1796303000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const permission of PERMISSIONS) {
      await queryRunner.query(
        `
          INSERT INTO "permissions" (
            "name",
            "display_name",
            "description",
            "is_system_generated",
            "assignment_scope",
            "assignable_to_company_role",
            "assignable_to_platform_role"
          )
          VALUES ($1, $2, $3, true, 'shared', true, true)
          ON CONFLICT ("name")
          DO UPDATE SET
            "display_name" = EXCLUDED."display_name",
            "description" = EXCLUDED."description",
            "is_system_generated" = true,
            "assignment_scope" = 'shared',
            "assignable_to_company_role" = true,
            "assignable_to_platform_role" = true,
            "is_deprecated" = false
        `,
        [permission.name, permission.displayName, permission.description],
      );
    }

    await queryRunner.query(`
      INSERT INTO "permission_role" ("roles_id", "permissions_id")
      SELECT role.id, permission.id
      FROM "roles" role
      INNER JOIN "permissions" existing_permission
        ON existing_permission.name = 'billing:reconciliation-manage'
      INNER JOIN "permission_role" existing_role_permission
        ON existing_role_permission."roles_id" = role.id
       AND existing_role_permission."permissions_id" = existing_permission.id
      INNER JOIN "permissions" permission
        ON permission.name IN (
          'reconciliation:read',
          'reconciliation:create',
          'reconciliation:import',
          'reconciliation:match',
          'reconciliation:approve',
          'reconciliation:post'
        )
      ON CONFLICT DO NOTHING
    `);

    for (const roleName of TIRAMIS_CONFIGURATION_ROLE_NAMES) {
      await queryRunner.query(
        `
          INSERT INTO "permission_role" ("roles_id", "permissions_id")
          SELECT role.id, permission.id
          FROM "roles" role
          INNER JOIN "permissions" permission
            ON permission.name IN (
              'company-tiramis-config:read',
              'company-tiramis-config:update',
              'company-tiramis-config:validate'
            )
          WHERE role.name = $1
          ON CONFLICT DO NOTHING
        `,
        [roleName],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "permission_role"
      WHERE "permissions_id" IN (
        SELECT id
        FROM "permissions"
        WHERE "name" IN (
          'reconciliation:read',
          'reconciliation:create',
          'reconciliation:import',
          'reconciliation:match',
          'reconciliation:approve',
          'reconciliation:post'
        )
      )
    `);

    await queryRunner.query(`
      DELETE FROM "permissions"
      WHERE "name" IN (
        'reconciliation:read',
        'reconciliation:create',
        'reconciliation:import',
        'reconciliation:match',
        'reconciliation:approve',
        'reconciliation:post'
      )
    `);

    await queryRunner.query(`
      DELETE FROM "permission_role"
      WHERE "permissions_id" IN (
        SELECT id
        FROM "permissions"
        WHERE "name" IN (
          'company-tiramis-config:read',
          'company-tiramis-config:update',
          'company-tiramis-config:validate'
        )
      )
      AND "roles_id" IN (
        SELECT id
        FROM "roles"
        WHERE "name" IN ('ADMINISTRATOR', 'INSURANCE_ADMIN')
      )
    `);
  }
}
