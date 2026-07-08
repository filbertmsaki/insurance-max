import { DataSource, Repository } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { FactorDataType } from '@insurance-max/portal-shared/enums/factor-data-type.enum';
import { Company } from '../../modules/platform/companies/entities/company.entity';
import { RatingFactor } from '../../modules/tenant/rating-factors/entities/rating-factor.entity';

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
  {
    code: 'payment_mode',
    name: 'Payment Mode',
    data_type: FactorDataType.SELECT,
    options: ['Cash', 'Cheque', 'EFT'],
  },
  {
    code: 'currency_code',
    name: 'Currency Code',
    data_type: FactorDataType.TEXT,
    default_value: 'TZS',
  },
  {
    code: 'exchange_rate',
    name: 'Exchange Rate',
    data_type: FactorDataType.NUMBER,
    default_value: '1',
  },
  {
    code: 'sale_point_code',
    name: 'Sale Point Code',
    data_type: FactorDataType.TEXT,
  },
  {
    code: 'officer_name',
    name: 'Insurance Officer Name',
    data_type: FactorDataType.TEXT,
  },
  {
    code: 'officer_title',
    name: 'Insurance Officer Title',
    data_type: FactorDataType.TEXT,
  },
  {
    code: 'policy_holder_type',
    name: 'Policy Holder Type',
    data_type: FactorDataType.SELECT,
    options: ['Individual', 'Corporate'],
  },
  {
    code: 'policy_holder_id_type',
    name: 'Policy Holder ID Type',
    data_type: FactorDataType.TEXT,
  },
  {
    code: 'region_code',
    name: 'Region Code',
    data_type: FactorDataType.TEXT,
  },
  {
    code: 'district_code',
    name: 'District Code',
    data_type: FactorDataType.TEXT,
  },
  {
    code: 'tax_code',
    name: 'Tax Code',
    data_type: FactorDataType.TEXT,
  },
  {
    code: 'is_tax_exempted',
    name: 'Is Tax Exempted',
    data_type: FactorDataType.BOOLEAN,
    default_value: 'false',
  },
  {
    code: 'motor_category',
    name: 'Motor Category',
    data_type: FactorDataType.TEXT,
  },
  {
    code: 'motor_type',
    name: 'Motor Type',
    data_type: FactorDataType.TEXT,
  },
  {
    code: 'registration_number',
    name: 'Registration Number',
    data_type: FactorDataType.TEXT,
  },
  {
    code: 'chassis_number',
    name: 'Chassis Number',
    data_type: FactorDataType.TEXT,
  },
  {
    code: 'make',
    name: 'Make',
    data_type: FactorDataType.TEXT,
  },
  {
    code: 'model',
    name: 'Model',
    data_type: FactorDataType.TEXT,
  },
  {
    code: 'body_type',
    name: 'Body Type',
    data_type: FactorDataType.TEXT,
  },
  {
    code: 'engine_number',
    name: 'Engine Number',
    data_type: FactorDataType.TEXT,
  },
  {
    code: 'engine_capacity',
    name: 'Engine Capacity',
    data_type: FactorDataType.NUMBER,
  },
  {
    code: 'fuel_used',
    name: 'Fuel Used',
    data_type: FactorDataType.TEXT,
  },
  {
    code: 'motor_usage',
    name: 'Motor Usage',
    data_type: FactorDataType.TEXT,
  },
  {
    code: 'owner_name',
    name: 'Owner Name',
    data_type: FactorDataType.TEXT,
  },
  {
    code: 'owner_category',
    name: 'Owner Category',
    data_type: FactorDataType.TEXT,
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
      const company = await this.getTargetCompany(companyRepo);
      const seededCount = await this.seedCompanyFactors(
        factorRepo,
        company.id,
        ratingFactorSeeds,
      );

      console.log(
        `[RatingFactorsSeeder] Seeded ${seededCount} rating factors for ${company.name} (${company.id})`,
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('[RatingFactorsSeeder] Seeding failed:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async getTargetCompany(
    companyRepo: Repository<Company>,
  ): Promise<Company> {
    const targetCompanyCode = process.env.SEED_TARGET_COMPANY_CODE ?? 'ICC110';

    const company = await companyRepo.findOne({
      where: {
        tira_company_code: targetCompanyCode,
      },
    });

    if (!company) {
      throw new Error(
        `Target seed company not found. Set SEED_TARGET_COMPANY_CODE=${targetCompanyCode}`,
      );
    }

    return company;
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
