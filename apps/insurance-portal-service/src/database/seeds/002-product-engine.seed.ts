import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DataSource, Repository } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { RateType } from '@insurance-max/portal-shared/enums/rate-type.enum';
import { Company } from '../../modules/companies/entities/company.entity';
import { InsuranceCategory } from '../../modules/insurance-categories/entities/insurance-category.entity';
import { InsuranceProduct } from '../../modules/insurance-products/entities/insurance-product.entity';
import { InsuranceSubClass } from '../../modules/insurance-sub-classes/entities/insurance-sub-class.entity';
import { InsuranceRisk } from '../../modules/insurance-risks/entities/insurance-risk.entity';
import { RatingFactor } from '../../modules/rating-factors/entities/rating-factor.entity';
import { RiskRequiredFactor } from '../../modules/risk-required-factors/entities/risk-required-factor.entity';
import { RiskRatingRule } from '../../modules/risk-rating-rules/entities/risk-rating-rule.entity';
import { RiskRuleCondition } from '../../modules/risk-rule-conditions/entities/risk-rule-condition.entity';

type CategorySeed = {
  code: string;
  name: string;
  description: string | null;
};

type ProductSeed = {
  category_code: string;
  product_code: string;
  product_name: string;
  description: string | null;
};

type SubClassSeed = {
  product_code: string;
  code: string;
  name: string;
  description: string | null;
};

type RiskSeed = {
  product_code: string;
  sub_class_code: string | null;
  risk_code: string;
  risk_name: string;
  description: string | null;
};

type RuleSeed = {
  risk_code: string;
  rule_name: string;
  rate_type: keyof typeof RateType;
  rate_value?: number | null;
  percentage_rate?: number | null;
  fixed_amount?: number | null;
  per_unit_amount?: number | null;
  per_unit_factor_code?: string | null;
  formula?: string | null;
  minimum_amount?: number | null;
  priority: number;
  source_rate_text?: string | null;
};

type ProductEngineSeedPayload = {
  categories: CategorySeed[];
  products: ProductSeed[];
  sub_classes: SubClassSeed[];
  risks: RiskSeed[];
  rules: RuleSeed[];
};

type NormalizedRuleSeed = {
  rate_type: RateType;
  percentage_rate: number | null;
  fixed_amount: number | null;
  per_unit_amount: number | null;
  per_unit_factor_code: string | null;
  formula: string | null;
};

const SEED_DATA_FILE_NAME = 'product-engine.seed.data.json';

function resolveSeedDataFilePath(): string {
  const candidates = [
    path.resolve(__dirname, 'data', SEED_DATA_FILE_NAME),
    path.resolve(
      process.cwd(),
      'src',
      'database',
      'seeds',
      'data',
      SEED_DATA_FILE_NAME,
    ),
    path.resolve(
      process.cwd(),
      'dist',
      'database',
      'seeds',
      'data',
      SEED_DATA_FILE_NAME,
    ),
  ];

  for (const candidate of candidates) {
    try {
      readFileSync(candidate, 'utf8');
      return candidate;
    } catch {
      // Continue trying next candidate.
    }
  }

  throw new Error(
    `[ProductEngineSeeder] Seed data file "${SEED_DATA_FILE_NAME}" was not found. Checked: ${candidates.join(', ')}`,
  );
}

function loadSeedPayload(): ProductEngineSeedPayload {
  const filePath = resolveSeedDataFilePath();
  const raw = readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw) as ProductEngineSeedPayload;

  return {
    categories: parsed.categories ?? [],
    products: parsed.products ?? [],
    sub_classes: parsed.sub_classes ?? [],
    risks: parsed.risks ?? [],
    rules: parsed.rules ?? [],
  };
}

const seedPayload = loadSeedPayload();
const categorySeeds = seedPayload.categories;
const productSeeds = seedPayload.products;
const subClassSeeds = seedPayload.sub_classes;
const riskSeeds = seedPayload.risks;
const ruleSeeds = seedPayload.rules;

export default class ProductEngineSeeder implements Seeder {
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
      const categoryRepo = manager.getRepository(InsuranceCategory);
      const productRepo = manager.getRepository(InsuranceProduct);
      const subClassRepo = manager.getRepository(InsuranceSubClass);
      const riskRepo = manager.getRepository(InsuranceRisk);
      const ruleRepo = manager.getRepository(RiskRatingRule);
      const ruleConditionRepo = manager.getRepository(RiskRuleCondition);
      const requiredFactorRepo = manager.getRepository(RiskRequiredFactor);
      const factorRepo = manager.getRepository(RatingFactor);

      const company = await companyRepo.findOne({
        where: { status: 'active' },
        order: { created_at: 'ASC' },
      });

      if (!company) {
        console.warn(
          '[ProductEngineSeeder] No active company found; skipping product engine seed.',
        );
        await queryRunner.commitTransaction();
        return;
      }

      const companyId = company.id;
      console.log(
        `[ProductEngineSeeder] Rebuilding product engine seed data for company ${company.name} (${companyId})`,
      );

      await this.clearExistingProductEngineData(
        companyId,
        ruleConditionRepo,
        ruleRepo,
        requiredFactorRepo,
        factorRepo,
        riskRepo,
        subClassRepo,
        productRepo,
        categoryRepo,
      );

      const categoryMap = await this.seedCategories(categoryRepo, companyId);
      const productMap = await this.seedProducts(
        productRepo,
        companyId,
        categoryMap,
      );
      const subClassMap = await this.seedSubClasses(
        subClassRepo,
        companyId,
        productMap,
      );
      const riskMap = await this.seedRisks(
        riskRepo,
        companyId,
        productMap,
        subClassMap,
      );
      await this.seedRules(ruleRepo, companyId, riskMap);

      await queryRunner.commitTransaction();

      console.log(
        `[ProductEngineSeeder] Seed complete: categories=${categoryMap.size}, products=${productMap.size}, subClasses=${subClassMap.size}, risks=${riskMap.size}, rules=${ruleSeeds.length}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('[ProductEngineSeeder] Seeding failed:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async clearExistingProductEngineData(
    companyId: string,
    ruleConditionRepo: Repository<RiskRuleCondition>,
    ruleRepo: Repository<RiskRatingRule>,
    requiredFactorRepo: Repository<RiskRequiredFactor>,
    factorRepo: Repository<RatingFactor>,
    riskRepo: Repository<InsuranceRisk>,
    subClassRepo: Repository<InsuranceSubClass>,
    productRepo: Repository<InsuranceProduct>,
    categoryRepo: Repository<InsuranceCategory>,
  ): Promise<void> {
    await ruleConditionRepo.delete({ company_id: companyId });
    await ruleRepo.delete({ company_id: companyId });
    await requiredFactorRepo.delete({ company_id: companyId });
    await factorRepo.delete({ company_id: companyId });
    await riskRepo.delete({ company_id: companyId });
    await subClassRepo.delete({ company_id: companyId });
    await productRepo.delete({ company_id: companyId });
    await categoryRepo.delete({ company_id: companyId });
  }

  private async seedCategories(
    repo: Repository<InsuranceCategory>,
    companyId: string,
  ): Promise<Map<string, InsuranceCategory>> {
    const map = new Map<string, InsuranceCategory>();

    for (const seed of categorySeeds) {
      const entity = await repo.save(
        repo.create({
          company_id: companyId,
          code: seed.code,
          name: seed.name,
          description: seed.description,
          is_active: true,
        }),
      );

      map.set(seed.code, entity);
    }

    return map;
  }

  private async seedProducts(
    repo: Repository<InsuranceProduct>,
    companyId: string,
    categoryMap: Map<string, InsuranceCategory>,
  ): Promise<Map<string, InsuranceProduct>> {
    const map = new Map<string, InsuranceProduct>();

    for (const seed of productSeeds) {
      const category = categoryMap.get(seed.category_code);
      if (!category) {
        continue;
      }

      const entity = await repo.save(
        repo.create({
          company_id: companyId,
          category_id: category.id,
          product_code: seed.product_code,
          product_name: seed.product_name,
          description: seed.description,
          is_active: true,
        }),
      );

      map.set(seed.product_code, entity);
    }

    return map;
  }

  private async seedSubClasses(
    repo: Repository<InsuranceSubClass>,
    companyId: string,
    productMap: Map<string, InsuranceProduct>,
  ): Promise<Map<string, InsuranceSubClass>> {
    const map = new Map<string, InsuranceSubClass>();

    for (const seed of subClassSeeds) {
      const product = productMap.get(seed.product_code);
      if (!product) {
        continue;
      }

      const entity = await repo.save(
        repo.create({
          company_id: companyId,
          product_id: product.id,
          code: seed.code,
          name: seed.name,
          description: seed.description,
          is_active: true,
        }),
      );

      map.set(`${seed.product_code}::${seed.code}`, entity);
    }

    return map;
  }

  private async seedRisks(
    repo: Repository<InsuranceRisk>,
    companyId: string,
    productMap: Map<string, InsuranceProduct>,
    subClassMap: Map<string, InsuranceSubClass>,
  ): Promise<Map<string, InsuranceRisk>> {
    const map = new Map<string, InsuranceRisk>();
    const usedRiskNamesByProduct = new Set<string>();

    for (const seed of riskSeeds) {
      const product = productMap.get(seed.product_code);
      if (!product) {
        continue;
      }

      const subClass = seed.sub_class_code
        ? subClassMap.get(`${seed.product_code}::${seed.sub_class_code}`)
        : null;
      const riskName = this.resolveUniqueRiskNameForProduct(
        product.id,
        seed.risk_name,
        seed.risk_code,
        usedRiskNamesByProduct,
      );

      const entity = await repo.save(
        repo.create({
          company_id: companyId,
          product_id: product.id,
          sub_class_id: subClass?.id ?? null,
          risk_code: seed.risk_code,
          risk_name: riskName,
          description: seed.description,
          is_active: true,
        }),
      );

      map.set(seed.risk_code, entity);
    }

    return map;
  }

  private resolveUniqueRiskNameForProduct(
    productId: string,
    rawRiskName: string,
    riskCode: string,
    usedRiskNamesByProduct: Set<string>,
  ): string {
    const baseName = rawRiskName.trim();
    let candidate = baseName;
    let suffixIndex = 0;

    while (usedRiskNamesByProduct.has(`${productId}::${candidate}`)) {
      suffixIndex += 1;
      candidate =
        suffixIndex === 1
          ? `${baseName} (${riskCode})`
          : `${baseName} (${riskCode}-${suffixIndex})`;
    }

    usedRiskNamesByProduct.add(`${productId}::${candidate}`);
    return candidate;
  }

  private async seedRules(
    repo: Repository<RiskRatingRule>,
    companyId: string,
    riskMap: Map<string, InsuranceRisk>,
  ): Promise<void> {
    const validRateTypes = new Set<string>(Object.values(RateType));

    for (const seed of ruleSeeds) {
      const risk = riskMap.get(seed.risk_code);
      if (!risk) {
        continue;
      }

      const fallbackRateType = validRateTypes.has(seed.rate_type)
        ? (seed.rate_type as RateType)
        : RateType.FORMULA;
      const normalizedRule = this.normalizeRuleSeed(seed, fallbackRateType);

      await repo.save(
        repo.create({
          company_id: companyId,
          risk_id: risk.id,
          rule_name: seed.rule_name,
          rate_type: normalizedRule.rate_type,
          percentage_rate: normalizedRule.percentage_rate,
          fixed_amount: normalizedRule.fixed_amount,
          per_unit_amount: normalizedRule.per_unit_amount,
          per_unit_factor_code: normalizedRule.per_unit_factor_code,
          formula: normalizedRule.formula,
          minimum_amount: seed.minimum_amount ?? null,
          priority: seed.priority,
          is_active: true,
        }),
      );
    }
  }

  private normalizeRuleSeed(
    seed: RuleSeed,
    fallbackRateType: RateType,
  ): NormalizedRuleSeed {
    let rateType = fallbackRateType;
    let percentageRate = this.toNumber(seed.percentage_rate ?? seed.rate_value);
    let fixedAmount = this.toNumber(seed.fixed_amount);
    let perUnitAmount = this.toNumber(seed.per_unit_amount);
    let perUnitFactorCode = this.normalizeFactorCode(
      seed.per_unit_factor_code ?? null,
    );
    let formula = seed.formula ?? null;

    const rateText = (seed.source_rate_text ?? seed.formula ?? '').trim();
    const invalidFormulaText = /^(n\/a|#value!)$/i.test(rateText);

    if (rateText) {
      const percentagePlusPerUnit = this.extractPercentagePlusPerUnit(rateText);
      if (percentagePlusPerUnit) {
        rateType = RateType.PERCENTAGE_PLUS_PER_UNIT;
        percentageRate = percentagePlusPerUnit.percentageRate;
        perUnitAmount = percentagePlusPerUnit.perUnitAmount;
        perUnitFactorCode = percentagePlusPerUnit.perUnitFactorCode;
        formula = null;
      } else {
        const percentagePlusFixed = this.extractPercentagePlusFixed(rateText);
        if (percentagePlusFixed) {
          rateType = RateType.PERCENTAGE_PLUS_FIXED;
          percentageRate = percentagePlusFixed.percentageRate;
          fixedAmount = percentagePlusFixed.fixedAmount;
          formula = null;
        } else {
          const perUnitOnly = this.extractPerUnitOnly(rateText);
          if (perUnitOnly) {
            rateType = RateType.PER_UNIT;
            perUnitAmount = perUnitOnly.perUnitAmount;
            perUnitFactorCode = perUnitOnly.perUnitFactorCode;
            formula = null;
          } else {
            const percentageOnly = this.extractPercentageOnly(rateText);
            if (percentageOnly !== null) {
              rateType = RateType.PERCENTAGE;
              percentageRate = percentageOnly;
              formula = null;
            } else {
              const fixedOnly = this.extractFixedOnly(rateText);
              if (fixedOnly !== null) {
                rateType = RateType.FIXED;
                fixedAmount = fixedOnly;
                formula = null;
              }
            }
          }
        }
      }
    }

    if (invalidFormulaText) {
      rateType = RateType.FORMULA;
      formula = rateText;
    }

    switch (rateType) {
      case RateType.PERCENTAGE:
        fixedAmount = null;
        perUnitAmount = null;
        perUnitFactorCode = null;
        formula = null;
        break;
      case RateType.FIXED:
        percentageRate = null;
        perUnitAmount = null;
        perUnitFactorCode = null;
        formula = null;
        break;
      case RateType.PERCENTAGE_PLUS_FIXED:
        perUnitAmount = null;
        perUnitFactorCode = null;
        formula = null;
        break;
      case RateType.PERCENTAGE_PLUS_PER_UNIT:
        fixedAmount = null;
        formula = null;
        break;
      case RateType.PER_UNIT:
        percentageRate = null;
        fixedAmount = null;
        formula = null;
        break;
      case RateType.FORMULA:
        percentageRate = null;
        fixedAmount = null;
        perUnitAmount = null;
        perUnitFactorCode = null;
        break;
    }

    return {
      rate_type: rateType,
      percentage_rate: percentageRate,
      fixed_amount: fixedAmount,
      per_unit_amount: perUnitAmount,
      per_unit_factor_code: perUnitFactorCode,
      formula,
    };
  }

  private extractPercentagePlusPerUnit(rateText: string): {
    percentageRate: number;
    perUnitAmount: number;
    perUnitFactorCode: string | null;
  } | null {
    const match = rateText.match(
      /^([\d.]+)\s*%\s*\+\s*(?:tzs|tshs?|tsh\.?)?\s*([\d,]+(?:\.\d+)?)\s*per\s+([a-z_ ]+)$/i,
    );
    if (!match) {
      return null;
    }

    return {
      percentageRate: Number(match[1]),
      perUnitAmount: this.parseAmount(match[2]),
      perUnitFactorCode: this.normalizeFactorCode(match[3]),
    };
  }

  private extractPercentagePlusFixed(rateText: string): {
    percentageRate: number;
    fixedAmount: number;
  } | null {
    const match = rateText.match(
      /^([\d.]+)\s*%\s*\+\s*(?:tzs|tshs?|tsh\.?)?\s*([\d,]+(?:\.\d+)?)$/i,
    );
    if (!match) {
      return null;
    }

    return {
      percentageRate: Number(match[1]),
      fixedAmount: this.parseAmount(match[2]),
    };
  }

  private extractPerUnitOnly(rateText: string): {
    perUnitAmount: number;
    perUnitFactorCode: string | null;
  } | null {
    const match = rateText.match(
      /^(?:tzs|tshs?|tsh\.?)?\s*([\d,]+(?:\.\d+)?)\s*per\s+([a-z_ ]+)$/i,
    );
    if (!match) {
      return null;
    }

    return {
      perUnitAmount: this.parseAmount(match[1]),
      perUnitFactorCode: this.normalizeFactorCode(match[2]),
    };
  }

  private extractPercentageOnly(rateText: string): number | null {
    const match = rateText.match(/^([\d.]+)\s*%$/i);
    if (!match) {
      return null;
    }

    return Number(match[1]);
  }

  private extractFixedOnly(rateText: string): number | null {
    const match = rateText.match(
      /^(?:tzs|tshs?|tsh\.?)?\s*([\d,]+(?:\.\d+)?)$/i,
    );
    if (!match) {
      return null;
    }

    return this.parseAmount(match[1]);
  }

  private normalizeFactorCode(raw: string | null): string | null {
    if (!raw) return null;

    const normalized = raw.trim().toLowerCase();
    if (!normalized) return null;

    if (normalized.includes('seat')) return 'seat_capacity';
    if (normalized.includes('weight') && normalized.includes('vehicle'))
      return 'vehicle_weight_kg';
    if (normalized.includes('ton')) return 'cargo_weight_ton';

    return normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  private parseAmount(raw: string): number {
    const parsed = Number(raw.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toNumber(value: number | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
