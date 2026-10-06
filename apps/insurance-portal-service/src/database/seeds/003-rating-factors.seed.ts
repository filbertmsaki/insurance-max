import { environment } from '@insurance-max/shared-config';
import { DataSource, Repository } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { Company } from '../../modules/platform/companies/entities/company.entity';
import {
  APPROVED_MOTOR_FACTORS,
  type ApprovedMotorFactorDefinition,
} from '../../modules/tenant/pricing/domain/motor-rating.config';
import { RatingFactor } from '../../modules/tenant/rating-factors/entities/rating-factor.entity';

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
        APPROVED_MOTOR_FACTORS,
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
    const targetCompanyCode = environment.SEED_TARGET_COMPANY_CODE ?? 'ICC739';

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
    definitions: ApprovedMotorFactorDefinition[],
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
      factor.unit = definition.unit;
      factor.options = null;
      factor.default_value = definition.default_value ?? null;
      factor.is_required = false;
      factor.is_active = true;
      factor.deleted_at = null;

      await factorRepo.save(factor);
    }

    for (const factor of existingFactors) {
      if (definitions.some((definition) => definition.code === factor.code)) {
        continue;
      }

      if (factor.is_active || factor.is_required) {
        factor.is_active = false;
        factor.is_required = false;
        await factorRepo.save(factor);
      }
    }

    return definitions.length;
  }
}
