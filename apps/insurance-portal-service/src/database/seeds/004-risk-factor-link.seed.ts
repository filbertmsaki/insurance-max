import { DataSource, In, Repository } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { Company } from '../../modules/platform/companies/entities/company.entity';
import { InsuranceRisk } from '../../modules/tenant/insurance-risks/entities/insurance-risk.entity';
import {
  deriveMotorRequiredFactorCodes,
  isMotorProductCode,
} from '../../modules/tenant/pricing/domain/motor-rating.config';
import { RatingFactor } from '../../modules/tenant/rating-factors/entities/rating-factor.entity';
import { RiskRatingRule } from '../../modules/tenant/risk-rating-rules/entities/risk-rating-rule.entity';
import { RiskRequiredFactor } from '../../modules/tenant/risk-required-factors/entities/risk-required-factor.entity';

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
      const ruleRepo = manager.getRepository(RiskRatingRule);
      const requiredFactorRepo = manager.getRepository(RiskRequiredFactor);
      const company = await this.getTargetCompany(companyRepo);
      const linkedCount = await this.linkFactorsForCompany(
        company.id,
        riskRepo,
        factorRepo,
        ruleRepo,
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
    ruleRepo: Repository<RiskRatingRule>,
    requiredFactorRepo: Repository<RiskRequiredFactor>,
  ): Promise<number> {
    const risks = await riskRepo.find({
      where: { company_id: companyId, is_active: true },
      relations: { product: true },
    });
    const motorRisks = risks.filter((risk) =>
      isMotorProductCode(risk.product?.product_code ?? null),
    );

    if (motorRisks.length === 0) {
      return 0;
    }

    const factors = await factorRepo.find({
      where: { company_id: companyId, is_active: true },
    });
    const factorIdByCode = new Map(
      factors.map((factor) => [factor.code.trim().toLowerCase(), factor.id]),
    );
    const motorRiskIds = motorRisks.map((risk) => risk.id);
    const rules = await ruleRepo.find({
      where: {
        company_id: companyId,
        risk_id: In(motorRiskIds),
      },
    });
    const rulesByRiskId = new Map<string, RiskRatingRule[]>();
    for (const rule of rules) {
      const entries = rulesByRiskId.get(rule.risk_id) ?? [];
      entries.push(rule);
      rulesByRiskId.set(rule.risk_id, entries);
    }

    const existingLinks = await requiredFactorRepo.find({
      where: {
        company_id: companyId,
        risk_id: In(motorRiskIds),
      },
    });
    const existingByKey = new Map(
      existingLinks.map((link) => [`${link.risk_id}::${link.factor_id}`, link]),
    );

    let changes = 0;
    const desiredKeys = new Set<string>();

    for (const risk of motorRisks) {
      const preferredRule = this.resolvePreferredRule(
        rulesByRiskId.get(risk.id) ?? [],
      );
      if (!preferredRule) {
        continue;
      }

      const requiredCodes = deriveMotorRequiredFactorCodes({
        riskName: risk.risk_name,
        rateType: preferredRule.rate_type,
        perUnitFactorCode: preferredRule.per_unit_factor_code,
      });

      for (const [sortOrder, code] of requiredCodes.entries()) {
        const factorId = factorIdByCode.get(code);
        if (!factorId) {
          continue;
        }

        const linkKey = `${risk.id}::${factorId}`;
        desiredKeys.add(linkKey);

        const existing = existingByKey.get(linkKey);
        if (existing) {
          if (!existing.is_required || existing.sort_order !== sortOrder) {
            existing.is_required = true;
            existing.sort_order = sortOrder;
            await requiredFactorRepo.save(existing);
            changes += 1;
          }
          continue;
        }

        await requiredFactorRepo.save(
          requiredFactorRepo.create({
            company_id: companyId,
            risk_id: risk.id,
            factor_id: factorId,
            is_required: true,
            sort_order: sortOrder,
          }),
        );
        changes += 1;
      }
    }

    for (const link of existingLinks) {
      const linkKey = `${link.risk_id}::${link.factor_id}`;
      if (desiredKeys.has(linkKey)) {
        continue;
      }

      await requiredFactorRepo.delete(link.id);
      changes += 1;
    }

    return changes;
  }

  private resolvePreferredRule(
    rules: RiskRatingRule[],
  ): RiskRatingRule | null {
    const preferred = [...rules].sort((left, right) => {
      const leftScore =
        (left.is_active ? 4 : 0) + (left.rate_book_id ? 2 : 0) - left.priority;
      const rightScore =
        (right.is_active ? 4 : 0) +
        (right.rate_book_id ? 2 : 0) -
        right.priority;
      return rightScore - leftScore;
    })[0];

    return preferred ?? null;
  }
}
