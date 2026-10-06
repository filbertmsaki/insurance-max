import { environment } from '@insurance-max/shared-config';
import { DataSource, Repository } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { Company } from '../../modules/platform/companies/entities/company.entity';
import { ENDORSEMENT_TYPES } from './data/endorsement-types.seed-data';
import { requireColumns, withSeedTransaction } from './shared/seed-utils';

export default class EndorsementTypesSeeder implements Seeder {
  async run(
    dataSource: DataSource,
    _factoryManager: SeederFactoryManager,
  ): Promise<void> {
    await withSeedTransaction(
      dataSource,
      'seed:endorsement-types',
      async (qr) => {
        await requireColumns(qr, 'endorsement_types', [
          'company_id',
          'code',
          'name',
          'tira_endorsement_type',
          'requires_new_cover_note',
          'is_active',
        ]);

        const companyRepo = qr.manager.getRepository(Company);
        const company = await this.getTargetCompany(companyRepo);

        console.log(
          `[EndorsementTypesSeeder] Seeding endorsement types for company ${company.name} (${company.id})`,
        );

        for (const type of ENDORSEMENT_TYPES) {
          await qr.query(
            `
            INSERT INTO endorsement_types (
              company_id,
              code,
              name,
              tira_endorsement_type,
              requires_new_cover_note,
              is_active,
              created_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, true, now(), now())
            ON CONFLICT (company_id, code)
            DO UPDATE SET
              name = EXCLUDED.name,
              tira_endorsement_type = EXCLUDED.tira_endorsement_type,
              requires_new_cover_note = EXCLUDED.requires_new_cover_note,
              updated_at = now()
          `,
            [
              company.id,
              type.code,
              type.name,
              type.tira_endorsement_type,
              type.requires_new_cover_note,
            ],
          );
        }

        console.log(
          `[EndorsementTypesSeeder] Seed complete: ${ENDORSEMENT_TYPES.length} endorsement types, mapped onto the TIRAMIS EndorsementType enum (1-3; 4 is reserved for cancellations).`,
        );
      },
    );
  }

  private async getTargetCompany(
    companyRepo: Repository<Company>,
  ): Promise<Company> {
    const targetCompanyCode = environment.SEED_TARGET_COMPANY_CODE ?? 'ICC739';

    const company = await companyRepo.findOne({
      where: { tira_company_code: targetCompanyCode },
    });

    if (!company) {
      throw new Error(
        `Target seed company not found. Set SEED_TARGET_COMPANY_CODE=${targetCompanyCode}`,
      );
    }

    return company;
  }
}
