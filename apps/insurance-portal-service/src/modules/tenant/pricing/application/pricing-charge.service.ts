import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  roundMoney,
  applyRate,
} from '@insurance-max/portal-shared/utils/pricing-calculation.util';
import { In, Repository } from 'typeorm';
import { Tax } from '../../taxes/entities/tax.entity';
import type {
  PricingChargeBreakdown,
  PricingChargeCalculationInput,
  PricingChargeSummary,
} from '../domain/pricing.types';

@Injectable()
export class PricingChargeService {
  constructor(
    @InjectRepository(Tax) private readonly taxRepository: Repository<Tax>,
  ) {}

  async calculateCharges(
    companyId: string,
    input: PricingChargeCalculationInput,
  ): Promise<PricingChargeSummary & { charges: PricingChargeBreakdown[] }> {
    if (input.tax_rule_ids?.length)
      throw new BadRequestException(
        'Tax rules are no longer supported. Select catalogue taxes using tax_codes.',
      );
    const selectedCodes =
      input.tax_codes === undefined || input.tax_codes === null
        ? null
        : input.tax_codes;
    const defaultTax =
      selectedCodes === null
        ? await this.taxRepository.findOne({
            where: {
              company_id: companyId,
              is_active: true,
              is_default: true,
            },
          })
        : null;
    const codes = [
      ...new Set(
        (selectedCodes ?? (defaultTax ? [defaultTax.tax_code] : []))
          .map((code) => code.trim().toUpperCase())
          .filter(Boolean),
      ),
    ];
    if (selectedCodes === null && !defaultTax) {
      throw new BadRequestException(
        'No active default tax is configured. Configure a default tax before calculating taxable premium.',
      );
    }
    const taxes = codes.length
      ? await this.taxRepository.find({
          where: {
            company_id: companyId,
            is_active: true,
            tax_code: In(codes),
          },
        })
      : [];
    const byCode = new Map(taxes.map((tax) => [tax.tax_code, tax]));
    const charges: PricingChargeBreakdown[] = codes.map((code) => {
      const tax = byCode.get(code);
      if (!tax)
        throw new BadRequestException(
          'Tax ' +
            code +
            ' is unavailable. Select an active tax from the tax catalogue.',
        );
      return {
        // Retained in the snapshot contract; now identifies a catalogue tax.
        applied_rule_id: tax.id,
        charge_code: tax.tax_code,
        charge_name: tax.tax_name,
        charge_category: 'TAX',
        charge_scope: 'COMPANY',
        charge_type: 'PERCENTAGE',
        calculation_base: 'NET_PREMIUM',
        base_amount: roundMoney(input.net_premium),
        rate: Number(tax.tax_rate),
        fixed_amount: null,
        minimum_charge_amount: null,
        maximum_charge_amount: null,
        computed_amount: roundMoney(
          applyRate(input.net_premium, Number(tax.tax_rate)),
        ),
        is_taxable: false,
        effective_from: '',
        effective_to: '',
      };
    });
    const total = roundMoney(
      charges.reduce((sum, charge) => sum + charge.computed_amount, 0),
    );
    return {
      charges,
      total_charge_amount: total,
      taxable_charge_amount: 0,
      non_taxable_charge_amount: total,
      premium_including_charges: roundMoney(input.net_premium + total),
    };
  }
}
