import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillQuotationPolicyScopesAndReportDimensions1790295000000 implements MigrationInterface {
  name = 'BackfillQuotationPolicyScopesAndReportDimensions1790295000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "product_performance_snapshots"
      ADD COLUMN IF NOT EXISTS "department_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "product_performance_snapshots"
      ADD COLUMN IF NOT EXISTS "user_id" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_perf_snapshots_scope_branch"
      ON "product_performance_snapshots" ("company_id", "branch_id", "snapshot_date")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_perf_snapshots_scope_department"
      ON "product_performance_snapshots" ("company_id", "department_id", "snapshot_date")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_perf_snapshots_scope_user"
      ON "product_performance_snapshots" ("company_id", "user_id", "snapshot_date")
    `);

    await queryRunner.query(`
      UPDATE "company_users" membership
      SET "quotation_policy_data_scope" = 'COMPANY'
      WHERE membership."status" = 'active'
        AND (
          EXISTS (
            SELECT 1
            FROM "company_user_roles" assignment
            INNER JOIN "roles" role ON role."id" = assignment."role_id"
            WHERE assignment."company_user_id" = membership."id"
              AND role."is_administrative" = true
          )
          OR EXISTS (
            SELECT 1
            FROM "company_user_permissions" direct_permission
            INNER JOIN "permissions" permission
              ON permission."id" = direct_permission."permission_id"
            WHERE direct_permission."company_user_id" = membership."id"
              AND permission."name" = 'data-scope:company-all'
          )
          OR EXISTS (
            SELECT 1
            FROM "company_user_roles" assignment
            INNER JOIN "permission_role" role_permission
              ON role_permission."roles_id" = assignment."role_id"
            INNER JOIN "permissions" permission
              ON permission."id" = role_permission."permissions_id"
            WHERE assignment."company_user_id" = membership."id"
              AND permission."name" = 'data-scope:company-all'
          )
        )
    `);

    await queryRunner.query(`
      UPDATE "company_users" membership
      SET "quotation_policy_data_scope" = 'BRANCH'
      WHERE membership."status" = 'active'
        AND membership."quotation_policy_data_scope" = 'USER'
        AND (
          EXISTS (
            SELECT 1
            FROM "branch_users" branch_assignment
            WHERE branch_assignment."company_user_id" = membership."id"
          )
          OR EXISTS (
            SELECT 1
            FROM "company_user_permissions" direct_permission
            INNER JOIN "permissions" permission
              ON permission."id" = direct_permission."permission_id"
            WHERE direct_permission."company_user_id" = membership."id"
              AND permission."name" = 'data-scope:assigned-branches'
          )
          OR EXISTS (
            SELECT 1
            FROM "company_user_roles" assignment
            INNER JOIN "permission_role" role_permission
              ON role_permission."roles_id" = assignment."role_id"
            INNER JOIN "permissions" permission
              ON permission."id" = role_permission."permissions_id"
            WHERE assignment."company_user_id" = membership."id"
              AND permission."name" = 'data-scope:assigned-branches'
          )
        )
    `);

    await queryRunner.query(`
      UPDATE "company_users" membership
      SET "quotation_policy_data_scope" = 'DEPARTMENT'
      WHERE membership."status" = 'active'
        AND membership."quotation_policy_data_scope" = 'USER'
        AND EXISTS (
          SELECT 1
          FROM "department_users" department_assignment
          WHERE department_assignment."company_user_id" = membership."id"
        )
    `);

    await this.backfillReportScopeMetadata(queryRunner, 'report_schedules');
    await this.backfillReportScopeMetadata(queryRunner, 'report_jobs');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_product_perf_snapshots_scope_user"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_product_perf_snapshots_scope_department"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_product_perf_snapshots_scope_branch"`,
    );
    await queryRunner.query(`
      ALTER TABLE "product_performance_snapshots"
      DROP COLUMN IF EXISTS "user_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "product_performance_snapshots"
      DROP COLUMN IF EXISTS "department_id"
    `);
  }

  private async backfillReportScopeMetadata(
    queryRunner: QueryRunner,
    tableName: 'report_schedules' | 'report_jobs',
  ): Promise<void> {
    const userColumn =
      tableName === 'report_schedules' ? 'created_by' : 'requested_by';
    const scopeColumn =
      tableName === 'report_schedules' ? 'metadata' : 'execution_context';
    const scopeKey =
      tableName === 'report_schedules' ? 'reporting_scope' : 'reportingScope';

    await queryRunner.query(`
      UPDATE "${tableName}" report
      SET "${scopeColumn}" = COALESCE(report."${scopeColumn}", '{}'::jsonb)
        || jsonb_build_object(
          '${scopeKey}',
          CASE membership."quotation_policy_data_scope"
            WHEN 'COMPANY' THEN jsonb_build_object(
              'quotationPolicyDataScope', 'COMPANY'
            )
            WHEN 'BRANCH' THEN jsonb_build_object(
              'quotationPolicyDataScope', 'BRANCH',
              'branchIds', COALESCE((
                SELECT jsonb_agg(branch_assignment."branch_id"::text)
                FROM "branch_users" branch_assignment
                WHERE branch_assignment."company_user_id" = membership."id"
              ), '[]'::jsonb)
            )
            WHEN 'DEPARTMENT' THEN jsonb_build_object(
              'quotationPolicyDataScope', 'DEPARTMENT',
              'departmentIds', COALESCE((
                SELECT jsonb_agg(department_assignment."department_id"::text)
                FROM "department_users" department_assignment
                WHERE department_assignment."company_user_id" = membership."id"
              ), '[]'::jsonb)
            )
            ELSE jsonb_build_object(
              'quotationPolicyDataScope', 'USER',
              'userId', report."${userColumn}"::text
            )
          END
        )
      FROM "report_definitions" definition
      CROSS JOIN "company_users" membership
      WHERE report."definition_id" = definition."id"
        AND definition."generator_key" = 'product-performance'
        AND report."${userColumn}" IS NOT NULL
        AND membership."company_id" = report."company_id"
        AND membership."user_id" = report."${userColumn}"
        AND membership."status" = 'active'
    `);
  }
}
