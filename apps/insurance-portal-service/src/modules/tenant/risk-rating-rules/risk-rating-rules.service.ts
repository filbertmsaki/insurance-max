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
import { InsuranceRisk } from '../insurance-risks/entities/insurance-risk.entity';
import { CreateRiskRatingRuleDto } from './dto/create-risk-rating-rule.dto';
import { FilterRiskRatingRuleDto } from './dto/filter-risk-rating-rule.dto';
import { UpdateRiskRatingRuleDto } from './dto/update-risk-rating-rule.dto';
import { RiskRatingRule } from './entities/risk-rating-rule.entity';

@Injectable()
export class RiskRatingRulesService {
  constructor(
    @InjectRepository(RiskRatingRule)
    private readonly ruleRepository: Repository<RiskRatingRule>,

    @InjectRepository(InsuranceRisk)
    private readonly riskRepository: Repository<InsuranceRisk>,
  ) {}

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
        break;
      default:
        throw new BadRequestException('Unsupported rate_type');
    }
  }

  async requireRule(companyId: string, id: string): Promise<RiskRatingRule> {
    const rule = await this.ruleRepository.findOne({
      where: { id, company_id: companyId },
    });
    if (!rule) throw new NotFoundException('Risk rating rule not found');
    return rule;
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

    const normalizedPerUnitFactorCode =
      dto.per_unit_factor_code?.trim().toLowerCase() ?? null;
    const rule = this.ruleRepository.create({
      company_id: companyId,
      risk_id: dto.risk_id,
      rule_name: dto.rule_name.trim(),
      rate_type: dto.rate_type,
      percentage_rate: dto.percentage_rate ?? null,
      fixed_amount: dto.fixed_amount ?? null,
      per_unit_amount: dto.per_unit_amount ?? null,
      per_unit_factor_code: normalizedPerUnitFactorCode,
      minimum_amount: dto.minimum_amount ?? null,
      formula: dto.formula ?? null,
      priority: dto.priority ?? 1,
      is_active: dto.is_active ?? true,
      created_by: userId,
      updated_by: userId,
    });
    this.validateStructuredRateFields(rule);

    try {
      return await this.ruleRepository.save(rule);
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
      .orderBy(`rule.${safeSortBy}`, direction);

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      qb.andWhere('rule.rule_name ILIKE :term', { term });
    }

    if (risk_id) qb.andWhere('rule.risk_id = :risk_id', { risk_id });
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

    if (dto.rule_name !== undefined) rule.rule_name = dto.rule_name.trim();
    if (dto.rate_type !== undefined) rule.rate_type = dto.rate_type;
    if (dto.percentage_rate !== undefined)
      rule.percentage_rate = dto.percentage_rate ?? null;
    if (dto.fixed_amount !== undefined)
      rule.fixed_amount = dto.fixed_amount ?? null;
    if (dto.per_unit_amount !== undefined)
      rule.per_unit_amount = dto.per_unit_amount ?? null;
    if (dto.per_unit_factor_code !== undefined) {
      rule.per_unit_factor_code =
        dto.per_unit_factor_code?.trim().toLowerCase() ?? null;
    }
    if (dto.minimum_amount !== undefined)
      rule.minimum_amount = dto.minimum_amount ?? null;
    if (dto.formula !== undefined) rule.formula = dto.formula ?? null;
    if (dto.priority !== undefined) rule.priority = dto.priority;
    if (dto.is_active !== undefined) rule.is_active = dto.is_active;
    rule.updated_by = userId;
    this.validateStructuredRateFields(rule);

    try {
      return await this.ruleRepository.save(rule);
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
    await this.ruleRepository.softDelete(rule.id);
  }
}
