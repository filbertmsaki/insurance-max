import { DataSource, Repository } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { FactorDataType } from '@insurance-max/portal-shared/enums/factor-data-type.enum';
import { Company } from '../../modules/companies/entities/company.entity';
import { RatingFactor } from '../../modules/rating-factors/entities/rating-factor.entity';

type RatingFactorSeed = {
  code: string;
  name: string;
  data_type: FactorDataType;
  options?: string[] | null;
  default_value?: string | null;
  is_required?: boolean;
  is_active?: boolean;
};

const ratingFactorSeeds: RatingFactorSeed[] = [
  {
    code: 'sum_insured',
    name: 'Sum Insured',
    data_type: FactorDataType.NUMBER,
    default_value: '0',
    is_required: true,
  },
  {
    code: 'sum_insured_amount',
    name: 'Sum Insured Amount',
    data_type: FactorDataType.NUMBER,
    default_value: '0',
  },
  {
    code: 'vehicle_age',
    name: 'Vehicle Age',
    data_type: FactorDataType.NUMBER,
    default_value: '0',
  },
  {
    code: 'seat_capacity',
    name: 'Seating Capacity',
    data_type: FactorDataType.NUMBER,
    default_value: '0',
  },
  {
    code: 'vehicle_weight_kg',
    name: 'Vehicle Weight (KG)',
    data_type: FactorDataType.NUMBER,
    default_value: '0',
  },
  {
    code: 'cargo_weight_ton',
    name: 'Cargo Weight (Tons)',
    data_type: FactorDataType.NUMBER,
    default_value: '0',
  },
  {
    code: 'year_of_manufacture',
    name: 'Year of Manufacture',
    data_type: FactorDataType.NUMBER,
  },
  {
    code: 'claim_record',
    name: 'Claim Record',
    data_type: FactorDataType.NUMBER,
    default_value: '0',
  },
  {
    code: 'cover_type',
    name: 'Cover Type',
    data_type: FactorDataType.SELECT,
    options: ['Comprehensive', 'Third Party', 'Third Party Fire & Theft'],
  },
  {
    code: 'is_new_business',
    name: 'Is New Business',
    data_type: FactorDataType.BOOLEAN,
    default_value: 'false',
  },
  {
    code: 'policy_start_date',
    name: 'Policy Start Date',
    data_type: FactorDataType.DATE,
  },
];

export default class RatingFactorsSeeder implements Seeder {
  public async run(
    dataSource: DataSource,
    factoryManager: SeederFactoryManager,
  ): Promise<void> {
    void factoryManager;

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const manager = queryRunner.manager;
      const companyRepo = manager.getRepository(Company);
      const factorRepo = manager.getRepository(RatingFactor);

      const companies = await companyRepo.find({
        where: { status: 'active' },
        order: { created_at: 'ASC' },
      });

      if (companies.length === 0) {
        console.warn(
          '[RatingFactorsSeeder] No active companies found; skipping rating factor seed.',
        );
        await queryRunner.commitTransaction();
        return;
      }

      for (const company of companies) {
        const seededCount = await this.seedCompanyFactors(
          factorRepo,
          company.id,
          ratingFactorSeeds,
        );

        console.log(
          `[RatingFactorsSeeder] Seeded ${seededCount} rating factors for ${company.name} (${company.id})`,
        );
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('[RatingFactorsSeeder] Seeding failed:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async seedCompanyFactors(
    factorRepo: Repository<RatingFactor>,
    companyId: string,
    definitions: RatingFactorSeed[],
  ): Promise<number> {
    const existingFactors = await factorRepo.find({
      where: { company_id: companyId },
      withDeleted: true,
    });

    const factorsByCode = new Map(
      existingFactors.map((factor) => [
        factor.code.trim().toLowerCase(),
        factor,
      ]),
    );

    for (const definition of definitions) {
      const normalizedCode = definition.code.trim().toLowerCase();
      const normalizedName = definition.name.trim();

      const factor =
        factorsByCode.get(normalizedCode) ??
        factorRepo.create({
          company_id: companyId,
          code: normalizedCode,
        });

      factor.company_id = companyId;
      factor.code = normalizedCode;
      factor.name = normalizedName;
      factor.data_type = definition.data_type;
      factor.options = definition.options ?? null;
      factor.default_value = definition.default_value ?? null;
      factor.is_required = definition.is_required ?? false;
      factor.is_active = definition.is_active ?? true;
      factor.deleted_at = null;

      await factorRepo.save(factor);
    }

    return definitions.length;
  }
}
