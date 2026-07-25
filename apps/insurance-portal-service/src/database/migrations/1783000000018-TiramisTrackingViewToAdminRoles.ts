import { MigrationInterface, QueryRunner } from 'typeorm';

export class TiramisTrackingViewToAdminRoles1783000000018 implements MigrationInterface {
  name = 'TiramisTrackingViewToAdminRoles1783000000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO "permission_role" ("roles_id", "permissions_id")
        SELECT role.id, permission.id
        FROM "roles" role
        INNER JOIN "permissions" permission
          ON permission.name = 'tiramis.tracking.view'
        WHERE role.name IN (
          'ADMINISTRATOR',
          'INSURANCE_ADMIN',
          'REINSURANCE_ADMIN',
          'BROKER_ADMIN',
          'AGENCY_ADMIN',
          'BANCASSURANCE_ADMIN',
          'SERVICE_PROVIDER_ADMIN'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "permission_role" role_permission
          WHERE role_permission."roles_id" = role.id
            AND role_permission."permissions_id" = permission.id
        )
      `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        DELETE FROM "permission_role"
        WHERE "permissions_id" = (
          SELECT id
          FROM "permissions"
          WHERE name = 'tiramis.tracking.view'
          LIMIT 1
        )
        AND "roles_id" IN (
          SELECT id
          FROM "roles"
          WHERE name IN (
            'ADMINISTRATOR',
            'INSURANCE_ADMIN',
            'REINSURANCE_ADMIN',
            'BROKER_ADMIN',
            'AGENCY_ADMIN',
            'BANCASSURANCE_ADMIN',
            'SERVICE_PROVIDER_ADMIN'
          )
        )
      `,
    );
  }
}
