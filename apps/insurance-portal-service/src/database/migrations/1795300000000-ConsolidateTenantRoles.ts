import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Trims the tenant role catalogue:
 *  - CLAIMS_FINANCE folds into CLAIMS_MANAGER, which already holds all of its
 *    permissions.
 *  - PRODUCT_ADMINISTRATOR folds into PRODUCT_APPROVER, which gains the
 *    authoring permissions (an approver's own drafts publish without review).
 *  - Company-scoped copies of another company type's administrator role are
 *    removed (e.g. BROKER_ADMIN inside an insurer). Copies someone still holds
 *    are kept and reported, never silently stripped.
 * Members of retired roles move to the replacement role of their company and
 * get an authorization-version bump so live sessions pick up the change.
 */
export class ConsolidateTenantRoles1795300000000 implements MigrationInterface {
  name = 'ConsolidateTenantRoles1795300000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      INSERT INTO permission_role (roles_id, permissions_id)
      SELECT approver.id, grant_row.permissions_id
      FROM roles approver
      JOIN roles author
        ON author.name = 'PRODUCT_ADMINISTRATOR'
       AND author.company_id IS NOT DISTINCT FROM approver.company_id
      JOIN permission_role grant_row ON grant_row.roles_id = author.id
      WHERE approver.name = 'PRODUCT_APPROVER'
      ON CONFLICT DO NOTHING;

      DO $$
      DECLARE pair record;
      BEGIN
        FOR pair IN
          SELECT * FROM (VALUES
            ('CLAIMS_FINANCE', 'CLAIMS_MANAGER'),
            ('PRODUCT_ADMINISTRATOR', 'PRODUCT_APPROVER')
          ) AS v(from_name, to_name)
        LOOP
          -- Move members to the replacement role, preferring the company's
          -- own copy over the shared template.
          INSERT INTO company_user_roles (company_user_id, role_id)
          SELECT moved.company_user_id, moved.target_role_id
          FROM (
            SELECT assignment.company_user_id,
              (SELECT target.id FROM roles target
                WHERE target.name = pair.to_name
                  AND (target.company_id = membership.company_id OR target.company_id IS NULL)
                ORDER BY target.company_id IS NULL
                LIMIT 1) AS target_role_id
            FROM company_user_roles assignment
            JOIN roles retired ON retired.id = assignment.role_id AND retired.name = pair.from_name
            JOIN company_users membership ON membership.id = assignment.company_user_id
          ) moved
          WHERE moved.target_role_id IS NOT NULL
          ON CONFLICT ON CONSTRAINT "UQ_company_user_roles_membership_role" DO NOTHING;

          UPDATE company_users
          SET authorization_version = authorization_version + 1, updated_at = now()
          WHERE id IN (
            SELECT assignment.company_user_id
            FROM company_user_roles assignment
            JOIN roles retired ON retired.id = assignment.role_id
            WHERE retired.name = pair.from_name
          );

          DELETE FROM role_user
          WHERE roles_id IN (SELECT id FROM roles WHERE name = pair.from_name);
          -- company_user_roles, permission_role and role_permission_scopes cascade.
          DELETE FROM roles WHERE name = pair.from_name;
        END LOOP;
      END $$;

      DO $$
      DECLARE kept integer;
      BEGIN
        CREATE TEMP TABLE admin_role_by_type (company_type text, role_name text) ON COMMIT DROP;
        INSERT INTO admin_role_by_type VALUES
          ('INSURANCE_COMPANY', 'INSURANCE_ADMIN'),
          ('REINSURANCE_COMPANY', 'REINSURANCE_ADMIN'),
          ('REINSURANCE_BROKER', 'ADMINISTRATOR'),
          ('BROKER', 'BROKER_ADMIN'),
          ('AGENCY', 'AGENCY_ADMIN'),
          ('BANCASSURANCE', 'BANCASSURANCE_ADMIN'),
          ('SERVICE_PROVIDER', 'SERVICE_PROVIDER_ADMIN');

        CREATE TEMP TABLE mismatched_admin_roles ON COMMIT DROP AS
        SELECT role.id,
          EXISTS (SELECT 1 FROM company_user_roles assignment WHERE assignment.role_id = role.id)
            OR EXISTS (SELECT 1 FROM role_user legacy WHERE legacy.roles_id = role.id) AS held
        FROM roles role
        JOIN companies company ON company.id = role.company_id
        WHERE role.name IN (SELECT role_name FROM admin_role_by_type)
          AND role.name <> COALESCE(
            (SELECT role_name FROM admin_role_by_type WHERE company_type = company.company_type::text),
            'ADMINISTRATOR');

        DELETE FROM roles WHERE id IN (SELECT id FROM mismatched_admin_roles WHERE NOT held);

        SELECT count(*) INTO kept FROM mismatched_admin_roles WHERE held;
        IF kept > 0 THEN
          RAISE NOTICE 'Kept % mismatched company admin role(s) that members still hold; reassign them, then delete.', kept;
        END IF;
      END $$;
    `);
  }

  async down(): Promise<void> {
    // Irreversible: retired roles and removed copies are recreated by the
    // seed only if their definitions are restored; member moves are not
    // recorded.
  }
}
