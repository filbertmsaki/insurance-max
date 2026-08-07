import { MigrationInterface, QueryRunner } from 'typeorm';

const PERMISSIONS = [
  {
    name: 'invoices:read',
    displayName: 'Read invoices',
    description: 'Allow viewing invoices within finance operations',
  },
  {
    name: 'invoices:issue',
    displayName: 'Issue invoices',
    description: 'Allow issuing draft invoices in finance operations',
  },
  {
    name: 'invoices:void',
    displayName: 'Void invoices',
    description: 'Allow voiding invoices in finance operations',
  },
  {
    name: 'payments:read',
    displayName: 'Read payment transactions',
    description: 'Allow viewing payment transactions in finance operations',
  },
  {
    name: 'payments:record-manual',
    displayName: 'Record manual payment transactions',
    description:
      'Allow recording manual payment transactions in finance operations',
  },
  {
    name: 'receipts:read',
    displayName: 'Read receipts',
    description: 'Allow viewing receipts in finance operations',
  },
  {
    name: 'receipts:post',
    displayName: 'Post receipts',
    description: 'Allow posting receipts in finance operations',
  },
  {
    name: 'receipts:allocate',
    displayName: 'Allocate receipts',
    description: 'Allow allocating receipts in finance operations',
  },
  {
    name: 'receipts:reverse',
    displayName: 'Reverse receipts',
    description: 'Allow reversing receipts in finance operations',
  },
  {
    name: 'refunds:read',
    displayName: 'Read refunds',
    description: 'Allow viewing refunds in finance operations',
  },
  {
    name: 'refunds:request',
    displayName: 'Request refunds',
    description: 'Allow requesting refunds in finance operations',
  },
  {
    name: 'refunds:approve',
    displayName: 'Approve refunds',
    description: 'Allow approving refunds in finance operations',
  },
  {
    name: 'refunds:pay',
    displayName: 'Pay refunds',
    description: 'Allow paying approved refunds in finance operations',
  },
  {
    name: 'refunds:cancel',
    displayName: 'Cancel refunds',
    description: 'Allow canceling refunds in finance operations',
  },
] as const;

export class Phase18FinanceOperationPermissions1796303600000
  implements MigrationInterface
{
  name = 'Phase18FinanceOperationPermissions1796303600000';

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

    await this.assignByLegacyPermission(queryRunner, 'billing:read', [
      'invoices:read',
      'payments:read',
      'receipts:read',
      'refunds:read',
    ]);

    await this.assignByLegacyPermission(queryRunner, 'billing:create', [
      'payments:record-manual',
      'refunds:request',
    ]);

    await this.assignByLegacyPermission(queryRunner, 'billing:invoice-issue', [
      'invoices:issue',
    ]);

    await this.assignByLegacyPermission(queryRunner, 'billing:invoice-void', [
      'invoices:void',
    ]);

    await this.assignByLegacyPermission(queryRunner, 'billing:receipt-post', [
      'receipts:post',
    ]);

    await this.assignByLegacyPermission(
      queryRunner,
      'billing:receipt-allocate',
      ['receipts:allocate'],
    );

    await this.assignByLegacyPermission(queryRunner, 'billing:receipt-reverse', [
      'receipts:reverse',
    ]);

    await this.assignByLegacyPermission(queryRunner, 'billing:update', [
      'refunds:approve',
      'refunds:pay',
      'refunds:cancel',
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "permission_role"
      WHERE "permissions_id" IN (
        SELECT id
        FROM "permissions"
        WHERE "name" IN (
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
          'refunds:cancel'
        )
      )
    `);

    await queryRunner.query(`
      DELETE FROM "permissions"
      WHERE "name" IN (
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
        'refunds:cancel'
      )
    `);
  }

  private async assignByLegacyPermission(
    queryRunner: QueryRunner,
    legacyPermissionName: string,
    newPermissionNames: readonly string[],
  ): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO "permission_role" ("roles_id", "permissions_id")
        SELECT role.id, permission.id
        FROM "roles" role
        INNER JOIN "permissions" existing_permission
          ON existing_permission.name = $1
        INNER JOIN "permission_role" existing_role_permission
          ON existing_role_permission."roles_id" = role.id
         AND existing_role_permission."permissions_id" = existing_permission.id
        INNER JOIN "permissions" permission
          ON permission.name = ANY($2::text[])
        ON CONFLICT DO NOTHING
      `,
      [legacyPermissionName, [...newPermissionNames]],
    );
  }
}
