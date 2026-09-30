import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Registers the claims reports served by ClaimsReportGenerator
 * (generator_key "claims"). Frozen list; idempotent on report code.
 */
const COMMON_PARAMETERS = [
  { key: 'period_start', label: 'From', dataType: 'DATE', required: false },
  { key: 'period_end', label: 'To', dataType: 'DATE', required: false },
  { key: 'branch_id', label: 'Branch', dataType: 'UUID', required: false },
  { key: 'product_id', label: 'Product', dataType: 'UUID', required: false },
  { key: 'category_id', label: 'Insurance class', dataType: 'UUID', required: false },
  { key: 'status', label: 'Claim status', dataType: 'STRING', required: false },
];

const REPORTS: Array<[code: string, name: string, description: string]> = [
  ['CLAIMS_REGISTER', 'Claims Register', 'Every claim with policy, customer, amounts and status'],
  ['CLAIMS_OUTSTANDING', 'Outstanding Claims', 'Open claims with an approved amount not yet paid'],
  ['CLAIMS_PAID', 'Paid Claims', 'Claims with confirmed payments'],
  ['CLAIMS_REJECTED', 'Rejected Claims', 'Claims rejected by the insurer'],
  ['CLAIMS_RESERVE', 'Claims Reserve Report', 'Reserve movements (initial, increases, reductions, releases)'],
  ['CLAIMS_BY_PRODUCT', 'Claims by Product', 'Claim counts and amounts per insurance product'],
  ['CLAIMS_BY_CLASS', 'Claims by Insurance Class', 'Claim counts and amounts per insurance class'],
  ['CLAIMS_BY_BRANCH', 'Claims by Branch', 'Claim counts and amounts per branch'],
  ['CLAIMS_BY_CLAIMANT', 'Claims by Claimant', 'Claim counts and amounts per claimant'],
  ['CLAIMS_BY_LOSS_TYPE', 'Claims by Loss Type', 'Claim counts and amounts per loss type'],
  ['CLAIMS_BY_STATUS', 'Claims by Status', 'Claim counts and amounts per lifecycle status'],
  ['CLAIMS_PAYMENTS', 'Claims Payment Report', 'Claim payments with disbursement and TIRA status'],
  ['CLAIMS_ASSESSMENTS', 'Claims Assessment Report', 'Assessments and reassessments with approved amounts'],
  ['CLAIMS_TIRA_SUBMISSIONS', 'TIRA Claims Submission Report', 'Every claim submission to TIRAMIS and its outcome'],
];

export class ClaimsReportDefinitions1791000000001 implements MigrationInterface {
  name = 'ClaimsReportDefinitions1791000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [code, name, description] of REPORTS) {
      await queryRunner.query(
        `INSERT INTO "report_definitions" (
           "code", "name", "description", "generator_key", "default_format",
           "supported_formats", "enabled", "category", "version", "sensitivity",
           "permission", "maximum_rows", "asynchronous_only", "parameters", "active"
         )
         VALUES ($1, $2, $3, 'claims', 'XLSX', '["XLSX","CSV","JSON"]'::jsonb, true,
                 'CLAIMS', 1, 'CONFIDENTIAL', 'claims:report-read', 100000, false,
                 $4::jsonb, true)
         ON CONFLICT ("code") DO NOTHING`,
        [code, name, description, JSON.stringify(COMMON_PARAMETERS)],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "report_definitions" WHERE "generator_key" = 'claims' AND "code" = ANY($1::text[])`,
      [REPORTS.map(([code]) => code)],
    );
  }
}
