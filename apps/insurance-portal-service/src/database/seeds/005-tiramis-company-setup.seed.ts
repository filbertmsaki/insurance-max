import { environment } from '@insurance-max/shared-config';
import { DataSource, QueryRunner } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import { PartnerType } from '../../modules/tenant/insurance-partners/enums/partner-type.enum';
import { PartnerRelationshipStatus } from '../../modules/tenant/insurance-partners/enums/partner-relationship-status.enum';
import {
  ALLIANCE_BRANCHES,
  ALLIANCE_SALE_POINTS,
  ALLIANCE_TENANT,
} from './data/alliance.seed-data';
import {
  requireColumns,
  slugify,
  withSeedTransaction,
} from './shared/seed-utils';

type RowWithId = {
  id: string;
};

const ALLIANCE_INTERMEDIARY_SEEDS = [
  {
    companyCode: 'IA1292',
    companyName: 'HERI INSURANCE AGENCY',
    companyType: CompanyType.AGENCY,
    partnerType: PartnerType.AGENCY,
    sourceSheet: 'AGENTS',
    sourceRow: 347,
  },
  {
    companyCode: 'IA1313',
    companyName: 'JAMII INSURANCE AGENCY',
    companyType: CompanyType.AGENCY,
    partnerType: PartnerType.AGENCY,
    sourceSheet: 'AGENTS',
    sourceRow: 373,
  },
  {
    companyCode: 'IB1005',
    companyName: 'KIVULI INSURANCE BROKERS',
    companyType: CompanyType.BROKER,
    partnerType: PartnerType.BROKER,
    sourceSheet: 'BROKERS',
    sourceRow: 12,
  },
  {
    companyCode: 'IB1007',
    companyName: 'NDEGE INSURANCE BROKERS LIMITED',
    companyType: CompanyType.BROKER,
    partnerType: PartnerType.BROKER,
    sourceSheet: 'BROKERS',
    sourceRow: 15,
  },
] as const;

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
          'is_head_office',
          'status',
        ]);

        await requireColumns(queryRunner, 'tiramis_company_configurations', [
          'company_id',
          'environment',
          'company_code',
          'client_code',
          'system_code',
          'is_active',
          'validation_status',
          'validated_at',
          'validation_message',
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

        await requireColumns(queryRunner, 'insurance_company_partners', [
          'insurer_company_id',
          'intermediary_company_id',
          'partner_type',
          'status',
          'metadata',
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
        await this.seedAllianceIntermediaries(queryRunner, companyId);
      },
    );

    console.log(
      `[TiramisCompanySetupSeeder] Alliance references seeded for ${ALLIANCE_TENANT.companyCode}`,
    );
  }

  private async correctExistingAllianceReferences(queryRunner: QueryRunner) {
    const wrongRows = await queryRunner.query(
      `
        SELECT
          id,
          name,
          slug,
          tira_company_code,
          tira_insurer_company_code,
          tira_client_code,
          tira_system_code,
          tira_system_name
        FROM companies
        WHERE deleted_at IS NULL
          AND (
            slug IN (
              'alliance-insurance-corporation',
              'alliance-insurance-company-limited'
            )
            OR name ILIKE '%ALLIANCE INSURANCE%'
          )
          AND (
            COALESCE(tira_company_code, '') <> $1
            OR COALESCE(tira_insurer_company_code, '') <> $2
            OR COALESCE(tira_client_code, '') <> $3
            OR COALESCE(tira_system_code, '') <> $4
            OR COALESCE(tira_system_name, '') <> $5
          )
      `,
      [
        ALLIANCE_TENANT.companyCode,
        ALLIANCE_TENANT.insurerCompanyCode,
        ALLIANCE_TENANT.clientCode,
        ALLIANCE_TENANT.systemCode,
        ALLIANCE_TENANT.systemName,
      ],
    );

    const companyCodeMismatchRows = wrongRows.filter(
      (row: { tira_company_code: string | null }) =>
        row.tira_company_code !== null &&
        row.tira_company_code !== ALLIANCE_TENANT.companyCode,
    );

    if (
      companyCodeMismatchRows.length > 0 &&
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
          tira_company_code = EXCLUDED.tira_company_code,
          tira_insurer_company_code = EXCLUDED.tira_insurer_company_code,
          tira_client_code = EXCLUDED.tira_client_code,
          tira_system_code = EXCLUDED.tira_system_code,
          tira_system_name = EXCLUDED.tira_system_name,
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
          validation_status,
          validated_at,
          validation_message,
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
          $10::varchar,
          CASE WHEN $10::varchar = 'VALID' THEN now() ELSE NULL END,
          $11,
          $12::jsonb,
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
          validation_status = EXCLUDED.validation_status,
          validated_at = EXCLUDED.validated_at,
          validation_message = EXCLUDED.validation_message,
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
        environment === 'test' ? 'VALID' : 'NOT_VALIDATED',
        environment === 'test'
          ? 'Seeded local/test configuration is ready for TIRAMIS sandbox submission.'
          : 'Live configuration requires validation with production credentials before submission.',
        JSON.stringify({
          seededBy: '005-tiramis-company-setup.seed',
          secretsManagedBy: 'apps/tiramis',
          readinessPolicy:
            environment === 'test'
              ? 'local-test-seed-validated'
              : 'live-requires-explicit-validation',
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
            is_head_office,
            status,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, NULL, NULL, $4, 'active', now(), now())
          ON CONFLICT ON CONSTRAINT "UQ_branches_company_code"
          DO UPDATE SET
            name = COALESCE(branches.name, EXCLUDED.name),
            is_head_office = EXCLUDED.is_head_office,
            status = 'active',
            updated_at = now()
        `,
        [companyId, branch.branchName, branch.branchCode, branch.isHeadOffice],
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

  private async seedAllianceIntermediaries(
    queryRunner: QueryRunner,
    allianceCompanyId: string,
  ): Promise<void> {
    for (const seed of ALLIANCE_INTERMEDIARY_SEEDS) {
      const intermediaryCompanyId = await this.upsertIntermediaryCompany(
        queryRunner,
        seed,
      );

      const existingRows = await queryRunner.query(
        `
          SELECT id
          FROM insurance_company_partners
          WHERE insurer_company_id = $1
            AND intermediary_company_id = $2
            AND partner_type = $3
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [allianceCompanyId, intermediaryCompanyId, seed.partnerType],
      );

      const metadata = JSON.stringify({
        seedSource: 'Companies (1).xlsx',
        sourceSheet: seed.sourceSheet,
        sourceRow: seed.sourceRow,
        seededBy: '005-tiramis-company-setup.seed',
      });

      if (existingRows[0]) {
        await queryRunner.query(
          `
            UPDATE insurance_company_partners
            SET
              status = $2,
              metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
              updated_at = now()
            WHERE id = $1
          `,
          [existingRows[0].id, PartnerRelationshipStatus.ACTIVE, metadata],
        );
        continue;
      }

      await queryRunner.query(
        `
          INSERT INTO insurance_company_partners (
            insurer_company_id,
            intermediary_company_id,
            partner_type,
            status,
            metadata,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5::jsonb, now(), now())
        `,
        [
          allianceCompanyId,
          intermediaryCompanyId,
          seed.partnerType,
          PartnerRelationshipStatus.ACTIVE,
          metadata,
        ],
      );
    }
  }

  private async upsertIntermediaryCompany(
    queryRunner: QueryRunner,
    seed: (typeof ALLIANCE_INTERMEDIARY_SEEDS)[number],
  ): Promise<string> {
    const companySlug = slugify(seed.companyName);
    const existingRows = await queryRunner.query(
      `
        SELECT id
        FROM companies
        WHERE deleted_at IS NULL
          AND (slug = $1 OR name = $2)
        ORDER BY CASE WHEN slug = $1 THEN 0 ELSE 1 END
        LIMIT 1
      `,
      [companySlug, seed.companyName],
    );
    const metadata = JSON.stringify({
      seedSource: 'Companies (1).xlsx',
      sourceSheet: seed.sourceSheet,
      sourceRow: seed.sourceRow,
      seededBy: '005-tiramis-company-setup.seed',
    });
    const regulatoryMetadata = JSON.stringify({
      tiraCompanyCode: seed.companyCode,
      clientCode: seed.companyCode,
    });

    if (existingRows[0]) {
      await queryRunner.query(
        `
          UPDATE companies
          SET
            status = 'active',
            company_type = $2,
            identifier_prefix = COALESCE(identifier_prefix, $3),
            tira_company_code = COALESCE(tira_company_code, $3),
            tira_client_code = COALESCE(tira_client_code, $3),
            regulatory_metadata = COALESCE(
              regulatory_metadata,
              '{}'::jsonb
            ) || $4::jsonb,
            metadata = COALESCE(metadata, '{}'::jsonb) || $5::jsonb,
            updated_at = now()
          WHERE id = $1
        `,
        [
          existingRows[0].id,
          seed.companyType,
          seed.companyCode,
          regulatoryMetadata,
          metadata,
        ],
      );
      return existingRows[0].id;
    }

    const insertedRows = await queryRunner.query(
      `
        INSERT INTO companies (
          name,
          slug,
          identifier_prefix,
          status,
          company_type,
          tira_company_code,
          tira_client_code,
          operating_timezone,
          default_currency,
          regulatory_metadata,
          metadata,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, 'active', $4, $3, $3,
          'Africa/Dar_es_Salaam', 'TZS', $5::jsonb, $6::jsonb, now(), now()
        )
        RETURNING id
      `,
      [
        seed.companyName,
        companySlug,
        seed.companyCode,
        seed.companyType,
        regulatoryMetadata,
        metadata,
      ],
    );

    return insertedRows[0].id;
  }
}
