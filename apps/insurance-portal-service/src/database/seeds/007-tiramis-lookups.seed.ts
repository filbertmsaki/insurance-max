import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { existsSync } from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { TIRAMIS_LOOKUPS } from './data/tiramis-lookups.seed-data';
import { requireColumns, withSeedTransaction } from './shared/seed-utils';

type TiramisLookupSeed = {
  group: string;
  code: string;
  label: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
};

export default class TiramisLookupsSeeder implements Seeder {
  async run(
    dataSource: DataSource,
    _factoryManager: SeederFactoryManager,
  ): Promise<void> {
    await withSeedTransaction(
      dataSource,
      'seed:tiramis-lookups',
      async (qr) => {
        await requireColumns(qr, 'tiramis_lookups', [
          'group_code',
          'code',
          'label',
          'is_active',
        ]);

        const lookups = await this.loadLookups();

        for (const lookup of lookups) {
          await qr.query(
            `
            INSERT INTO tiramis_lookups (
              group_code,
              code,
              label,
              description,
              metadata,
              is_active,
              created_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, true, now(), now())
            ON CONFLICT (group_code, code)
            DO UPDATE SET
              label = EXCLUDED.label,
              description = EXCLUDED.description,
              metadata = EXCLUDED.metadata,
              is_active = true,
              updated_at = now()
          `,
            [
              lookup.group,
              lookup.code,
              lookup.label,
              lookup.description ?? null,
              lookup.metadata ? JSON.stringify(lookup.metadata) : null,
            ],
          );
        }
      },
    );
  }

  private async loadLookups(): Promise<TiramisLookupSeed[]> {
    const lookups = new Map<string, TiramisLookupSeed>();

    for (const lookup of TIRAMIS_LOOKUPS) {
      this.addLookup(lookups, lookup);
    }

    const referenceDir = this.resolveReferenceDataDir();

    if (!referenceDir) {
      return [...lookups.values()];
    }

    await this.loadCountries(referenceDir, lookups);
    await this.loadCurrencies(referenceDir, lookups);
    await this.loadRegionsAndDistricts(referenceDir, lookups);

    return [...lookups.values()];
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

  private async loadCountries(
    referenceDir: string,
    lookups: Map<string, TiramisLookupSeed>,
  ) {
    const workbook = await this.tryLoadWorkbook(referenceDir, 'Countries.xlsx');

    if (!workbook) {
      return;
    }

    const sheet = workbook.worksheets[0];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }

      const label = this.cellText(row, 1);
      const code = this.cellText(row, 2);

      if (label && code) {
        this.addLookup(lookups, {
          group: 'COUNTRY',
          code,
          label,
          metadata: { sourceFile: 'Countries.xlsx' },
        });
      }
    });
  }

  private async loadCurrencies(
    referenceDir: string,
    lookups: Map<string, TiramisLookupSeed>,
  ) {
    const workbook = await this.tryLoadWorkbook(
      referenceDir,
      'CURRENCIES.xlsx',
    );

    if (!workbook) {
      return;
    }

    const sheet = workbook.worksheets[0];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }

      const code = this.cellText(row, 1);
      const label = this.cellText(row, 2);

      if (code && label) {
        this.addLookup(lookups, {
          group: 'CURRENCY',
          code,
          label,
          metadata: { sourceFile: 'CURRENCIES.xlsx' },
        });
      }
    });
  }

  private async loadRegionsAndDistricts(
    referenceDir: string,
    lookups: Map<string, TiramisLookupSeed>,
  ) {
    const workbook = await this.tryLoadWorkbook(
      referenceDir,
      'Regions and Respective Districts -test.xlsx',
    );

    if (!workbook) {
      return;
    }

    const sheet = workbook.worksheets[0];
    let currentRegionCode = '';
    let currentRegion = '';

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }

      currentRegionCode = this.cellText(row, 1) || currentRegionCode;
      currentRegion = this.cellText(row, 2) || currentRegion;

      const districtCode = this.cellText(row, 3);
      const district = this.cellText(row, 4);

      if (currentRegion) {
        this.addLookup(lookups, {
          group: 'REGION',
          code: currentRegion,
          label: currentRegion,
          metadata: {
            sourceFile: 'Regions and Respective Districts -test.xlsx',
            regionCode: currentRegionCode,
          },
        });
      }

      if (district) {
        this.addLookup(lookups, {
          group: 'DISTRICT',
          code: district,
          label: district,
          metadata: {
            sourceFile: 'Regions and Respective Districts -test.xlsx',
            region: currentRegion,
            regionCode: currentRegionCode,
            districtCode,
          },
        });
      }
    });
  }

  private async tryLoadWorkbook(referenceDir: string, fileName: string) {
    const filePath = path.join(referenceDir, fileName);

    if (!existsSync(filePath)) {
      return null;
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    return workbook;
  }

  private cellText(row: ExcelJS.Row, column: number): string {
    const value = row.getCell(column).value;

    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'object' && 'text' in value) {
      return String(value.text).trim();
    }

    return String(value).trim();
  }

  private addLookup(
    lookups: Map<string, TiramisLookupSeed>,
    lookup: TiramisLookupSeed,
  ) {
    lookups.set(`${lookup.group}:${lookup.code}`, lookup);
  }
}
