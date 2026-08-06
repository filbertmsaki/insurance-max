import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { RateType } from '@insurance-max/portal-shared/enums/rate-type.enum';
import { RiskRatingRule } from '../risk-rating-rules/entities/risk-rating-rule.entity';
import { PricingRateBook } from './entities/pricing-rate-book.entity';

export interface RateBookReviewValidationResult {
  valid: true;
  riskCount: number;
}

/**
 * Validates that a pricing rate book is complete enough to progress through
 * its review/approval/publish lifecycle. Used both when a book is submitted
 * for review and again (defense in depth) right before it is published, in
 * case it was edited in between.
 */
@Injectable()
export class PricingRateBookValidationService {
  constructor(
    @InjectRepository(RiskRatingRule)
    private readonly ruleRepository: Repository<RiskRatingRule>,
  ) {}

  async validateForReview(
    rateBook: PricingRateBook,
    manager?: EntityManager,
  ): Promise<RateBookReviewValidationResult> {
    const ruleRepository = manager
      ? manager.getRepository(RiskRatingRule)
      : this.ruleRepository;

    const activeRiskRows = await ruleRepository
      .createQueryBuilder('rule')
      .select('DISTINCT rule.risk_id', 'risk_id')
      .where('rule.company_id = :companyId', {
        companyId: rateBook.company_id,
      })
      .andWhere('rule.rate_book_id = :rateBookId', { rateBookId: rateBook.id })
      .andWhere('rule.is_active = true')
      .andWhere('rule.deleted_at IS NULL')
      .getRawMany<{ risk_id: string }>();

    if (activeRiskRows.length === 0) {
      throw new BadRequestException({
        code: 'RATE_BOOK_INCOMPLETE',
        message: 'The rate book is incomplete.',
        details: { missing: ['rating_rules'] },
      });
    }

    const formulaRules = await ruleRepository
      .createQueryBuilder('rule')
      .where('rule.company_id = :companyId', {
        companyId: rateBook.company_id,
      })
      .andWhere('rule.rate_book_id = :rateBookId', { rateBookId: rateBook.id })
      .andWhere('rule.is_active = true')
      .andWhere('rule.deleted_at IS NULL')
      .andWhere('rule.rate_type = :rateType', { rateType: RateType.FORMULA })
      .getMany();

    if (formulaRules.length > 0) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_FORMULA_RULES',
        message: 'The rate book contains unsupported formula rules.',
        details: {
          rules: formulaRules.map((rule) => ({
            id: rule.id,
            ruleName: rule.rule_name,
            riskId: rule.risk_id,
          })),
        },
      });
    }

    const rulesMissingFactors = await ruleRepository
      .createQueryBuilder('rule')
      .leftJoin(
        'risk_required_factors',
        'required_factor',
        'required_factor.risk_id = rule.risk_id AND required_factor.rate_book_id = rule.rate_book_id',
      )
      .where('rule.company_id = :companyId', {
        companyId: rateBook.company_id,
      })
      .andWhere('rule.rate_book_id = :rateBookId', { rateBookId: rateBook.id })
      .andWhere('rule.is_active = true')
      .andWhere('rule.deleted_at IS NULL')
      .andWhere('required_factor.id IS NULL')
      .getMany();

    if (rulesMissingFactors.length > 0) {
      throw new BadRequestException({
        code: 'RATE_BOOK_RISK_FACTORS_MISSING',
        message: 'One or more rate-book risks have no configured factors.',
        details: {
          rules: rulesMissingFactors.map((rule) => ({
            id: rule.id,
            ruleName: rule.rule_name,
            riskId: rule.risk_id,
          })),
        },
      });
    }

    return { valid: true, riskCount: activeRiskRows.length };
  }
}
