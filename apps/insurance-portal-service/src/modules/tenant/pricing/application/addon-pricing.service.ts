import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { AddonPricingType } from '@insurance-max/contracts';
import { ProductAddonRateRule } from '../entities/product-addon-rate-rule.entity';

export interface AddonPricingCalculationSelection {
  addonDefinitionId: string;
  quantity: number;
  sumInsured: number | null;
}

export interface AddonPricingCalculationParams {
  companyId: string;
  rateBookId: string;
  effectiveDate: string;
  factors: Record<string, string | number | boolean>;
  selectedAddons: AddonPricingCalculationSelection[];
}

export interface AddonPricingCalculationResult {
  rule: ProductAddonRateRule;
  quantity: number;
  sumInsured: number | null;
  premium: Decimal;
}

/**
 * Resolves the active `product_addon_rate_rules` row for each selected
 * add-on and computes its premium using decimal.js, mirroring the
 * min/max-clamp convention already used by PremiumBreakdownService for the
 * primary risk premium.
 */
@Injectable()
export class AddonPricingService {
  constructor(
    @InjectRepository(ProductAddonRateRule)
    private readonly repository: Repository<ProductAddonRateRule>,
  ) {}

  async calculate(
    params: AddonPricingCalculationParams,
  ): Promise<AddonPricingCalculationResult[]> {
    const results: AddonPricingCalculationResult[] = [];

    for (const selected of params.selectedAddons) {
      const rule = await this.findActiveRule(
        params.companyId,
        params.rateBookId,
        selected.addonDefinitionId,
        params.effectiveDate,
      );

      if (!rule) {
        throw new BadRequestException(
          'No active pricing rule exists for a selected add-on.',
        );
      }

      const quantity = new Decimal(selected.quantity ?? 1);
      let premium = this.computeRawPremium(rule, selected, quantity, params);

      if (rule.minimum_amount !== null && rule.minimum_amount !== undefined) {
        premium = Decimal.max(premium, new Decimal(rule.minimum_amount));
      }
      if (rule.maximum_amount !== null && rule.maximum_amount !== undefined) {
        premium = Decimal.min(premium, new Decimal(rule.maximum_amount));
      }

      results.push({
        rule,
        quantity: selected.quantity,
        sumInsured: selected.sumInsured,
        premium,
      });
    }

    return results;
  }

  private computeRawPremium(
    rule: ProductAddonRateRule,
    selected: AddonPricingCalculationSelection,
    quantity: Decimal,
    params: AddonPricingCalculationParams,
  ): Decimal {
    switch (rule.pricing_type) {
      case AddonPricingType.INCLUDED:
        return new Decimal(0);

      case AddonPricingType.FIXED:
        return new Decimal(rule.fixed_amount ?? 0).mul(quantity);

      case AddonPricingType.PERCENTAGE: {
        if (selected.sumInsured === null || selected.sumInsured === undefined) {
          throw new BadRequestException(
            'A separate add-on sum insured is required.',
          );
        }
        return new Decimal(selected.sumInsured)
          .mul(new Decimal(rule.percentage_rate ?? 0))
          .mul(quantity);
      }

      case AddonPricingType.PER_UNIT: {
        const factorCode = rule.per_unit_factor_code;
        const factorValue = factorCode ? params.factors[factorCode] : undefined;
        if (!factorCode || factorValue === undefined || factorValue === null) {
          throw new BadRequestException(
            `Rating factor "${factorCode ?? 'unknown'}" is required to price this add-on.`,
          );
        }
        return new Decimal(Number(factorValue))
          .mul(new Decimal(rule.per_unit_amount ?? 0))
          .mul(quantity);
      }

      default:
        return new Decimal(0);
    }
  }

  private async findActiveRule(
    companyId: string,
    rateBookId: string,
    addonDefinitionId: string,
    effectiveDate: string,
  ): Promise<ProductAddonRateRule | null> {
    return this.repository
      .createQueryBuilder('rule')
      .leftJoinAndSelect('rule.addon_definition', 'addon_definition')
      .where('rule.company_id = :companyId', { companyId })
      .andWhere('rule.rate_book_id = :rateBookId', { rateBookId })
      .andWhere('rule.addon_definition_id = :addonDefinitionId', {
        addonDefinitionId,
      })
      .andWhere('rule.is_active = true')
      .andWhere(
        '(rule.effective_from IS NULL OR rule.effective_from <= :effectiveDate)',
        { effectiveDate },
      )
      .andWhere(
        '(rule.effective_to IS NULL OR rule.effective_to >= :effectiveDate)',
        { effectiveDate },
      )
      .orderBy('rule.priority', 'ASC')
      .getOne();
  }
}
