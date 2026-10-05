#!/usr/bin/env node
import { createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { once } from 'node:events';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: 'apps/insurance-portal-service/.env' });

const { Pool } = pg;
const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outputPath = outIndex >= 0 ? args[outIndex + 1] : null;
if (!outputPath || outputPath.startsWith('--')) {
  console.error(
    'Usage: node scripts/access-control-review.mjs --out <report.csv>',
  );
  process.exit(2);
}

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: sslConfig() }
    : {
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
        user: process.env.DB_USERNAME ?? 'postgres',
        password: process.env.DB_PASSWORD ?? 'root',
        database: process.env.DB_DATABASE ?? 'insurance_portal_db',
        ssl: sslConfig(),
      },
);

function sslConfig() {
  if (process.env.DB_SSL !== 'true') return undefined;
  return {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
  };
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function scopeImpact(before, after) {
  const rank = { USER: 0, DEPARTMENT: 1, BRANCH: 1, COMPANY: 2 };
  if (!after || !before) return 'REVIEW';
  if (before === after) return 'UNCHANGED';
  if (before === 'DEPARTMENT' && after === 'BRANCH')
    return 'REVIEW_INCOMPARABLE';
  if (before === 'BRANCH' && after === 'DEPARTMENT')
    return 'REVIEW_INCOMPARABLE';
  return rank[after] > rank[before]
    ? 'POTENTIAL_BROADENING'
    : 'POTENTIAL_NARROWING';
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query(
      'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
    );
    const { rows: featureRows } = await client.query(`
      SELECT
        to_regclass('public.role_permission_scopes') IS NOT NULL AS has_role_scopes,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'company_user_permissions'
            AND column_name = 'data_scope'
        ) AS has_direct_scope
    `);
    const { has_role_scopes: hasRoleScopes, has_direct_scope: hasDirectScope } =
      featureRows[0];
    const roleScopeJoin = hasRoleScopes
      ? `LEFT JOIN role_permission_scopes rps
           ON rps.role_id = role.id AND rps.permission_id = permission.id`
      : '';
    const roleScopeSelect = hasRoleScopes
      ? 'rps.data_scope, rps.scope_branch_id, rps.scope_department_id'
      : 'NULL::varchar AS data_scope, NULL::uuid AS scope_branch_id, NULL::uuid AS scope_department_id';
    const directScopeSelect = hasDirectScope
      ? 'direct.data_scope, direct.scope_branch_id, direct.scope_department_id'
      : 'NULL::varchar AS data_scope, NULL::uuid AS scope_branch_id, NULL::uuid AS scope_department_id';

    const { rows } = await client.query(`
      WITH assigned AS (
        SELECT membership.company_id, company.name AS company_name,
          membership.id AS membership_id, membership.user_id,
          role.name AS role_name, permission.name AS permission_name,
          'ROLE'::varchar AS assignment_source,
          ${roleScopeSelect},
          membership.quotation_policy_data_scope AS legacy_scope,
          role.company_id AS role_company_id
        FROM company_users membership
        JOIN companies company ON company.id = membership.company_id
        JOIN company_user_roles role_assignment
          ON role_assignment.company_user_id = membership.id
        JOIN roles role ON role.id = role_assignment.role_id
        JOIN permission_role role_permission ON role_permission.roles_id = role.id
        JOIN permissions permission ON permission.id = role_permission.permissions_id
        ${roleScopeJoin}
        WHERE membership.status = 'active'
          AND (role.company_id IS NULL OR role.company_id = membership.company_id)

        UNION ALL

        SELECT membership.company_id, company.name AS company_name,
          membership.id AS membership_id, membership.user_id,
          NULL::varchar AS role_name, permission.name AS permission_name,
          'DIRECT'::varchar AS assignment_source,
          ${directScopeSelect},
          membership.quotation_policy_data_scope AS legacy_scope,
          NULL::uuid AS role_company_id
        FROM company_users membership
        JOIN companies company ON company.id = membership.company_id
        JOIN company_user_permissions direct ON direct.company_user_id = membership.id
        JOIN permissions permission ON permission.id = direct.permission_id
        WHERE membership.status = 'active'
      ), assigned_targets AS (
        SELECT assigned.*,
          branch.company_id AS target_branch_company_id,
          department.company_id AS target_department_company_id,
          department.branch_id AS target_department_branch_id
        FROM assigned
        LEFT JOIN branches branch ON branch.id = assigned.scope_branch_id
        LEFT JOIN departments department ON department.id = assigned.scope_department_id
      ), member_assignments AS (
        SELECT membership.id AS membership_id,
          COALESCE(array_agg(DISTINCT branch_user.branch_id)
            FILTER (WHERE branch_user.branch_id IS NOT NULL), ARRAY[]::uuid[]) AS assigned_branch_ids,
          COALESCE(array_agg(DISTINCT department_user.department_id)
            FILTER (WHERE department_user.department_id IS NOT NULL), ARRAY[]::uuid[]) AS assigned_department_ids
        FROM company_users membership
        LEFT JOIN branch_users branch_user
          ON branch_user.company_user_id = membership.id
        LEFT JOIN department_users department_user
          ON department_user.company_user_id = membership.id
        WHERE membership.status = 'active'
        GROUP BY membership.id
      )
      SELECT assigned_targets.*,
        member_assignments.assigned_branch_ids, member_assignments.assigned_department_ids
      FROM assigned_targets
      JOIN member_assignments USING (membership_id)
      ORDER BY company_name, user_id, role_name NULLS LAST, permission_name, assignment_source
    `);
    await client.query('COMMIT');

    const output = resolve(outputPath);
    const stream = createWriteStream(output, { encoding: 'utf8' });
    const headers = [
      'company_id',
      'company_name',
      'membership_id',
      'user_id',
      'role_name',
      'permission_name',
      'assignment_source',
      'scope_before',
      'scope_after',
      'scope_impact',
      'scope_target_branch_id',
      'scope_target_department_id',
      'target_branch_company_id',
      'target_department_company_id',
      'target_department_branch_id',
      'assigned_branch_ids',
      'assigned_department_ids',
      'role_company_id',
      'company_isolated',
      'target_assignment_valid',
      'scope_enforcement_status',
    ];
    stream.write(`${headers.map(csvCell).join(',')}\n`);
    const summary = {
      assignmentRows: rows.length,
      potentialBroadening: 0,
      incomparableTargets: 0,
      invalidTargets: 0,
      explicitRoleScopes: rows.filter(
        (row) => row.assignment_source === 'ROLE' && row.data_scope,
      ).length,
      explicitDirectScopes: rows.filter(
        (row) => row.assignment_source === 'DIRECT' && row.data_scope,
      ).length,
      legacyRoleScopeFallbacks: rows.filter(
        (row) => row.assignment_source === 'ROLE' && !row.data_scope,
      ).length,
      scopeStorage: {
        directGrantScopes: hasDirectScope,
        rolePermissionScopeTable: hasRoleScopes,
      },
      enforcement:
        'PARTIAL: per-permission scopes are enforced for quote, policy, and policy-transaction paths; review remaining route coverage before activation',
    };

    for (const row of rows) {
      const after = row.data_scope ?? row.legacy_scope;
      const impact = scopeImpact(row.legacy_scope, after);
      const companyIsolated =
        !row.role_company_id || row.role_company_id === row.company_id;
      const branchTargetValid =
        !row.scope_branch_id ||
        (row.target_branch_company_id === row.company_id &&
          row.assigned_branch_ids.includes(row.scope_branch_id));
      const departmentTargetValid =
        !row.scope_department_id ||
        (row.target_department_company_id === row.company_id &&
          row.assigned_department_ids.includes(row.scope_department_id));
      const targetValid = branchTargetValid && departmentTargetValid;
      if (impact === 'POTENTIAL_BROADENING') summary.potentialBroadening += 1;
      if (impact === 'REVIEW_INCOMPARABLE') summary.incomparableTargets += 1;
      if (!targetValid || !companyIsolated) summary.invalidTargets += 1;

      const values = [
        row.company_id,
        row.company_name,
        row.membership_id,
        row.user_id,
        row.role_name,
        row.permission_name,
        row.assignment_source,
        row.legacy_scope,
        after,
        impact,
        row.scope_branch_id,
        row.scope_department_id,
        row.target_branch_company_id,
        row.target_department_company_id,
        row.target_department_branch_id,
        row.assigned_branch_ids,
        row.assigned_department_ids,
        row.role_company_id,
        companyIsolated,
        targetValid,
        'PARTIAL',
      ];
      if (!stream.write(`${values.map(csvCell).join(',')}\n`))
        await once(stream, 'drain');
    }
    stream.end();
    await once(stream, 'finish');
    console.log(JSON.stringify({ report: output, ...summary }, null, 2));
    if (
      summary.potentialBroadening ||
      summary.incomparableTargets ||
      summary.invalidTargets
    ) {
      console.error(
        'Review flagged rows before activating any new scope enforcement.',
      );
      process.exitCode = 1;
    }
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(
    `Access review failed: ${error instanceof Error ? error.message : 'unknown error'}`,
  );
  process.exitCode = 1;
});
