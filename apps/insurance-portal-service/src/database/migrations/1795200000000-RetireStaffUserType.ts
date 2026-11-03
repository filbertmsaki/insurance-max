import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * STAFF never carried behaviour of its own; inside a tenant it acted like
 * COMPANY_USER without the USER-role policy bundle. Fold it into COMPANY_USER.
 * The down migration cannot tell which users were STAFF, so it is a no-op.
 */
export class RetireStaffUserType1795200000000 implements MigrationInterface {
  name = 'RetireStaffUserType1795200000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(
      `UPDATE users SET user_type = 'COMPANY_USER' WHERE user_type = 'STAFF'`,
    );
  }

  async down(): Promise<void> {
    // Irreversible: the original STAFF users are not recorded.
  }
}
