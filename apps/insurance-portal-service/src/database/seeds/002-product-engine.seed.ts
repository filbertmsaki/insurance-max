import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DataSource, Repository } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { RateType } from '@insurance-max/portal-shared/enums/rate-type.enum';
import { Company } from '../../modules/platform/companies/entities/company.entity';
import { InsuranceBusinessLine } from '../../modules/tenant/insurance-categories/enums/insurance-business-line.enum';
import { InsuranceCategory } from '../../modules/tenant/insurance-categories/entities/insurance-category.entity';
import { InsuranceProduct } from '../../modules/tenant/insurance-products/entities/insurance-product.entity';
import { InsuranceSubClass } from '../../modules/tenant/insurance-sub-classes/entities/insurance-sub-class.entity';
import { InsuranceRisk } from '../../modules/tenant/insurance-risks/entities/insurance-risk.entity';
import { RiskRatingRule } from '../../modules/tenant/risk-rating-rules/entities/risk-rating-rule.entity';
import { roundRate } from '@insurance-max/portal-shared/utils/pricing-calculation.util';
import { normalizeFactorCode, parseRateText } from './rate-text-parser';

type CategorySeed = {
  code: string;
  name: string;
  description: string | null;
  business_line?: InsuranceBusinessLine;
};

type ProductSeed = {
  category_code: string;
  product_code: string;
  product_name: string;
  description: string | null;
  business_line?: InsuranceBusinessLine;
  supports_fleet?: boolean;
  tiramis_product_code?: string | null;
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
      // Keep checking the next candidate.
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

      const company = await this.getTargetCompany(companyRepo);
      const companyId = company.id;

      console.log(
        `[ProductEngineSeeder] Seeding product engine data for company ${company.name} (${companyId})`,
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

  private async seedCategories(
    repo: Repository<InsuranceCategory>,
    companyId: string,
  ): Promise<Map<string, InsuranceCategory>> {
    const map = new Map<string, InsuranceCategory>();

    for (const seed of categorySeeds) {
      const entity = await this.ensureCategory(repo, companyId, seed);
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

      const entity = await this.ensureProduct(repo, companyId, category, seed);
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

      const entity = await this.ensureSubClass(
        repo,
        companyId,
        product.id,
        seed,
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

      const entity = await this.ensureRisk(repo, companyId, {
        productId: product.id,
        subClassId: subClass?.id ?? null,
        riskCode: seed.risk_code,
        riskName,
        description: seed.description,
      });

      map.set(seed.risk_code, entity);
    }

    return map;
  }

  private async ensureCategory(
    repo: Repository<InsuranceCategory>,
    companyId: string,
    seed: CategorySeed,
  ): Promise<InsuranceCategory> {
    const businessLine = this.resolveCategoryBusinessLine(seed);
    const existing = await repo.findOne({
      where: {
        company_id: companyId,
        code: seed.code,
      },
      withDeleted: true,
    });

    if (existing?.deleted_at) {
      throw new Error(
        `Category ${seed.code} exists but is soft-deleted. Restore manually or use a controlled migration.`,
      );
    }

    if (existing) {
      if (
        existing.name !== seed.name ||
        existing.description !== seed.description ||
        existing.business_line !== businessLine ||
        existing.is_active !== true
      ) {
        existing.name = seed.name;
        existing.description = seed.description;
        existing.business_line = businessLine;
        existing.is_active = true;
        return repo.save(existing);
      }
      return existing;
    }

    return repo.save(
      repo.create({
        company_id: companyId,
        code: seed.code,
        name: seed.name,
        description: seed.description,
        business_line: businessLine,
        is_active: true,
      }),
    );
  }

  private async ensureProduct(
    repo: Repository<InsuranceProduct>,
    companyId: string,
    category: InsuranceCategory,
    seed: ProductSeed,
  ): Promise<InsuranceProduct> {
    const businessLine = seed.business_line ?? category.business_line;
    const supportsFleet =
      seed.supports_fleet ??
      category.business_line === InsuranceBusinessLine.MOTOR;
    const tiramisProductCode = seed.tiramis_product_code ?? seed.product_code;
    const existing = await repo.findOne({
      where: {
        company_id: companyId,
        product_code: seed.product_code,
      },
      withDeleted: true,
    });

    if (existing?.deleted_at) {
      throw new Error(
        `Product ${seed.product_code} exists but is soft-deleted. Restore manually or use a controlled migration.`,
      );
    }

    if (existing) {
      if (
        existing.category_id !== category.id ||
        existing.product_name !== seed.product_name ||
        existing.description !== seed.description ||
        existing.business_line !== businessLine ||
        existing.supports_fleet !== supportsFleet ||
        existing.tiramis_product_code !== tiramisProductCode ||
        existing.is_active !== true
      ) {
        existing.category_id = category.id;
        existing.product_name = seed.product_name;
        existing.description = seed.description;
        existing.business_line = businessLine;
        existing.supports_fleet = supportsFleet;
        existing.tiramis_product_code = tiramisProductCode;
        existing.is_active = true;
        return repo.save(existing);
      }
      return existing;
    }

    return repo.save(
      repo.create({
        company_id: companyId,
        category_id: category.id,
        product_code: seed.product_code,
        product_name: seed.product_name,
        description: seed.description,
        business_line: businessLine,
        supports_fleet: supportsFleet,
        tiramis_product_code: tiramisProductCode,
        is_active: true,
      }),
    );
  }

  private resolveCategoryBusinessLine(
    seed: CategorySeed,
  ): InsuranceBusinessLine {
    if (seed.business_line) {
      return seed.business_line;
    }

    const normalizedCode = seed.code.trim().toUpperCase();
    const normalizedName = seed.name.trim().toUpperCase();

    if (normalizedCode === 'MOTOR' || normalizedName === 'MOTOR') {
      return InsuranceBusinessLine.MOTOR;
    }

    return InsuranceBusinessLine.NON_MOTOR;
  }

  private async ensureSubClass(
    repo: Repository<InsuranceSubClass>,
    companyId: string,
    productId: string,
    seed: SubClassSeed,
  ): Promise<InsuranceSubClass> {
    const existing = await repo.findOne({
      where: {
        company_id: companyId,
        product_id: productId,
        code: seed.code,
      },
      withDeleted: true,
    });

    if (existing?.deleted_at) {
      throw new Error(
        `Sub-class ${seed.product_code}/${seed.code} exists but is soft-deleted. Restore manually or use a controlled migration.`,
      );
    }

    if (existing) {
      return existing;
    }

    return repo.save(
      repo.create({
        company_id: companyId,
        product_id: productId,
        code: seed.code,
        name: seed.name,
        description: seed.description,
        is_active: true,
      }),
    );
  }

  private async ensureRisk(
    repo: Repository<InsuranceRisk>,
    companyId: string,
    seed: {
      productId: string;
      subClassId: string | null;
      riskCode: string;
      riskName: string;
      description: string | null;
    },
  ): Promise<InsuranceRisk> {
    const existing = await repo.findOne({
      where: {
        company_id: companyId,
        risk_code: seed.riskCode,
      },
      withDeleted: true,
    });

    if (existing?.deleted_at) {
      throw new Error(
        `Risk ${seed.riskCode} exists but is soft-deleted. Restore manually or use a controlled migration.`,
      );
    }

    if (existing) {
      return existing;
    }

    return repo.save(
      repo.create({
        company_id: companyId,
        product_id: seed.productId,
        sub_class_id: seed.subClassId,
        risk_code: seed.riskCode,
        risk_name: seed.riskName,
        description: seed.description,
        is_active: true,
      }),
    );
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

      const existing = await repo.findOne({
        where: {
          company_id: companyId,
          risk_id: risk.id,
          rule_name: seed.rule_name,
        },
        withDeleted: true,
      });

      if (existing?.deleted_at) {
        throw new Error(
          `Rule ${seed.rule_name} for risk ${seed.risk_code} exists but is soft-deleted. Restore manually or use a controlled migration.`,
        );
      }

      if (existing) {
        continue;
      }

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
    let percentageRate = this.normalizeRateValue(
      this.toNumber(seed.percentage_rate ?? seed.rate_value),
    );
    let fixedAmount = this.toNumber(seed.fixed_amount);
    let perUnitAmount = this.toNumber(seed.per_unit_amount);
    let perUnitFactorCode = normalizeFactorCode(
      seed.per_unit_factor_code ?? null,
    );
    let formula = seed.formula ?? null;

    const rateText = (seed.source_rate_text ?? seed.formula ?? '').trim();
    const invalidFormulaText = /^(n\/a|#value!)$/i.test(rateText);

    if (rateText) {
      const parsed = parseRateText(
        rateText,
        this.toNumber(seed.minimum_amount),
      );
      if (parsed) {
        rateType = parsed.rateType;
        percentageRate = parsed.percentageRate;
        fixedAmount = parsed.fixedAmount;
        perUnitAmount = parsed.perUnitAmount;
        perUnitFactorCode = parsed.perUnitFactorCode;
        formula = null;
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

  private toNumber(value: number | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private normalizeRateValue(value: number | null): number | null {
    if (value === null) {
      return null;
    }

    return value > 1 ? roundRate(value / 100) : roundRate(value);
  }
}
