import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { LogicalOperator } from '@insurance-max/portal-shared/enums/logical-operator.enum';
import { PricingRateBookStatus } from '../pricing-rate-books/enums/pricing-rate-book-status.enum';
import { RiskRatingRuleConfigurationValidatorService } from '../risk-rating-rules/risk-rating-rule-configuration-validator.service';
import { RiskRatingRule } from '../risk-rating-rules/entities/risk-rating-rule.entity';
import { CreateRiskRuleConditionDto } from './dto/create-risk-rule-condition.dto';
import { UpdateRiskRuleConditionDto } from './dto/update-risk-rule-condition.dto';
import { RiskRuleCondition } from './entities/risk-rule-condition.entity';
import { PricingRuntimeCacheService } from '../pricing/application/pricing-runtime-cache.service';

@Injectable()
export class RiskRuleConditionsService {
  constructor(
    @InjectRepository(RiskRuleCondition)
    private readonly conditionRepository: Repository<RiskRuleCondition>,

    @InjectRepository(RiskRatingRule)
    private readonly ruleRepository: Repository<RiskRatingRule>,

    private readonly ruleConfigurationValidator: RiskRatingRuleConfigurationValidatorService,

    private readonly pricingRuntimeCacheService: PricingRuntimeCacheService,
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

  private async recomputeSpecificityScore(ruleId: string): Promise<void> {
    const conditionCount = await this.conditionRepository.count({
      where: { rule_id: ruleId },
    });
    await this.ruleRepository.update(ruleId, {
      specificity_score: conditionCount,
    });
  }

  async create(
    companyId: string,
    dto: CreateRiskRuleConditionDto,
    userId: string,
  ): Promise<RiskRuleCondition> {
    const rule = await this.ruleRepository.findOne({
      where: { id: dto.rule_id, company_id: companyId },
      relations: { rate_book: true },
    });
    if (!rule)
      throw new BadRequestException(
        'Rating rule not found or does not belong to this company',
      );
    this.assertParentRuleEditable(rule);

    const condition = this.conditionRepository.create({
      company_id: companyId,
      rule_id: dto.rule_id,
      factor_code: dto.factor_code.trim().toLowerCase(),
      operator: dto.operator,
      value_from: dto.value_from ?? null,
      value_to: dto.value_to ?? null,
      logical_operator: dto.logical_operator ?? LogicalOperator.AND,
      created_by: userId,
      updated_by: userId,
    });
    await this.ruleConfigurationValidator.assertConditionCanBeCreated(
      companyId,
      rule,
      condition,
    );

    try {
      const saved = await this.conditionRepository.save(condition);
      await this.recomputeSpecificityScore(dto.rule_id);
      await this.pricingRuntimeCacheService.invalidateRateConfiguration(
        companyId,
      );
      return saved;
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          'An identical condition already exists for this rule',
        );
      }
      throw error;
    }
  }

  async findByRule(
    companyId: string,
    ruleId: string,
  ): Promise<RiskRuleCondition[]> {
    const rule = await this.ruleRepository.findOne({
      where: { id: ruleId, company_id: companyId },
    });
    if (!rule) throw new NotFoundException('Rating rule not found');

    return this.conditionRepository.find({
      where: { rule_id: ruleId, company_id: companyId },
      order: { created_at: 'ASC' },
    });
  }

  async findOne(companyId: string, id: string): Promise<RiskRuleCondition> {
    const condition = await this.conditionRepository.findOne({
      where: { id, company_id: companyId },
    });
    if (!condition) throw new NotFoundException('Condition not found');
    return condition;
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdateRiskRuleConditionDto,
    userId: string,
  ): Promise<RiskRuleCondition> {
    const condition = await this.findOne(companyId, id);
    const rule = await this.ruleRepository.findOne({
      where: { id: condition.rule_id, company_id: companyId },
      relations: { rate_book: true },
    });
    if (!rule) {
      throw new NotFoundException('Rating rule not found');
    }
    this.assertParentRuleEditable(rule);

    if (dto.factor_code !== undefined)
      condition.factor_code = dto.factor_code.trim().toLowerCase();
    if (dto.operator !== undefined) condition.operator = dto.operator;
    if (dto.value_from !== undefined)
      condition.value_from = dto.value_from ?? null;
    if (dto.value_to !== undefined) condition.value_to = dto.value_to ?? null;
    if (dto.logical_operator !== undefined)
      condition.logical_operator = dto.logical_operator;
    condition.updated_by = userId;
    await this.ruleConfigurationValidator.assertConditionCanBeUpdated(
      companyId,
      rule,
      condition.id,
      condition,
    );

    try {
      const saved = await this.conditionRepository.save(condition);
      await this.recomputeSpecificityScore(condition.rule_id);
      await this.pricingRuntimeCacheService.invalidateRateConfiguration(
        companyId,
      );
      return saved;
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException(
          'An identical condition already exists for this rule',
        );
      }
      throw error;
    }
  }

  async remove(companyId: string, id: string): Promise<void> {
    const condition = await this.findOne(companyId, id);
    const rule = await this.ruleRepository.findOne({
      where: { id: condition.rule_id, company_id: companyId },
      relations: { rate_book: true },
    });
    if (!rule) {
      throw new NotFoundException('Rating rule not found');
    }
    this.assertParentRuleEditable(rule);
    await this.ruleConfigurationValidator.assertConditionCanBeRemoved(
      companyId,
      rule,
      condition.id,
    );
    await this.conditionRepository.delete(condition.id);
    await this.recomputeSpecificityScore(condition.rule_id);
    await this.pricingRuntimeCacheService.invalidateRateConfiguration(
      companyId,
    );
  }

  private assertParentRuleEditable(rule: RiskRatingRule) {
    if (!rule.rate_book) {
      return;
    }
    if (
      ![PricingRateBookStatus.DRAFT, PricingRateBookStatus.REJECTED].includes(
        rule.rate_book.status,
      )
    ) {
      throw new ConflictException(
        `Conditions cannot be edited because the parent rate book is ${rule.rate_book.status}`,
      );
    }
  }
}
