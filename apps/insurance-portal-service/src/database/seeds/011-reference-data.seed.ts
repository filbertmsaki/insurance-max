import { existsSync } from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { requireColumns, withSeedTransaction } from './shared/seed-utils';

type CountrySeed = {
  name: string;
  iso3: string;
  iso2?: string | null;
  phoneCode?: string | null;
};

type CurrencySeed = {
  code: string;
  name: string;
  symbol?: string | null;
};

type RegionSeed = {
  code: string;
  name: string;
  districts: Array<{ code: string; name: string }>;
};

const FALLBACK_COUNTRIES: CountrySeed[] = [
  { name: 'Tanzania', iso3: 'TZA', iso2: 'TZ', phoneCode: '+255' },
];

const FALLBACK_CURRENCIES: CurrencySeed[] = [
  { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
];

export default class ReferenceDataSeeder implements Seeder {
  async run(
    dataSource: DataSource,
    _factoryManager: SeederFactoryManager,
  ): Promise<void> {
    await withSeedTransaction(
      dataSource,
      'seed:global-reference-data',
      async (qr) => {
        await requireColumns(qr, 'reference_countries', [
          'name',
          'iso3_code',
          'is_active',
        ]);
        await requireColumns(qr, 'reference_regions', [
          'country_id',
          'code',
          'name',
          'is_active',
        ]);
        await requireColumns(qr, 'reference_districts', [
          'region_id',
          'code',
          'name',
          'is_active',
        ]);
        await requireColumns(qr, 'reference_currencies', [
          'code',
          'name',
          'is_active',
        ]);

        const referenceDir = this.resolveReferenceDataDir();
        const countries = referenceDir
          ? await this.loadCountries(referenceDir)
          : FALLBACK_COUNTRIES;
        const currencies = referenceDir
          ? await this.loadCurrencies(referenceDir)
          : FALLBACK_CURRENCIES;
        const regions = referenceDir
          ? await this.loadRegions(referenceDir)
          : ([] as RegionSeed[]);

        for (const country of countries.length
          ? countries
          : FALLBACK_COUNTRIES) {
          await qr.query(
            `
            INSERT INTO reference_countries (
              name, iso2_code, iso3_code, phone_code, is_active, metadata, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, true, $5, now(), now())
            ON CONFLICT (iso3_code) WHERE deleted_at IS NULL
            DO UPDATE SET
              name = EXCLUDED.name,
              iso2_code = EXCLUDED.iso2_code,
              phone_code = EXCLUDED.phone_code,
              is_active = true,
              metadata = EXCLUDED.metadata,
              updated_at = now()
          `,
            [
              country.name,
              country.iso2 ?? null,
              country.iso3.toUpperCase(),
              country.phoneCode ?? null,
              JSON.stringify({ source: 'system-seed' }),
            ],
          );
        }

        const tanzania = await qr.query(
          `SELECT id FROM reference_countries WHERE iso3_code = 'TZA' AND deleted_at IS NULL LIMIT 1`,
        );
        const countryId = tanzania[0]?.id;

        if (countryId) {
          for (const region of regions) {
            const regionRows = await qr.query(
              `
              INSERT INTO reference_regions (
                country_id, code, name, is_active, metadata, created_at, updated_at
              )
              VALUES ($1, $2, $3, true, $4, now(), now())
              ON CONFLICT (country_id, code) WHERE deleted_at IS NULL
              DO UPDATE SET
                name = EXCLUDED.name,
                is_active = true,
                metadata = EXCLUDED.metadata,
                updated_at = now()
              RETURNING id
            `,
              [
                countryId,
                region.code,
                region.name,
                JSON.stringify({ source: 'system-seed' }),
              ],
            );

            const regionId = regionRows[0]?.id;
            if (!regionId) continue;

            for (const district of region.districts) {
              await qr.query(
                `
                INSERT INTO reference_districts (
                  region_id, code, name, is_active, metadata, created_at, updated_at
                )
                VALUES ($1, $2, $3, true, $4, now(), now())
                ON CONFLICT (region_id, code) WHERE deleted_at IS NULL
                DO UPDATE SET
                  name = EXCLUDED.name,
                  is_active = true,
                  metadata = EXCLUDED.metadata,
                  updated_at = now()
              `,
                [
                  regionId,
                  district.code,
                  district.name,
                  JSON.stringify({ source: 'system-seed' }),
                ],
              );
            }
          }
        }

        for (const currency of currencies.length
          ? currencies
          : FALLBACK_CURRENCIES) {
          await qr.query(
            `
            INSERT INTO reference_currencies (
              code, name, symbol, is_active, metadata, created_at, updated_at
            )
            VALUES ($1, $2, $3, true, $4, now(), now())
            ON CONFLICT (code) WHERE deleted_at IS NULL
            DO UPDATE SET
              name = EXCLUDED.name,
              symbol = EXCLUDED.symbol,
              is_active = true,
              metadata = EXCLUDED.metadata,
              updated_at = now()
          `,
            [
              currency.code.toUpperCase(),
              currency.name,
              currency.symbol ?? null,
              JSON.stringify({ source: 'system-seed' }),
            ],
          );
        }
      },
    );
  }

  private resolveReferenceDataDir(): string | null {
    const candidates = [
      process.env.TIRAMIS_REFERENCE_DATA_DIR,
      path.resolve(__dirname, 'tiramis-reference'),
      path.resolve(process.cwd(), 'data', 'tiramis-reference'),
      path.resolve(process.cwd(), 'docs', 'tiramis-reference'),
    ].filter(Boolean) as string[];

    return candidates.find((candidate) => existsSync(candidate)) || null;
  }

  private async loadCountries(referenceDir: string): Promise<CountrySeed[]> {
    const workbook = await this.tryLoadWorkbook(referenceDir, 'Countries.xlsx');
    if (!workbook) return FALLBACK_COUNTRIES;

    const rows: CountrySeed[] = [];
    workbook.worksheets[0].eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const name = this.cellText(row, 1);
      const iso3 = this.cellText(row, 2).toUpperCase();
      if (name && iso3) rows.push({ name, iso3 });
    });
    return rows;
  }

  private async loadCurrencies(referenceDir: string): Promise<CurrencySeed[]> {
    const workbook = await this.tryLoadWorkbook(
      referenceDir,
      'CURRENCIES.xlsx',
    );
    if (!workbook) return FALLBACK_CURRENCIES;

    const rows: CurrencySeed[] = [];
    workbook.worksheets[0].eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const code = this.cellText(row, 1).toUpperCase();
      const name = this.cellText(row, 2);
      if (code && name) rows.push({ code, name });
    });
    return rows;
  }

  private async loadRegions(referenceDir: string): Promise<RegionSeed[]> {
    const workbook = await this.tryLoadWorkbook(
      referenceDir,
      'Regions and Respective Districts -test.xlsx',
    );
    if (!workbook) return [];

    const byRegion = new Map<string, RegionSeed>();
    let currentRegionName = '';

    workbook.worksheets[0].eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      currentRegionName = this.cellText(row, 2) || currentRegionName;
      const districtName = this.cellText(row, 4);

      if (!currentRegionName) return;

      const regionCode = currentRegionName;
      const region =
        byRegion.get(regionCode) ??
        ({
          code: regionCode,
          name: currentRegionName,
          districts: [],
        } satisfies RegionSeed);

      if (districtName) {
        region.districts.push({
          code: districtName,
          name: districtName,
        });
      }

      byRegion.set(regionCode, region);
    });

    return [...byRegion.values()];
  }

  private async tryLoadWorkbook(referenceDir: string, fileName: string) {
    const filePath = path.join(referenceDir, fileName);
    if (!existsSync(filePath)) return null;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    return workbook;
  }

  private cellText(row: ExcelJS.Row, column: number): string {
    const value = row.getCell(column).value;
    if (value === null || value === undefined) return '';
    if (typeof value === 'object' && 'text' in value) {
      return String(value.text).trim();
    }
    return String(value).trim();
  }
}
