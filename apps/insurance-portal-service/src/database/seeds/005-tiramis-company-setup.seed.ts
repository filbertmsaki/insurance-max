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

function activeTiraEnvironment(): 'uat' | 'production' {
  const value = environment.TIRA_ENV?.trim().toLowerCase();
  if (value === 'production' || value === 'live') return 'production';
  return 'uat';
}

const ALLIANCE_INTERMEDIARY_SEEDS = [
  {
    companyCode: 'IA9001',
    companyName: 'INSURANCE MAX DEMO AGENCY',
    companyType: CompanyType.AGENCY,
    partnerType: PartnerType.AGENCY,
    sourceSheet: 'DEMO',
    sourceRow: 1,
  },
  {
    companyCode: 'IB9001',
    companyName: 'INSURANCE MAX DEMO BROKER',
    companyType: CompanyType.BROKER,
    partnerType: PartnerType.BROKER,
    sourceSheet: 'DEMO',
    sourceRow: 2,
  },
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

        const tiraEnvironment = activeTiraEnvironment();
        await this.upsertPortalSideTiramisConfig(
          queryRunner,
          companyId,
          tiraEnvironment,
        );
        await this.upsertPlatformTiramisAccess(
          queryRunner,
          companyId,
          tiraEnvironment,
        );
        await this.seedBranches(queryRunner, companyId);
        await this.seedSalePoints(queryRunner, companyId);
        await this.seedAllianceIntermediaries(queryRunner, companyId);
        await this.linkExistingIntermediariesToAlliance(queryRunner, companyId);
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
          tira_insurer_company_code
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
          )
      `,
      [ALLIANCE_TENANT.companyCode, ALLIANCE_TENANT.insurerCompanyCode],
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
          updated_at = now()
        WHERE id = ANY($4::uuid[])
      `,
      [
        ALLIANCE_TENANT.identifierPrefix,
        ALLIANCE_TENANT.companyCode,
        ALLIANCE_TENANT.insurerCompanyCode,
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
          $7::jsonb,
          $8::jsonb,
          $9::jsonb,
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
        JSON.stringify({
          currency: ALLIANCE_TENANT.currency,
          timezone: ALLIANCE_TENANT.timezone,
        }),
        JSON.stringify({
          tiraCompanyCode: ALLIANCE_TENANT.companyCode,
          insurerCompanyCode: ALLIANCE_TENANT.insurerCompanyCode,
        }),
        JSON.stringify({
          seedSource: 'Companies.xlsx',
          seededBy: '005-tiramis-company-setup.seed',
        }),
      ],
    );

    return rows[0].id;
  }

  /**
   * Platform-level integration: TIRA_ENV is the active environment; Alliance is
   * linked with active access.
   */
  private async upsertPlatformTiramisAccess(
    queryRunner: QueryRunner,
    companyId: string,
    tiraEnvironment: 'uat' | 'production',
  ): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO tiramis_platform_settings (
          id, active_environment, validation_status, validated_at
        )
        VALUES ('platform', $1, 'NOT_VALIDATED', NULL)
        ON CONFLICT (id) DO UPDATE SET
          active_environment = EXCLUDED.active_environment,
          validation_status = EXCLUDED.validation_status,
          validated_at = COALESCE(
            tiramis_platform_settings.validated_at,
            EXCLUDED.validated_at
          ),
          updated_at = now()
      `,
      [tiraEnvironment],
    );
    await queryRunner.query(
      `
        INSERT INTO tiramis_company_links (
          company_id, company_name, insurer_company_code,
          insurer_company_name, status, linked_at, activated_at
        )
        VALUES ($1, $2, $3, $4, 'ACTIVE', now(), now())
        ON CONFLICT (company_id) DO UPDATE SET
          company_name = EXCLUDED.company_name,
          insurer_company_code = EXCLUDED.insurer_company_code,
          insurer_company_name = EXCLUDED.insurer_company_name,
          updated_at = now()
      `,
      [
        companyId,
        ALLIANCE_TENANT.companyName,
        ALLIANCE_TENANT.insurerCompanyCode,
        ALLIANCE_TENANT.insurerCompanyName,
      ],
    );
  }

  private async upsertPortalSideTiramisConfig(
    queryRunner: QueryRunner,
    companyId: string,
    environment: 'uat' | 'production',
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
          true,
          $7::varchar,
          CASE WHEN $7::varchar = 'VALID' THEN now() ELSE NULL END,
          $8,
          $9::jsonb,
          now(),
          now()
        )
        ON CONFLICT (company_id)
        DO UPDATE SET
          environment = EXCLUDED.environment,
          company_code = EXCLUDED.company_code,
          company_name = EXCLUDED.company_name,
          insurer_company_code = EXCLUDED.insurer_company_code,
          insurer_company_name = EXCLUDED.insurer_company_name,
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
        'NOT_VALIDATED',
        'Configuration requires validation with this server TIRA_ENV before submission.',
        JSON.stringify({
          seededBy: '005-tiramis-company-setup.seed',
          secretsManagedBy: 'apps/tiramis',
          readinessPolicy: 'requires-explicit-validation',
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

      await this.ensureAlliancePartnerRelationship(queryRunner, {
        allianceCompanyId,
        intermediaryCompanyId,
        partnerType: seed.partnerType,
        sourceName: seed.companyName,
        metadata: {
          seedSource: 'Companies (1).xlsx',
          sourceSheet: seed.sourceSheet,
          sourceRow: seed.sourceRow,
        },
      });
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
          operating_timezone,
          default_currency,
          regulatory_metadata,
          metadata,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, 'active', $4, $3,
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

  private async linkExistingIntermediariesToAlliance(
    queryRunner: QueryRunner,
    allianceCompanyId: string,
  ): Promise<void> {
    const intermediaryRows = await queryRunner.query(
      `
        SELECT id, name, company_type
        FROM companies
        WHERE deleted_at IS NULL
          AND id <> $1
          AND company_type::text IN ($2, $3)
        ORDER BY name
      `,
      [allianceCompanyId, CompanyType.BROKER, CompanyType.AGENCY],
    );

    for (const row of intermediaryRows as Array<{
      id: string;
      name: string;
      company_type: CompanyType;
    }>) {
      await this.ensureAlliancePartnerRelationship(queryRunner, {
        allianceCompanyId,
        intermediaryCompanyId: row.id,
        partnerType:
          row.company_type === CompanyType.AGENCY
            ? PartnerType.AGENCY
            : PartnerType.BROKER,
        sourceName: row.name,
      });
    }
  }

  private async ensureAlliancePartnerRelationship(
    queryRunner: QueryRunner,
    params: {
      allianceCompanyId: string;
      intermediaryCompanyId: string;
      partnerType: PartnerType.BROKER | PartnerType.AGENCY;
      sourceName: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    const metadata = JSON.stringify({
      seededBy: '005-tiramis-company-setup.seed',
      linkPolicy: 'all-active-brokers-and-agencies-to-alliance',
      sourceCompanyName: params.sourceName,
      ...(params.metadata ?? {}),
    });

    const existingRows =
      params.partnerType === PartnerType.AGENCY
        ? await queryRunner.query(
            `
              SELECT id
              FROM insurance_company_partners
              WHERE intermediary_company_id = $1
                AND partner_type = $2
                AND deleted_at IS NULL
                AND status IN ($3, $4, $5)
              ORDER BY
                CASE WHEN insurer_company_id = $6 THEN 0 ELSE 1 END,
                created_at DESC
              LIMIT 1
            `,
            [
              params.intermediaryCompanyId,
              params.partnerType,
              PartnerRelationshipStatus.PENDING,
              PartnerRelationshipStatus.ACTIVE,
              PartnerRelationshipStatus.SUSPENDED,
              params.allianceCompanyId,
            ],
          )
        : await queryRunner.query(
            `
              SELECT id
              FROM insurance_company_partners
              WHERE insurer_company_id = $1
                AND intermediary_company_id = $2
                AND partner_type = $3
                AND deleted_at IS NULL
              ORDER BY created_at DESC
              LIMIT 1
            `,
            [
              params.allianceCompanyId,
              params.intermediaryCompanyId,
              params.partnerType,
            ],
          );

    if (existingRows[0]) {
      await queryRunner.query(
        `
          UPDATE insurance_company_partners
          SET
            insurer_company_id = $2,
            status = $3,
            metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
            updated_at = now()
          WHERE id = $1
        `,
        [
          existingRows[0].id,
          params.allianceCompanyId,
          PartnerRelationshipStatus.ACTIVE,
          metadata,
        ],
      );
      return;
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
        params.allianceCompanyId,
        params.intermediaryCompanyId,
        params.partnerType,
        PartnerRelationshipStatus.ACTIVE,
        metadata,
      ],
    );
  }
}
