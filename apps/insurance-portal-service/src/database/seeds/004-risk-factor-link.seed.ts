import { DataSource, Repository } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { Company } from '../../modules/platform/companies/entities/company.entity';
import { InsuranceRisk } from '../../modules/tenant/insurance-risks/entities/insurance-risk.entity';
import { RatingFactor } from '../../modules/tenant/rating-factors/entities/rating-factor.entity';
import { RiskRequiredFactor } from '../../modules/tenant/risk-required-factors/entities/risk-required-factor.entity';

type FactorRequirement = {
  code: string;
  isRequired: boolean;
};

export default class RiskFactorLinkSeeder implements Seeder {
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
      const riskRepo = manager.getRepository(InsuranceRisk);
      const factorRepo = manager.getRepository(RatingFactor);
      const requiredFactorRepo = manager.getRepository(RiskRequiredFactor);
      const company = await this.getTargetCompany(companyRepo);
      const linkedCount = await this.linkFactorsForCompany(
        company.id,
        riskRepo,
        factorRepo,
        requiredFactorRepo,
      );

      console.log(
        `[RiskFactorLinkSeeder] Linked ${linkedCount} risk-factor requirements for ${company.name} (${company.id})`,
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('[RiskFactorLinkSeeder] Seeding failed:', error);
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

  private async linkFactorsForCompany(
    companyId: string,
    riskRepo: Repository<InsuranceRisk>,
    factorRepo: Repository<RatingFactor>,
    requiredFactorRepo: Repository<RiskRequiredFactor>,
  ): Promise<number> {
    const risks = await riskRepo.find({
      where: { company_id: companyId, is_active: true },
      relations: { product: true },
    });

    if (risks.length === 0) {
      return 0;
    }

    const factors = await factorRepo.find({
      where: { company_id: companyId, is_active: true },
    });
    const factorIdByCode = new Map(
      factors.map((factor) => [factor.code.trim().toLowerCase(), factor.id]),
    );

    const existingLinks = await requiredFactorRepo.find({
      where: { company_id: companyId },
    });
    const existingKeys = new Set(
      existingLinks.map((link) => `${link.risk_id}::${link.factor_id}`),
    );

    let created = 0;

    for (const risk of risks) {
      const requirements = this.resolveFactorRequirementsForRisk(
        risk.risk_name,
        risk.product?.product_name ?? '',
      );

      let sortOrder = 0;

      for (const requirement of requirements) {
        const factorId = factorIdByCode.get(requirement.code);
        if (!factorId) {
          continue;
        }

        const linkKey = `${risk.id}::${factorId}`;
        if (existingKeys.has(linkKey)) {
          continue;
        }

        await requiredFactorRepo.save(
          requiredFactorRepo.create({
            company_id: companyId,
            risk_id: risk.id,
            factor_id: factorId,
            is_required: requirement.isRequired,
            sort_order: sortOrder,
          }),
        );

        existingKeys.add(linkKey);
        created += 1;
        sortOrder += 1;
      }
    }

    return created;
  }

  private resolveFactorRequirementsForRisk(
    riskName: string,
    productName: string,
  ): FactorRequirement[] {
    const text = `${riskName} ${productName}`.toLowerCase();
    const requirements: FactorRequirement[] = [
      { code: 'sum_insured', isRequired: true },
      { code: 'payment_mode', isRequired: true },
      { code: 'currency_code', isRequired: true },
      { code: 'exchange_rate', isRequired: true },
      { code: 'sale_point_code', isRequired: true },
      { code: 'officer_name', isRequired: true },
      { code: 'officer_title', isRequired: true },
      { code: 'policy_holder_type', isRequired: true },
      { code: 'policy_holder_id_type', isRequired: false },
      { code: 'region_code', isRequired: false },
      { code: 'district_code', isRequired: false },
      { code: 'tax_code', isRequired: false },
      { code: 'is_tax_exempted', isRequired: false },
    ];

    const isMotor =
      /(motor|vehicle|motorcycle|trailer|bus|passenger|commercial)/i.test(text);
    const isCargoOrMarine =
      /(marine|cargo|container|haulier|transport|git|icc)/i.test(text);

    if (isMotor) {
      requirements.push({ code: 'motor_category', isRequired: true });
      requirements.push({ code: 'motor_type', isRequired: true });
      requirements.push({ code: 'registration_number', isRequired: true });
      requirements.push({ code: 'chassis_number', isRequired: true });
      requirements.push({ code: 'make', isRequired: true });
      requirements.push({ code: 'model', isRequired: true });
      requirements.push({ code: 'body_type', isRequired: false });
      requirements.push({ code: 'engine_number', isRequired: false });
      requirements.push({ code: 'engine_capacity', isRequired: false });
      requirements.push({ code: 'fuel_used', isRequired: false });
      requirements.push({ code: 'year_of_manufacture', isRequired: true });
      requirements.push({ code: 'motor_usage', isRequired: false });
      requirements.push({ code: 'owner_name', isRequired: false });
      requirements.push({ code: 'owner_category', isRequired: false });
      requirements.push({ code: 'seat_capacity', isRequired: false });
      requirements.push({ code: 'vehicle_weight_kg', isRequired: false });
      requirements.push({ code: 'claim_record', isRequired: false });
      requirements.push({ code: 'cover_type', isRequired: false });
    }

    if (isCargoOrMarine) {
      requirements.push({ code: 'cargo_weight_ton', isRequired: true });
    }

    const unique = new Map<string, FactorRequirement>();
    for (const requirement of requirements) {
      const existing = unique.get(requirement.code);
      if (!existing) {
        unique.set(requirement.code, requirement);
        continue;
      }

      unique.set(requirement.code, {
        code: requirement.code,
        isRequired: existing.isRequired || requirement.isRequired,
      });
    }

    return Array.from(unique.values());
  }
}
