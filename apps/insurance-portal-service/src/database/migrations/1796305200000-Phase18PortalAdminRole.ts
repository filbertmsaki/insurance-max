import { MigrationInterface, QueryRunner } from 'typeorm';

const PORTAL_ADMIN_PERMISSION_NAMES = [
  'portal:account-read',
  'portal:account-invite',
  'portal:account-update',
  'portal:account-suspend',
  'portal:request-read',
  'portal:request-assign',
  'portal:request-review',
  'portal:request-complete',
  'work-items:read',
  'work-items:claim',
  'work-items:execute',
  'work-items:assign',
  'work-items:reassign',
  'work-items:cancel',
  'work-items:manage',
  'notifications:read',
  'notifications:manage-preferences',
  'communications:read',
  'communications:create-thread',
  'communications:send',
  'communications:assign',
  'communications:close',
  'audit:verify-chain',
  'operations:health-read',
  'operations:release-read',
  'invoices:read',
  'invoices:issue',
  'invoices:void',
  'payments:read',
  'payments:record-manual',
  'receipts:read',
  'receipts:post',
  'receipts:allocate',
  'receipts:reverse',
  'refunds:read',
  'refunds:request',
  'refunds:approve',
  'refunds:pay',
  'refunds:cancel',
  'reconciliation:read',
  'reconciliation:create',
  'reconciliation:import',
  'reconciliation:match',
  'reconciliation:approve',
  'reconciliation:post',
  'company-tiramis-config:read',
  'company-tiramis-config:update',
  'company-tiramis-config:validate',
  'view_company_dashboard',
  'view_company_data',
  'users:read',
  'branches:read',
  'departments:read',
  'customers:read',
] as const;

export class Phase18PortalAdminRole1796305200000
  implements MigrationInterface
{
  name = 'Phase18PortalAdminRole1796305200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "roles" (
        "id",
        "name",
        "display_name",
        "description",
        "company_id",
        "is_system_generated",
        "scope",
        "is_administrative",
        "created_at",
        "updated_at"
      )
      SELECT
        uuid_generate_v4(),
        'PORTAL_ADMIN',
        'Portal Administrator',
        'Administrator for portal accounts, requests, communications, and operational readiness workflows',
        NULL,
        true,
        'tenant_template',
        true,
        NOW(),
        NOW()
      WHERE NOT EXISTS (
        SELECT 1
        FROM "roles"
        WHERE "name" = 'PORTAL_ADMIN'
          AND "company_id" IS NULL
      )
    `);

    await queryRunner.query(`
      INSERT INTO "roles" (
        "id",
        "name",
        "display_name",
        "description",
        "company_id",
        "is_system_generated",
        "scope",
        "is_administrative",
        "created_at",
        "updated_at"
      )
      SELECT
        uuid_generate_v4(),
        'PORTAL_ADMIN',
        'Portal Administrator',
        'Administrator for portal accounts, requests, communications, and operational readiness workflows',
        company.id,
        true,
        'tenant',
        true,
        NOW(),
        NOW()
      FROM "companies" company
      WHERE NOT EXISTS (
        SELECT 1
        FROM "roles" role
        WHERE role."name" = 'PORTAL_ADMIN'
          AND role."company_id" = company.id
      )
    `);

    await queryRunner.query(`
      UPDATE "roles"
      SET
        "display_name" = 'Portal Administrator',
        "description" = 'Administrator for portal accounts, requests, communications, and operational readiness workflows',
        "is_system_generated" = true,
        "is_administrative" = true,
        "updated_at" = NOW()
      WHERE "name" = 'PORTAL_ADMIN'
    `);

    await queryRunner.query(
      `
        INSERT INTO "permission_role" ("roles_id", "permissions_id")
        SELECT role.id, permission.id
        FROM "roles" role
        INNER JOIN "permissions" permission
          ON permission.name = ANY($1::text[])
        WHERE role.name = 'PORTAL_ADMIN'
        ON CONFLICT DO NOTHING
      `,
      [[...PORTAL_ADMIN_PERMISSION_NAMES]],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "permission_role"
      WHERE "roles_id" IN (
        SELECT id
        FROM "roles"
        WHERE "name" = 'PORTAL_ADMIN'
      )
    `);

    await queryRunner.query(`
      DELETE FROM "roles"
      WHERE "name" = 'PORTAL_ADMIN'
    `);
  }
}
