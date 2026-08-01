import { environment } from '@insurance-max/shared-config';
import { DataSource, QueryRunner } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import {
  ALLIANCE_BRANCHES,
  ALLIANCE_SALE_POINTS,
  ALLIANCE_TENANT,
} from './data/alliance.seed-data';
import { requireColumns, withSeedTransaction } from './shared/seed-utils';

type RowWithId = {
  id: string;
};

export default class TiramisCompanySetupSeeder implements Seeder {
  public async run(
    dataSource: DataSource,
    _factoryManager: SeederFactoryManager,
  ): Promise<void> {
    await withSeedTransaction(
      dataSource,
      'seed:tiramis-company-setup',
      async (queryRunner) => {
        await requireColumns(queryRunner, 'companies', [
          'name',
          'slug',
          'identifier_prefix',
          'status',
          'company_type',
          'tira_company_code',
          'tira_insurer_company_code',
          'tira_client_code',
          'tira_system_code',
          'tira_system_name',
          'settings',
          'regulatory_metadata',
          'metadata',
        ]);

        await requireColumns(queryRunner, 'branches', [
          'company_id',
          'name',
          'code',
          'status',
        ]);

        await requireColumns(queryRunner, 'tiramis_company_configurations', [
          'company_id',
          'environment',
          'company_code',
          'client_code',
          'system_code',
          'is_active',
        ]);

        await requireColumns(queryRunner, 'tiramis_sale_points', [
          'company_id',
          'branch_id',
          'branch_code',
          'branch_name',
          'sale_point_code',
          'sale_point_name',
          'is_default',
          'is_active',
        ]);

        await this.correctExistingAllianceReferences(queryRunner);

        const companyId = await this.upsertAllianceCompany(queryRunner);

        await this.upsertPortalSideTiramisConfig(
          queryRunner,
          companyId,
          'test',
        );
        await this.upsertPortalSideTiramisConfig(
          queryRunner,
          companyId,
          'live',
        );
        await this.seedBranches(queryRunner, companyId);
        await this.seedSalePoints(queryRunner, companyId);
      },
    );

    console.log(
      `[TiramisCompanySetupSeeder] Alliance references seeded for ${ALLIANCE_TENANT.companyCode}`,
    );
  }

  private async correctExistingAllianceReferences(queryRunner: QueryRunner) {
    const wrongRows = await queryRunner.query(
      `
        SELECT id, name, slug, tira_company_code
        FROM companies
        WHERE deleted_at IS NULL
          AND (
            slug IN (
              'alliance-insurance-corporation',
              'alliance-insurance-company-limited'
            )
            OR name ILIKE '%ALLIANCE INSURANCE%'
          )
          AND tira_company_code IS NOT NULL
          AND tira_company_code <> $1
      `,
      [ALLIANCE_TENANT.companyCode],
    );

    if (
      wrongRows.length > 0 &&
      environment.SEED_ALLOW_REFERENCE_CORRECTION !== 'true'
    ) {
      throw new Error(
        `[TiramisCompanySetupSeeder] Existing Alliance company has wrong TIRA code. Expected ${ALLIANCE_TENANT.companyCode}. Set SEED_ALLOW_REFERENCE_CORRECTION=true only after backup/review.`,
      );
    }

    if (wrongRows.length === 0) {
      return;
    }

    await queryRunner.query(
      `
        UPDATE companies
        SET
          identifier_prefix = COALESCE(identifier_prefix, $1),
          tira_company_code = $2,
          tira_insurer_company_code = $3,
          tira_client_code = $4,
          tira_system_code = $5,
          tira_system_name = $6,
          updated_at = now()
        WHERE id = ANY($7::uuid[])
      `,
      [
        ALLIANCE_TENANT.identifierPrefix,
        ALLIANCE_TENANT.companyCode,
        ALLIANCE_TENANT.insurerCompanyCode,
        ALLIANCE_TENANT.clientCode,
        ALLIANCE_TENANT.systemCode,
        ALLIANCE_TENANT.systemName,
        wrongRows.map((row: RowWithId) => row.id),
      ],
    );
  }

  private async upsertAllianceCompany(
    queryRunner: QueryRunner,
  ): Promise<string> {
    const rows = await queryRunner.query(
      `
        INSERT INTO companies (
          name,
          slug,
          identifier_prefix,
          status,
          company_type,
          tira_company_code,
          tira_insurer_company_code,
          tira_client_code,
          tira_system_code,
          tira_system_name,
          settings,
          regulatory_metadata,
          metadata,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          'active',
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10::jsonb,
          $11::jsonb,
          $12::jsonb,
          now(),
          now()
        )
        ON CONFLICT (slug)
        DO UPDATE SET
          status = 'active',
          identifier_prefix = COALESCE(
            companies.identifier_prefix,
            EXCLUDED.identifier_prefix
          ),
          company_type = COALESCE(companies.company_type, EXCLUDED.company_type),
          tira_company_code = COALESCE(
            companies.tira_company_code,
            EXCLUDED.tira_company_code
          ),
          tira_insurer_company_code = COALESCE(
            companies.tira_insurer_company_code,
            EXCLUDED.tira_insurer_company_code
          ),
          tira_client_code = COALESCE(
            companies.tira_client_code,
            EXCLUDED.tira_client_code
          ),
          tira_system_code = COALESCE(
            companies.tira_system_code,
            EXCLUDED.tira_system_code
          ),
          tira_system_name = COALESCE(
            companies.tira_system_name,
            EXCLUDED.tira_system_name
          ),
          settings = COALESCE(companies.settings, '{}'::jsonb)
            || EXCLUDED.settings,
          regulatory_metadata = COALESCE(
            companies.regulatory_metadata,
            '{}'::jsonb
          ) || EXCLUDED.regulatory_metadata,
          metadata = COALESCE(companies.metadata, '{}'::jsonb)
            || EXCLUDED.metadata,
          updated_at = now()
        RETURNING id
      `,
      [
        ALLIANCE_TENANT.companyName,
        ALLIANCE_TENANT.slug,
        ALLIANCE_TENANT.identifierPrefix,
        ALLIANCE_TENANT.companyType,
        ALLIANCE_TENANT.companyCode,
        ALLIANCE_TENANT.insurerCompanyCode,
        ALLIANCE_TENANT.clientCode,
        ALLIANCE_TENANT.systemCode,
        ALLIANCE_TENANT.systemName,
        JSON.stringify({
          currency: ALLIANCE_TENANT.currency,
          timezone: ALLIANCE_TENANT.timezone,
        }),
        JSON.stringify({
          tiraCompanyCode: ALLIANCE_TENANT.companyCode,
          insurerCompanyCode: ALLIANCE_TENANT.insurerCompanyCode,
          clientCode: ALLIANCE_TENANT.clientCode,
          systemCode: ALLIANCE_TENANT.systemCode,
        }),
        JSON.stringify({
          seedSource: 'Companies.xlsx',
          seededBy: '005-tiramis-company-setup.seed',
        }),
      ],
    );

    return rows[0].id;
  }

  private async upsertPortalSideTiramisConfig(
    queryRunner: QueryRunner,
    companyId: string,
    environment: 'test' | 'live',
  ): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO tiramis_company_configurations (
          company_id,
          environment,
          company_code,
          company_name,
          insurer_company_code,
          insurer_company_name,
          client_code,
          client_key,
          system_code,
          system_name,
          base_url,
          callback_url,
          is_active,
          metadata,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          NULL,
          $8,
          $9,
          NULL,
          NULL,
          true,
          $10::jsonb,
          now(),
          now()
        )
        ON CONFLICT (company_id, environment)
        DO UPDATE SET
          company_code = EXCLUDED.company_code,
          company_name = EXCLUDED.company_name,
          insurer_company_code = EXCLUDED.insurer_company_code,
          insurer_company_name = EXCLUDED.insurer_company_name,
          client_code = EXCLUDED.client_code,
          system_code = EXCLUDED.system_code,
          system_name = EXCLUDED.system_name,
          is_active = true,
          metadata = COALESCE(
            tiramis_company_configurations.metadata,
            '{}'::jsonb
          ) || EXCLUDED.metadata,
          updated_at = now()
      `,
      [
        companyId,
        environment,
        ALLIANCE_TENANT.companyCode,
        ALLIANCE_TENANT.companyName,
        ALLIANCE_TENANT.insurerCompanyCode,
        ALLIANCE_TENANT.insurerCompanyName,
        ALLIANCE_TENANT.clientCode,
        ALLIANCE_TENANT.systemCode,
        ALLIANCE_TENANT.systemName,
        JSON.stringify({
          seededBy: '005-tiramis-company-setup.seed',
          secretsManagedBy: 'apps/tiramis',
        }),
      ],
    );
  }

  private async seedBranches(
    queryRunner: QueryRunner,
    companyId: string,
  ): Promise<void> {
    for (const branch of ALLIANCE_BRANCHES) {
      await queryRunner.query(
        `
          INSERT INTO branches (
            company_id,
            name,
            code,
            sale_point_code,
            sale_point_name,
            status,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, NULL, NULL, 'active', now(), now())
          ON CONFLICT ON CONSTRAINT "UQ_branches_company_code"
          DO UPDATE SET
            name = COALESCE(branches.name, EXCLUDED.name),
            status = 'active',
            updated_at = now()
        `,
        [companyId, branch.branchName, branch.branchCode],
      );
    }
  }

  private async seedSalePoints(
    queryRunner: QueryRunner,
    companyId: string,
  ): Promise<void> {
    for (const salePoint of ALLIANCE_SALE_POINTS) {
      const branchRows = await queryRunner.query(
        `
          SELECT id, code, name
          FROM branches
          WHERE company_id = $1
            AND code = $2
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [companyId, salePoint.branchCode],
      );

      const branch = branchRows[0];

      if (!branch) {
        throw new Error(
          `Branch ${salePoint.branchCode} must exist before sale point ${salePoint.salePointCode}`,
        );
      }

      await queryRunner.query(
        `
          INSERT INTO tiramis_sale_points (
            company_id,
            branch_id,
            branch_code,
            branch_name,
            sale_point_code,
            sale_point_name,
            is_default,
            is_active,
            metadata,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8::jsonb, now(), now())
          ON CONFLICT (company_id, sale_point_code)
          DO UPDATE SET
            branch_id = COALESCE(
              tiramis_sale_points.branch_id,
              EXCLUDED.branch_id
            ),
            branch_code = COALESCE(
              tiramis_sale_points.branch_code,
              EXCLUDED.branch_code
            ),
            branch_name = COALESCE(
              tiramis_sale_points.branch_name,
              EXCLUDED.branch_name
            ),
            sale_point_name = COALESCE(
              tiramis_sale_points.sale_point_name,
              EXCLUDED.sale_point_name
            ),
            is_default = EXCLUDED.is_default,
            is_active = true,
            metadata = COALESCE(tiramis_sale_points.metadata, '{}'::jsonb)
              || EXCLUDED.metadata,
            updated_at = now()
        `,
        [
          companyId,
          branch.id,
          branch.code,
          branch.name,
          salePoint.salePointCode,
          salePoint.salePointName,
          salePoint.isDefault,
          JSON.stringify({
            source: 'Companies.xlsx',
            seededBy: '005-tiramis-company-setup.seed',
          }),
        ],
      );
    }
  }
}
