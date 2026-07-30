import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DataSource, In, Repository } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { RateType } from '@insurance-max/portal-shared/enums/rate-type.enum';
import { Company } from '../../modules/platform/companies/entities/company.entity';
import { InsuranceProduct } from '../../modules/tenant/insurance-products/entities/insurance-product.entity';
import { InsuranceRisk } from '../../modules/tenant/insurance-risks/entities/insurance-risk.entity';
import {
  MOTOR_PRODUCT_CODES,
  MOTOR_RATE_BOOK_VERSION,
  resolveMotorRateBookCode,
} from '../../modules/tenant/pricing/domain/motor-rating.config';
import { PricingRateBook } from '../../modules/tenant/pricing-rate-books/entities/pricing-rate-book.entity';
import { PricingRateBookStatus } from '../../modules/tenant/pricing-rate-books/enums/pricing-rate-book-status.enum';
import { RiskRatingRule } from '../../modules/tenant/risk-rating-rules/entities/risk-rating-rule.entity';
import { normalizeFactorCode, parseRateText } from './rate-text-parser';

type RiskSeed = {
  product_code: string;
  risk_code: string;
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
const RATE_BOOK_EFFECTIVE_FROM = '2026-01-01';

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
    `[MotorPricingSeeder] Seed data file "${SEED_DATA_FILE_NAME}" was not found. Checked: ${candidates.join(', ')}`,
  );
}

function loadSeedPayload(): ProductEngineSeedPayload {
  const filePath = resolveSeedDataFilePath();
  const raw = readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw) as ProductEngineSeedPayload;

  return {
    risks: parsed.risks ?? [],
    rules: parsed.rules ?? [],
  };
}

const seedPayload = loadSeedPayload();

export default class MotorPricingSeeder implements Seeder {
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
      const productRepo = manager.getRepository(InsuranceProduct);
      const riskRepo = manager.getRepository(InsuranceRisk);
      const rateBookRepo = manager.getRepository(PricingRateBook);
      const ruleRepo = manager.getRepository(RiskRatingRule);
      const company = await this.getTargetCompany(companyRepo);

      const synchronizedRules = await this.seedMotorPricing(
        company.id,
        productRepo,
        riskRepo,
        rateBookRepo,
        ruleRepo,
      );

      console.log(
        `[MotorPricingSeeder] Synchronized ${synchronizedRules} Motor pricing rules for ${company.name} (${company.id})`,
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('[MotorPricingSeeder] Seeding failed:', error);
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

  private async seedMotorPricing(
    companyId: string,
    productRepo: Repository<InsuranceProduct>,
    riskRepo: Repository<InsuranceRisk>,
    rateBookRepo: Repository<PricingRateBook>,
    ruleRepo: Repository<RiskRatingRule>,
  ): Promise<number> {
    const products = await productRepo.find({
      where: {
        company_id: companyId,
        product_code: In([...MOTOR_PRODUCT_CODES]),
      },
    });
    if (products.length === 0) {
      return 0;
    }

    const productsByCode = new Map(
      products.map((product) => [product.product_code, product]),
    );
    const risks = await riskRepo.find({
      where: {
        company_id: companyId,
        product_id: In(products.map((product) => product.id)),
      },
    });
    const risksByCode = new Map(risks.map((risk) => [risk.risk_code, risk]));

    const rateBooksByProductCode = new Map<string, PricingRateBook>();
    for (const product of products) {
      const rateBookCode = resolveMotorRateBookCode(product.product_code);
      const existing = await rateBookRepo.findOne({
        where: {
          company_id: companyId,
          code: rateBookCode,
          version: MOTOR_RATE_BOOK_VERSION,
        },
        withDeleted: true,
      });

      const rateBook =
        existing ??
        rateBookRepo.create({
          company_id: companyId,
          product_id: product.id,
          code: rateBookCode,
          version: MOTOR_RATE_BOOK_VERSION,
        });

      rateBook.company_id = companyId;
      rateBook.product_id = product.id;
      rateBook.code = rateBookCode;
      rateBook.version = MOTOR_RATE_BOOK_VERSION;
      rateBook.name = `${product.product_name} Tariff ${MOTOR_RATE_BOOK_VERSION}`;
      rateBook.currency_code = 'TZS';
      rateBook.status = PricingRateBookStatus.PUBLISHED;
      rateBook.effective_from = RATE_BOOK_EFFECTIVE_FROM;
      rateBook.effective_to = null;
      rateBook.published_at = new Date(
        `${RATE_BOOK_EFFECTIVE_FROM}T00:00:00.000Z`,
      );
      rateBook.deleted_at = null;

      const savedRateBook = await rateBookRepo.save(rateBook);
      rateBooksByProductCode.set(product.product_code, savedRateBook);
    }

    const otherMotorRateBooks = await rateBookRepo.find({
      where: {
        company_id: companyId,
        product_id: In(products.map((product) => product.id)),
      },
    });
    const activeRateBookIds = new Set(
      Array.from(rateBooksByProductCode.values()).map((rateBook) => rateBook.id),
    );
    for (const rateBook of otherMotorRateBooks) {
      if (activeRateBookIds.has(rateBook.id)) {
        continue;
      }

      if (rateBook.status !== PricingRateBookStatus.RETIRED) {
        rateBook.status = PricingRateBookStatus.RETIRED;
        await rateBookRepo.save(rateBook);
      }
    }

    const seedRiskByCode = new Map(
      seedPayload.risks
        .filter((risk) =>
          MOTOR_PRODUCT_CODES.includes(
            risk.product_code as (typeof MOTOR_PRODUCT_CODES)[number],
          ),
        )
        .map((risk) => [risk.risk_code, risk]),
    );

    const desiredRuleIds = new Set<string>();
    let synchronizedRules = 0;

    for (const seed of seedPayload.rules) {
      const seedRisk = seedRiskByCode.get(seed.risk_code);
      if (!seedRisk) {
        continue;
      }

      const risk = risksByCode.get(seed.risk_code);
      const product = productsByCode.get(seedRisk.product_code);
      const rateBook = product
        ? rateBooksByProductCode.get(product.product_code)
        : null;
      if (!risk || !product || !rateBook) {
        continue;
      }

      const fallbackRateType = Object.values(RateType).includes(
        seed.rate_type as RateType,
      )
        ? (seed.rate_type as RateType)
        : RateType.FORMULA;
      const normalizedRule = this.normalizeRuleSeed(seed, fallbackRateType);

      const existing = await ruleRepo.findOne({
        where: {
          company_id: companyId,
          risk_id: risk.id,
          rate_book_id: rateBook.id,
          rule_name: seed.rule_name,
        },
        withDeleted: true,
      });

      const rule =
        existing ??
        ruleRepo.create({
          company_id: companyId,
          risk_id: risk.id,
          rate_book_id: rateBook.id,
          rule_name: seed.rule_name,
        });

      rule.company_id = companyId;
      rule.risk_id = risk.id;
      rule.rate_book_id = rateBook.id;
      rule.rule_name = seed.rule_name;
      rule.rate_type = normalizedRule.rate_type;
      rule.percentage_rate = normalizedRule.percentage_rate;
      rule.fixed_amount = normalizedRule.fixed_amount;
      rule.per_unit_amount = normalizedRule.per_unit_amount;
      rule.per_unit_factor_code = normalizedRule.per_unit_factor_code;
      rule.formula = normalizedRule.formula;
      rule.minimum_amount = seed.minimum_amount ?? null;
      rule.priority = seed.priority;
      rule.rule_version = 1;
      rule.is_active = true;
      rule.deleted_at = null;

      const savedRule = await ruleRepo.save(rule);
      desiredRuleIds.add(savedRule.id);
      synchronizedRules += 1;
    }

    const existingMotorRules = await ruleRepo.find({
      where: {
        company_id: companyId,
        risk_id: In(risks.map((risk) => risk.id)),
      },
    });
    for (const rule of existingMotorRules) {
      const shouldBeActive = desiredRuleIds.has(rule.id);
      if (rule.is_active !== shouldBeActive) {
        rule.is_active = shouldBeActive;
        await ruleRepo.save(rule);
      }
    }

    return synchronizedRules;
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

    return Number.isFinite(Number(value)) ? Number(value) : null;
  }

  private normalizeRateValue(value: number | null): number | null {
    if (value === null) {
      return null;
    }

    return Number(value.toFixed(10));
  }
}
