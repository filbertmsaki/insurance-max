import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';

type CompanySeed = {
  companyCode: string;
  companyName: string;
  companyType:
    | 'INSURANCE_COMPANY'
    | 'REINSURANCE_COMPANY'
    | 'BROKER'
    | 'AGENCY'
    | 'BANCASSURANCE'
    | 'SERVICE_PROVIDER';
  insurerCompanyCode?: string | null;
  insurerCompanyName?: string | null;
  clientCode?: string | null;
  clientKey?: string | null;
  systemCode?: string | null;
  systemName?: string | null;
  metadata?: Record<string, unknown>;
};

type SalePointSeed = {
  companyCode: string;
  branchCode?: string | null;
  branchName?: string | null;
  salePointCode: string;
  salePointName?: string | null;
};

type PartnerSeed = {
  insurerCompanyCode: string;
  intermediaryCompanyCode: string;
  partnerType: 'REINSURANCE_COMPANY' | 'BROKER' | 'AGENCY' | 'BANCASSURANCE';
};

const companySeeds: CompanySeed[] = [
  {
    companyCode: 'ICC999',
    companyName: 'ALLIANCE INSURANCE CORPORATION',
    companyType: 'INSURANCE_COMPANY',
    insurerCompanyCode: 'ICC999',
    insurerCompanyName: 'ALLIANCE INSURANCE CORPORATION',
    clientCode: 'ICC999',
    clientKey: 'RydLDE8CFJ',
    systemCode: 'LSYS_ALLIANCE_999',
    systemName: 'ALLIANCE INSURANCE SYSTEM',
    metadata: {
      source: 'Companies.xlsx',
      sheet: 'INSURER',
    },
  },
  {
    companyCode: 'IA1888',
    companyName: 'JAMII INSURANCE AGENCY',
    companyType: 'AGENCY',
    clientCode: 'IA1666',
    metadata: {
      source: 'Companies.xlsx',
      sheet: 'AGENTS',
      allowedInsurers: [
        'THE JUBILEE INSURANCE COMPANY OF TANZANIA LIMITED',
        'ALLIANCE INSURANCE CORPORATION LIMITED',
        'BRITAM INSURANCE COMPANY TANZANIA LIMITED',
      ],
    },
  },
  {
    companyCode: 'BA1001',
    companyName: 'AZANIA BANK',
    companyType: 'BANCASSURANCE',
    insurerCompanyCode: 'ICC999',
    metadata: {
      source: 'Companies.xlsx',
      sheet: 'BANCASSUARANCE',
      allowedInsurerCodes: ['ICC999', 'ICC998'],
    },
  },
  {
    companyCode: 'RC1001',
    companyName: 'Factory Mutual Insurance Company',
    companyType: 'REINSURANCE_COMPANY',
    metadata: {
      source: 'Companies.xlsx',
      sheet: 'REINSURANCE COMPANIES',
    },
  },
  {
    companyCode: 'IB1001',
    companyName: 'CORPORATE INSURANCE BROKERS LIMITED',
    companyType: 'BROKER',
    metadata: {
      source: 'Companies.xlsx',
      sheet: 'BROKERS',
      allowedInsurerCodes: ['ICC102', 'ICC112', 'ICC103'],
    },
  },
  {
    companyCode: 'RB1001',
    companyName: 'Reinsurance Solution International Limited',
    companyType: 'BROKER',
    metadata: {
      source: 'Companies.xlsx',
      sheet: 'REINSURANCE BROKERS',
      companyRole: 'REINSURANCE_BROKER',
    },
  },
];

const insurerPlaceholderSeeds: CompanySeed[] = [
  {
    companyCode: 'ICC998',
    companyName: 'INSURER ICC998',
    companyType: 'INSURANCE_COMPANY',
    metadata: {
      source: 'Companies.xlsx',
      placeholder: true,
      reason: 'Referenced by AZANIA BANK',
    },
  },
  {
    companyCode: 'ICC102',
    companyName: 'INSURER ICC102',
    companyType: 'INSURANCE_COMPANY',
    metadata: {
      source: 'Companies.xlsx',
      placeholder: true,
      reason: 'Referenced by broker sheet',
    },
  },
  {
    companyCode: 'ICC112',
    companyName: 'INSURER ICC112',
    companyType: 'INSURANCE_COMPANY',
    metadata: {
      source: 'Companies.xlsx',
      placeholder: true,
      reason: 'Referenced by broker sheet',
    },
  },
  {
    companyCode: 'ICC103',
    companyName: 'INSURER ICC103',
    companyType: 'INSURANCE_COMPANY',
    metadata: {
      source: 'Companies.xlsx',
      placeholder: true,
      reason: 'Referenced by broker sheet',
    },
  },
];

const salePointSeeds: SalePointSeed[] = [
  {
    companyCode: 'ICC999',
    branchCode: 'BR207',
    branchName: 'HQ',
    salePointCode: 'SP500',
    salePointName: 'HQ',
  },
  {
    companyCode: 'ICC999',
    branchCode: null,
    branchName: null,
    salePointCode: 'SP501',
    salePointName: 'DSM',
  },
  {
    companyCode: 'ICC999',
    branchCode: 'BR208',
    branchName: 'ARUSHA',
    salePointCode: 'SP502',
    salePointName: 'ARUSHA',
  },
  {
    companyCode: 'ICC999',
    branchCode: 'BR209',
    branchName: 'MWANZA',
    salePointCode: 'SP503',
    salePointName: 'MWANZA',
  },
  {
    companyCode: 'ICC999',
    branchCode: 'BR210',
    branchName: 'MOSHI',
    salePointCode: 'SP504',
    salePointName: 'MOSHI',
  },
];

const partnerSeeds: PartnerSeed[] = [
  {
    insurerCompanyCode: 'ICC999',
    intermediaryCompanyCode: 'BA1001',
    partnerType: 'BANCASSURANCE',
  },
  {
    insurerCompanyCode: 'ICC998',
    intermediaryCompanyCode: 'BA1001',
    partnerType: 'BANCASSURANCE',
  },
  {
    insurerCompanyCode: 'ICC102',
    intermediaryCompanyCode: 'IB1001',
    partnerType: 'BROKER',
  },
  {
    insurerCompanyCode: 'ICC112',
    intermediaryCompanyCode: 'IB1001',
    partnerType: 'BROKER',
  },
  {
    insurerCompanyCode: 'ICC103',
    intermediaryCompanyCode: 'IB1001',
    partnerType: 'BROKER',
  },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function findCompanyIdByTiraCode(
  dataSource: DataSource,
  companyCode: string,
): Promise<string | null> {
  const rows = await dataSource.query(
    `
      SELECT id
      FROM companies
      WHERE tira_company_code = $1
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [companyCode],
  );

  return rows[0]?.id ?? null;
}

async function upsertCompany(
  dataSource: DataSource,
  seed: CompanySeed,
): Promise<string> {
  const slug = slugify(seed.companyName || seed.companyCode);

  const rows = await dataSource.query(
    `
      INSERT INTO companies (
        name,
        slug,
        status,
        company_type,
        tira_company_code,
        tira_insurer_company_code,
        tira_client_code,
        tira_system_code,
        tira_system_name,
        regulatory_metadata,
        metadata,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        'active',
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9::jsonb,
        $10::jsonb,
        now(),
        now()
      )
      ON CONFLICT (slug)
      DO UPDATE SET
        name = EXCLUDED.name,
        status = 'active',
        company_type = EXCLUDED.company_type,
        tira_company_code = EXCLUDED.tira_company_code,
        tira_insurer_company_code = EXCLUDED.tira_insurer_company_code,
        tira_client_code = EXCLUDED.tira_client_code,
        tira_system_code = EXCLUDED.tira_system_code,
        tira_system_name = EXCLUDED.tira_system_name,
        regulatory_metadata =
          COALESCE(companies.regulatory_metadata, '{}'::jsonb)
          || EXCLUDED.regulatory_metadata,
        metadata =
          COALESCE(companies.metadata, '{}'::jsonb)
          || EXCLUDED.metadata,
        updated_at = now()
      RETURNING id
    `,
    [
      seed.companyName,
      slug,
      seed.companyType,
      seed.companyCode,
      seed.insurerCompanyCode ?? null,
      seed.clientCode ?? null,
      seed.systemCode ?? null,
      seed.systemName ?? null,
      JSON.stringify({
        tiraCompanyCode: seed.companyCode,
        insurerCompanyCode: seed.insurerCompanyCode ?? null,
        insurerCompanyName: seed.insurerCompanyName ?? null,
      }),
      JSON.stringify(seed.metadata ?? {}),
    ],
  );

  return rows[0].id;
}

async function upsertTiramisConfig(
  dataSource: DataSource,
  companyId: string,
  seed: CompanySeed,
): Promise<void> {
  await dataSource.query(
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
        'test',
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
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
        client_key = EXCLUDED.client_key,
        system_code = EXCLUDED.system_code,
        system_name = EXCLUDED.system_name,
        is_active = true,
        metadata =
          COALESCE(tiramis_company_configurations.metadata, '{}'::jsonb)
          || EXCLUDED.metadata,
        updated_at = now()
    `,
    [
      companyId,
      seed.companyCode,
      seed.companyName,
      seed.insurerCompanyCode ?? null,
      seed.insurerCompanyName ?? null,
      seed.clientCode ?? null,
      seed.clientKey ?? null,
      seed.systemCode ?? null,
      seed.systemName ?? null,
      JSON.stringify({
        source: 'Companies.xlsx',
        companyType: seed.companyType,
      }),
    ],
  );
}

async function upsertBranchAndSalePoint(
  dataSource: DataSource,
  seed: SalePointSeed,
): Promise<void> {
  const companyId = await findCompanyIdByTiraCode(dataSource, seed.companyCode);

  if (!companyId) {
    console.warn(
      `[tiramis-seed] Company not found for sale point ${seed.salePointCode}`,
    );
    return;
  }

  let branchId: string | null = null;

  if (seed.branchCode) {
    const branchRows = await dataSource.query(
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
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          'active',
          now(),
          now()
        )
        ON CONFLICT ON CONSTRAINT "UQ_branches_company_code"
        DO UPDATE SET
          name = EXCLUDED.name,
          sale_point_code = EXCLUDED.sale_point_code,
          sale_point_name = EXCLUDED.sale_point_name,
          status = 'active',
          updated_at = now()
        RETURNING id
      `,
      [
        companyId,
        seed.branchName ?? seed.branchCode,
        seed.branchCode,
        seed.salePointCode,
        seed.salePointName ?? seed.salePointCode,
      ],
    );

    branchId = branchRows[0]?.id ?? null;
  }

  await dataSource.query(
    `
      INSERT INTO tiramis_sale_points (
        company_id,
        branch_id,
        branch_code,
        branch_name,
        sale_point_code,
        sale_point_name,
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
        true,
        $7::jsonb,
        now(),
        now()
      )
      ON CONFLICT (company_id, sale_point_code)
      DO UPDATE SET
        branch_id = EXCLUDED.branch_id,
        branch_code = EXCLUDED.branch_code,
        branch_name = EXCLUDED.branch_name,
        sale_point_name = EXCLUDED.sale_point_name,
        is_active = true,
        metadata =
          COALESCE(tiramis_sale_points.metadata, '{}'::jsonb)
          || EXCLUDED.metadata,
        updated_at = now()
    `,
    [
      companyId,
      branchId,
      seed.branchCode ?? null,
      seed.branchName ?? null,
      seed.salePointCode,
      seed.salePointName ?? seed.salePointCode,
      JSON.stringify({
        source: 'Companies.xlsx',
      }),
    ],
  );
}

async function upsertPartner(
  dataSource: DataSource,
  seed: PartnerSeed,
): Promise<void> {
  const insurerCompanyId = await findCompanyIdByTiraCode(
    dataSource,
    seed.insurerCompanyCode,
  );

  const intermediaryCompanyId = await findCompanyIdByTiraCode(
    dataSource,
    seed.intermediaryCompanyCode,
  );

  if (!insurerCompanyId || !intermediaryCompanyId) {
    console.warn('[tiramis-seed] Partner skipped because company is missing', {
      seed,
      insurerCompanyId,
      intermediaryCompanyId,
    });
    return;
  }

  await dataSource.query(
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
      SELECT
        $1,
        $2,
        $3,
        'ACTIVE',
        $4::jsonb,
        now(),
        now()
      WHERE NOT EXISTS (
        SELECT 1
        FROM insurance_company_partners
        WHERE insurer_company_id = $1
          AND intermediary_company_id = $2
          AND partner_type = $3
          AND deleted_at IS NULL
      )
    `,
    [
      insurerCompanyId,
      intermediaryCompanyId,
      seed.partnerType,
      JSON.stringify({
        source: 'Companies.xlsx',
      }),
    ],
  );
}

export default class TiramisCompanySetupSeeder implements Seeder {
  public async run(
    dataSource: DataSource,
    _factoryManager: SeederFactoryManager,
  ): Promise<void> {
    console.log('Seeding TIRAMIS company setup from Companies.xlsx data...');

    for (const seed of [...companySeeds, ...insurerPlaceholderSeeds]) {
      const companyId = await upsertCompany(dataSource, seed);
      await upsertTiramisConfig(dataSource, companyId, seed);
    }

    for (const seed of salePointSeeds) {
      await upsertBranchAndSalePoint(dataSource, seed);
    }

    for (const seed of partnerSeeds) {
      await upsertPartner(dataSource, seed);
    }

    console.log('TIRAMIS company setup seed completed');
  }
}
