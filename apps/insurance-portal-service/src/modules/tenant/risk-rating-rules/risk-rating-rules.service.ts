import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { SortDirection } from '@insurance-max/portal-shared/dto/pagination.dto';
import { RateType } from '@insurance-max/portal-shared/enums/rate-type.enum';
import {
  normalizeFractionalRate,
  roundMoney,
} from '@insurance-max/portal-shared/utils/pricing-calculation.util';
import { InsuranceRisk } from '../insurance-risks/entities/insurance-risk.entity';
import { isSupportedLegacyStructuredFormula } from '../pricing/infrastructure/legacy-structured-formula.util';
import { PricingRateBookStatus } from '../pricing-rate-books/enums/pricing-rate-book-status.enum';
import { PricingRateBook } from '../pricing-rate-books/entities/pricing-rate-book.entity';
import { CreateRiskRatingRuleDto } from './dto/create-risk-rating-rule.dto';
import { FilterRiskRatingRuleDto } from './dto/filter-risk-rating-rule.dto';
import { RiskRatingRuleConfigurationValidatorService } from './risk-rating-rule-configuration-validator.service';
import { UpdateRiskRatingRuleDto } from './dto/update-risk-rating-rule.dto';
import { RiskRatingRule } from './entities/risk-rating-rule.entity';
import { PricingRuntimeCacheService } from '../pricing/application/pricing-runtime-cache.service';

@Injectable()
export class RiskRatingRulesService {
  constructor(
    @InjectRepository(RiskRatingRule)
    private readonly ruleRepository: Repository<RiskRatingRule>,

    @InjectRepository(InsuranceRisk)
    private readonly riskRepository: Repository<InsuranceRisk>,

    @InjectRepository(PricingRateBook)
    private readonly rateBookRepository: Repository<PricingRateBook>,

    private readonly ruleConfigurationValidator: RiskRatingRuleConfigurationValidatorService,

    private readonly pricingRuntimeCacheService: PricingRuntimeCacheService,
  ) {}

  private normalizePercentageRate(
    value: number | null | undefined,
  ): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    try {
      return normalizeFractionalRate(value, 'percentage_rate');
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'percentage_rate is invalid',
      );
    }
  }

  private normalizeMoneyAmount(
    value: number | null | undefined,
  ): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestException('Monetary values must be non-negative');
    }

    return roundMoney(value);
  }

  private normalizePerUnitAmount(
    value: number | null | undefined,
  ): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestException('per_unit_amount must be non-negative');
    }

    return roundMoney(value);
  }

  private normalizeOptionalDate(
    value: string | null | undefined,
    field: string,
  ): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      throw new BadRequestException(`${field} must be a valid ISO date`);
    }

    return value.slice(0, 10);
  }

  private validateAdjustmentControlWindow(
    effectiveFrom: string | null,
    effectiveTo: string | null,
  ) {
    if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException(
        'adjustment_effective_to must be on or after adjustment_effective_from',
      );
    }
  }

  private validateThresholdNotAboveLimit(
    threshold: number | null,
    limit: number | null,
    thresholdField: string,
    limitField: string,
  ) {
    if (
      threshold !== null &&
      limit !== null &&
      Number.isFinite(threshold) &&
      Number.isFinite(limit) &&
      threshold > limit
    ) {
      throw new BadRequestException(
        `${thresholdField} cannot be greater than ${limitField}`,
      );
    }
  }

  private validateAdjustmentControls(
    payload: Pick<
      RiskRatingRule,
      | 'max_discount_rate'
      | 'max_discount_amount'
      | 'discount_approval_threshold_rate'
      | 'discount_approval_threshold_amount'
      | 'max_loading_rate'
      | 'max_loading_amount'
      | 'loading_approval_threshold_rate'
      | 'loading_approval_threshold_amount'
      | 'adjustment_effective_from'
      | 'adjustment_effective_to'
    >,
  ) {
    this.validateAdjustmentControlWindow(
      payload.adjustment_effective_from,
      payload.adjustment_effective_to,
    );
    this.validateThresholdNotAboveLimit(
      payload.discount_approval_threshold_rate,
      payload.max_discount_rate,
      'discount_approval_threshold_rate',
      'max_discount_rate',
    );
    this.validateThresholdNotAboveLimit(
      payload.discount_approval_threshold_amount,
      payload.max_discount_amount,
      'discount_approval_threshold_amount',
      'max_discount_amount',
    );
    this.validateThresholdNotAboveLimit(
      payload.loading_approval_threshold_rate,
      payload.max_loading_rate,
      'loading_approval_threshold_rate',
      'max_loading_rate',
    );
    this.validateThresholdNotAboveLimit(
      payload.loading_approval_threshold_amount,
      payload.max_loading_amount,
      'loading_approval_threshold_amount',
      'max_loading_amount',
    );
  }

  private isDuplicateEntryError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const driverError = (
      error as QueryFailedError & { driverError?: { code?: string | number } }
    ).driverError;
    return (
      driverError?.code === '23505' ||
      String(driverError?.code ?? '') === '1062'
    );
  }

  private validateStructuredRateFields(
    payload: Pick<
      RiskRatingRule,
      | 'rate_type'
      | 'percentage_rate'
      | 'fixed_amount'
      | 'per_unit_amount'
      | 'per_unit_factor_code'
      | 'formula'
    >,
  ): void {
    const hasPercentageRate =
      payload.percentage_rate !== null && payload.percentage_rate !== undefined;
    const hasFixedAmount =
      payload.fixed_amount !== null && payload.fixed_amount !== undefined;
    const hasPerUnitAmount =
      payload.per_unit_amount !== null && payload.per_unit_amount !== undefined;
    const hasPerUnitFactor = !!payload.per_unit_factor_code?.trim();
    const hasFormula = !!payload.formula?.trim();

    switch (payload.rate_type) {
      case RateType.PERCENTAGE:
        if (!hasPercentageRate) {
          throw new BadRequestException(
            'percentage_rate is required for PERCENTAGE rate type',
          );
        }
        break;
      case RateType.FIXED:
        if (!hasFixedAmount) {
          throw new BadRequestException(
            'fixed_amount is required for FIXED rate type',
          );
        }
        break;
      case RateType.PERCENTAGE_PLUS_FIXED:
        if (!hasPercentageRate || !hasFixedAmount) {
          throw new BadRequestException(
            'percentage_rate and fixed_amount are required for PERCENTAGE_PLUS_FIXED rate type',
          );
        }
        break;
      case RateType.PERCENTAGE_PLUS_PER_UNIT:
        if (!hasPercentageRate || !hasPerUnitAmount || !hasPerUnitFactor) {
          throw new BadRequestException(
            'percentage_rate, per_unit_amount, and per_unit_factor_code are required for PERCENTAGE_PLUS_PER_UNIT rate type',
          );
        }
        break;
      case RateType.PER_UNIT:
        if (!hasPerUnitAmount || !hasPerUnitFactor) {
          throw new BadRequestException(
            'per_unit_amount and per_unit_factor_code are required for PER_UNIT rate type',
          );
        }
        break;
      case RateType.FORMULA:
        if (!hasFormula) {
          throw new BadRequestException(
            'formula is required for FORMULA rate type',
          );
        }
        if (!isSupportedLegacyStructuredFormula(payload.formula)) {
          throw new BadRequestException(
            'FORMULA rate type only supports legacy structured shorthand such as "2% + 200,000", "15,000 per seat", or "5.5% + 15,000 per seat"',
          );
        }
        break;
      default:
        throw new BadRequestException('Unsupported rate_type');
    }
  }

  async requireRule(companyId: string, id: string): Promise<RiskRatingRule> {
    const rule = await this.ruleRepository.findOne({
      where: { id, company_id: companyId },
      relations: { risk: true, rate_book: true },
    });
    if (!rule) throw new NotFoundException('Risk rating rule not found');
    return rule;
  }

  private async resolveEditableRateBook(
    companyId: string,
    rateBookId: string | null | undefined,
    productId: string,
  ): Promise<PricingRateBook | null> {
    if (!rateBookId) {
      return null;
    }

    const rateBook = await this.rateBookRepository.findOne({
      where: { id: rateBookId, company_id: companyId },
    });
    if (!rateBook) {
      throw new BadRequestException(
        'Pricing rate book not found or does not belong to this company',
      );
    }
    if (rateBook.product_id !== productId) {
      throw new BadRequestException(
        'The selected pricing rate book belongs to a different product',
      );
    }
    if (
      ![PricingRateBookStatus.DRAFT, PricingRateBookStatus.REJECTED].includes(
        rateBook.status,
      )
    ) {
      throw new ConflictException(
        `Rules can only be changed inside DRAFT or REJECTED rate books. Current status: ${rateBook.status}`,
      );
    }
    return rateBook;
  }

  async findActiveRulesForRisk(
    companyId: string,
    riskId: string,
  ): Promise<RiskRatingRule[]> {
    return this.ruleRepository.find({
      where: { company_id: companyId, risk_id: riskId, is_active: true },
      relations: { conditions: true },
      order: { priority: 'ASC' },
    });
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────────

  async create(
    companyId: string,
    dto: CreateRiskRatingRuleDto,
    userId: string,
  ): Promise<RiskRatingRule> {
    const risk = await this.riskRepository.findOne({
      where: { id: dto.risk_id, company_id: companyId },
    });
    if (!risk)
      throw new BadRequestException(
        'Risk not found or does not belong to this company',
      );
    const rateBook = await this.resolveEditableRateBook(
      companyId,
      dto.rate_book_id,
      risk.product_id,
    );

    const normalizedPerUnitFactorCode =
      dto.per_unit_factor_code?.trim().toLowerCase() ?? null;
    const rule = this.ruleRepository.create({
      company_id: companyId,
      risk_id: dto.risk_id,
      rate_book_id: rateBook?.id ?? null,
      rule_name: dto.rule_name.trim(),
      rate_type: dto.rate_type,
      percentage_rate: this.normalizePercentageRate(dto.percentage_rate),
      fixed_amount: this.normalizeMoneyAmount(dto.fixed_amount),
      per_unit_amount: this.normalizePerUnitAmount(dto.per_unit_amount),
      per_unit_factor_code: normalizedPerUnitFactorCode,
      minimum_amount: this.normalizeMoneyAmount(dto.minimum_amount),
      maximum_amount: this.normalizeMoneyAmount(dto.maximum_amount),
      max_discount_rate: this.normalizePercentageRate(dto.max_discount_rate),
      max_discount_amount: this.normalizeMoneyAmount(dto.max_discount_amount),
      discount_approval_threshold_rate: this.normalizePercentageRate(
        dto.discount_approval_threshold_rate,
      ),
      discount_approval_threshold_amount: this.normalizeMoneyAmount(
        dto.discount_approval_threshold_amount,
      ),
      max_loading_rate: this.normalizePercentageRate(dto.max_loading_rate),
      max_loading_amount: this.normalizeMoneyAmount(dto.max_loading_amount),
      loading_approval_threshold_rate: this.normalizePercentageRate(
        dto.loading_approval_threshold_rate,
      ),
      loading_approval_threshold_amount: this.normalizeMoneyAmount(
        dto.loading_approval_threshold_amount,
      ),
      adjustment_effective_from: this.normalizeOptionalDate(
        dto.adjustment_effective_from,
        'adjustment_effective_from',
      ),
      adjustment_effective_to: this.normalizeOptionalDate(
        dto.adjustment_effective_to,
        'adjustment_effective_to',
      ),
      formula: dto.formula ?? null,
      priority: dto.priority ?? 1,
      rule_version: 1,
      is_active: dto.is_active ?? true,
      created_by: userId,
      updated_by: userId,
    });
    if (dto.rate_type === RateType.FORMULA) {
      throw new BadRequestException(
        'New FORMULA rate rules are not permitted. Use a structured calculation type (PERCENTAGE, FIXED, PER_UNIT, PERCENTAGE_PLUS_FIXED, or PERCENTAGE_PLUS_PER_UNIT).',
      );
    }
    this.validateStructuredRateFields(rule);
    this.validateAdjustmentControls(rule);
    await this.ruleConfigurationValidator.assertRuleCanBeSaved(companyId, rule);

    try {
      const saved = await this.ruleRepository.save(rule);
      await this.pricingRuntimeCacheService.invalidateRateConfiguration(
        companyId,
      );
      return saved;
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          `A rule named "${dto.rule_name.trim()}" already exists for this risk`,
        );
      }
      throw error;
    }
  }

  async findAll(companyId: string, query: FilterRiskRatingRuleDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'priority',
      sortOrder = SortDirection.ASC,
      search,
      risk_id,
      rate_book_id,
      rate_type,
      is_active,
    } = query;

    const allowedSortFields = [
      'rule_name',
      'rate_type',
      'priority',
      'is_active',
      'created_at',
    ];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'priority';
    const direction = sortOrder === SortDirection.ASC ? 'ASC' : 'DESC';

    const qb = this.ruleRepository
      .createQueryBuilder('rule')
      .leftJoinAndSelect('rule.risk', 'risk')
      .where('rule.company_id = :companyId', { companyId })
      .orderBy(`rule.${safeSortBy}`, direction)
      .addOrderBy('rule.id', direction);

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      qb.andWhere('rule.rule_name ILIKE :term', { term });
    }

    if (risk_id) qb.andWhere('rule.risk_id = :risk_id', { risk_id });
    if (rate_book_id)
      qb.andWhere('rule.rate_book_id = :rate_book_id', { rate_book_id });
    if (rate_type) qb.andWhere('rule.rate_type = :rate_type', { rate_type });
    if (is_active !== undefined)
      qb.andWhere('rule.is_active = :is_active', { is_active });

    const skip = (page - 1) * limit;
    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data: items,
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(companyId: string, id: string): Promise<RiskRatingRule> {
    const rule = await this.ruleRepository.findOne({
      where: { id, company_id: companyId },
      relations: { risk: true, conditions: true },
    });
    if (!rule) throw new NotFoundException('Risk rating rule not found');
    return rule;
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdateRiskRatingRuleDto,
    userId: string,
  ): Promise<RiskRatingRule> {
    const rule = await this.requireRule(companyId, id);
    await this.resolveEditableRateBook(
      companyId,
      rule.rate_book_id,
      rule.risk.product_id,
    );

    if (dto.rule_name !== undefined) rule.rule_name = dto.rule_name.trim();
    if (dto.rate_type !== undefined) rule.rate_type = dto.rate_type;
    if (dto.percentage_rate !== undefined)
      rule.percentage_rate = this.normalizePercentageRate(dto.percentage_rate);
    if (dto.fixed_amount !== undefined)
      rule.fixed_amount = this.normalizeMoneyAmount(dto.fixed_amount);
    if (dto.per_unit_amount !== undefined)
      rule.per_unit_amount = this.normalizePerUnitAmount(dto.per_unit_amount);
    if (dto.per_unit_factor_code !== undefined) {
      rule.per_unit_factor_code =
        dto.per_unit_factor_code?.trim().toLowerCase() ?? null;
    }
    if (dto.minimum_amount !== undefined)
      rule.minimum_amount = this.normalizeMoneyAmount(dto.minimum_amount);
    if (dto.maximum_amount !== undefined)
      rule.maximum_amount = this.normalizeMoneyAmount(dto.maximum_amount);
    if (dto.max_discount_rate !== undefined)
      rule.max_discount_rate = this.normalizePercentageRate(
        dto.max_discount_rate,
      );
    if (dto.max_discount_amount !== undefined)
      rule.max_discount_amount = this.normalizeMoneyAmount(
        dto.max_discount_amount,
      );
    if (dto.discount_approval_threshold_rate !== undefined)
      rule.discount_approval_threshold_rate = this.normalizePercentageRate(
        dto.discount_approval_threshold_rate,
      );
    if (dto.discount_approval_threshold_amount !== undefined)
      rule.discount_approval_threshold_amount = this.normalizeMoneyAmount(
        dto.discount_approval_threshold_amount,
      );
    if (dto.max_loading_rate !== undefined)
      rule.max_loading_rate = this.normalizePercentageRate(
        dto.max_loading_rate,
      );
    if (dto.max_loading_amount !== undefined)
      rule.max_loading_amount = this.normalizeMoneyAmount(
        dto.max_loading_amount,
      );
    if (dto.loading_approval_threshold_rate !== undefined)
      rule.loading_approval_threshold_rate = this.normalizePercentageRate(
        dto.loading_approval_threshold_rate,
      );
    if (dto.loading_approval_threshold_amount !== undefined)
      rule.loading_approval_threshold_amount = this.normalizeMoneyAmount(
        dto.loading_approval_threshold_amount,
      );
    if (dto.adjustment_effective_from !== undefined)
      rule.adjustment_effective_from = this.normalizeOptionalDate(
        dto.adjustment_effective_from,
        'adjustment_effective_from',
      );
    if (dto.adjustment_effective_to !== undefined)
      rule.adjustment_effective_to = this.normalizeOptionalDate(
        dto.adjustment_effective_to,
        'adjustment_effective_to',
      );
    if (dto.formula !== undefined) rule.formula = dto.formula ?? null;
    if (dto.priority !== undefined) rule.priority = dto.priority;
    if (dto.is_active !== undefined) rule.is_active = dto.is_active;
    rule.updated_by = userId;
    this.validateStructuredRateFields(rule);
    this.validateAdjustmentControls(rule);
    await this.ruleConfigurationValidator.assertRuleCanBeSaved(companyId, rule);

    try {
      const saved = await this.ruleRepository.save(rule);
      await this.pricingRuntimeCacheService.invalidateRateConfiguration(
        companyId,
      );
      return saved;
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          'A rule with this name already exists for this risk',
        );
      }
      throw error;
    }
  }

  async remove(companyId: string, id: string): Promise<void> {
    const rule = await this.requireRule(companyId, id);
    await this.resolveEditableRateBook(
      companyId,
      rule.rate_book_id,
      rule.risk.product_id,
    );
    await this.ruleRepository.softDelete(rule.id);
    await this.pricingRuntimeCacheService.invalidateRateConfiguration(
      companyId,
    );
  }
}
