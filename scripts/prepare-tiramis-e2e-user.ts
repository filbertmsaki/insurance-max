import 'reflect-metadata';

import dataSource from '../apps/insurance-portal-service/src/database/data-source';
import { TiramisPermissions } from '../apps/insurance-portal-service/src/modules/tiramis/auth/tiramis-permissions.constant';

const email =
  process.env.E2E_AUTH_EMAIL ||
  process.env.TIRAMIS_E2E_AUTH_EMAIL ||
  process.argv.find((arg) => arg.startsWith('--email='))?.slice(8);
const listUsers = process.argv.includes('--list');

const companyId =
  process.env.E2E_COMPANY_ID ||
  process.env.TIRAMIS_E2E_COMPANY_ID ||
  process.argv.find((arg) => arg.startsWith('--company-id='))?.slice(13);

const requiredPermissions = [
  TiramisPermissions.SUBMIT,
  TiramisPermissions.VALIDATE,
  TiramisPermissions.VIEW_TRACKING,
  TiramisPermissions.MONITORING_VIEW,
  TiramisPermissions.CONFIG_VIEW,
  TiramisPermissions.SYNC,
  TiramisPermissions.RETRY,
  TiramisPermissions.AUDIT_VIEW,
  TiramisPermissions.NOTIFICATION_VIEW,
];

async function main() {
  if (!email && !listUsers) {
    throw new Error(
      'Provide E2E_AUTH_EMAIL or --email for an existing company user, or use --list.',
    );
  }

  await dataSource.initialize();

  try {
    if (listUsers) {
      const rows = await dataSource.query(
        `
          SELECT
            u.email,
            u.user_type,
            cu.company_id,
            c.name AS company_name,
            cu.status,
            cu.is_default
          FROM company_users cu
          JOIN users u ON u.id = cu.user_id
          JOIN companies c ON c.id = cu.company_id
          WHERE cu.status = 'active'
          ORDER BY cu.is_default DESC, c.name ASC, u.email ASC
          LIMIT 50
        `,
      );

      console.table(rows);
      return;
    }

    const users = await dataSource.query(
      `
        SELECT id, email, user_type
        FROM users
        WHERE lower(email) = lower($1)
        LIMIT 1
      `,
      [email],
    );
    const user = users?.[0];

    if (!user) {
      throw new Error(`User not found: ${email}`);
    }

    const memberships = await dataSource.query(
      `
        SELECT cu.id, cu.company_id, c.name AS company_name, cu.status
        FROM company_users cu
        JOIN companies c ON c.id = cu.company_id
        WHERE cu.user_id = $1
          AND cu.status = 'active'
          ${companyId ? 'AND cu.company_id = $2' : ''}
        ORDER BY cu.is_default DESC, cu.created_at ASC
        LIMIT 1
      `,
      companyId ? [user.id, companyId] : [user.id],
    );
    const membership = memberships?.[0];

    if (!membership) {
      throw new Error(
        companyId
          ? `User ${email} is not an active member of company ${companyId}`
          : `User ${email} has no active company membership`,
      );
    }

    for (const permission of requiredPermissions) {
      await dataSource.query(
        `
          INSERT INTO permissions (
            name,
            display_name,
            description,
            is_system_generated,
            assignment_scope,
            assignable_to_company_role,
            assignable_to_platform_role,
            is_deprecated,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, true, 'tenant', true, false, false, now(), now())
          ON CONFLICT (name)
          DO UPDATE SET
            display_name = EXCLUDED.display_name,
            description = EXCLUDED.description,
            assignment_scope = 'tenant',
            assignable_to_company_role = true,
            is_deprecated = false,
            updated_at = now()
        `,
        [
          permission,
          permission
            .replace(/^tiramis\./, 'TIRAMIS ')
            .replace(/\./g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase()),
          `Required for TIRAMIS E2E and operational validation.`,
        ],
      );

      await dataSource.query(
        `
          INSERT INTO company_user_permissions (
            company_user_id,
            permission_id,
            created_at
          )
          SELECT $1, p.id, now()
          FROM permissions p
          WHERE p.name = $2
          ON CONFLICT (company_user_id, permission_id) DO NOTHING
        `,
        [membership.id, permission],
      );
    }

    await dataSource.query(
      `
        UPDATE company_users
        SET authorization_version = authorization_version + 1,
            updated_at = now()
        WHERE id = $1
      `,
      [membership.id],
    );

    console.log({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        userType: user.user_type,
      },
      company: {
        id: membership.company_id,
        name: membership.company_name,
      },
      grantedPermissions: requiredPermissions,
      nextStep:
        'Set E2E_AUTH_EMAIL/E2E_AUTH_PASSWORD to this company user and rerun node scripts/tiramis-e2e-test.js',
    });
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
