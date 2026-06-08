import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { LogicalOperator } from '@insurance-max/portal-shared/enums/logical-operator.enum';
import { RiskRatingRule } from '../risk-rating-rules/entities/risk-rating-rule.entity';
import { CreateRiskRuleConditionDto } from './dto/create-risk-rule-condition.dto';
import { UpdateRiskRuleConditionDto } from './dto/update-risk-rule-condition.dto';
import { RiskRuleCondition } from './entities/risk-rule-condition.entity';

@Injectable()
export class RiskRuleConditionsService {
  constructor(
    @InjectRepository(RiskRuleCondition)
    private readonly conditionRepository: Repository<RiskRuleCondition>,

    @InjectRepository(RiskRatingRule)
    private readonly ruleRepository: Repository<RiskRatingRule>,
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

  async create(
    companyId: string,
    dto: CreateRiskRuleConditionDto,
    userId: string,
  ): Promise<RiskRuleCondition> {
    const rule = await this.ruleRepository.findOne({
      where: { id: dto.rule_id, company_id: companyId },
    });
    if (!rule)
      throw new BadRequestException(
        'Rating rule not found or does not belong to this company',
      );

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

    try {
      return await this.conditionRepository.save(condition);
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

    if (dto.factor_code !== undefined)
      condition.factor_code = dto.factor_code.trim().toLowerCase();
    if (dto.operator !== undefined) condition.operator = dto.operator;
    if (dto.value_from !== undefined)
      condition.value_from = dto.value_from ?? null;
    if (dto.value_to !== undefined) condition.value_to = dto.value_to ?? null;
    if (dto.logical_operator !== undefined)
      condition.logical_operator = dto.logical_operator;
    condition.updated_by = userId;

    try {
      return await this.conditionRepository.save(condition);
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
    await this.conditionRepository.delete(condition.id);
  }
}
