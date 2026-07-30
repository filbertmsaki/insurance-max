import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FactorDataType } from '@insurance-max/portal-shared/enums/factor-data-type.enum';
import { RatingFactor } from '../../rating-factors/entities/rating-factor.entity';
import { RiskRequiredFactor } from '../../risk-required-factors/entities/risk-required-factor.entity';
import type {
  PricingFactorValidationResult,
  PricingFactorValues,
  PricingSingleRiskInput,
  PricingValidationIssue,
} from '../domain/pricing.types';
import { PricingRuntimeCacheService } from '../application/pricing-runtime-cache.service';
import { FactorUnit } from '@insurance-max/portal-shared/enums/factor-unit.enum';

@Injectable()
export class RatingFactorValidatorService {
  constructor(
    @InjectRepository(RiskRequiredFactor)
    private readonly requiredFactorRepository: Repository<RiskRequiredFactor>,

    @InjectRepository(RatingFactor)
    private readonly ratingFactorRepository: Repository<RatingFactor>,

    private readonly pricingRuntimeCacheService: PricingRuntimeCacheService,
  ) {}

  normalizeInputFactors(input: PricingSingleRiskInput): PricingFactorValues {
    const merged: PricingFactorValues = {
      ...(input.factor_values ?? {}),
      ...(input.factors ?? {}),
    };

    const normalized: PricingFactorValues = {};
    for (const [key, value] of Object.entries(merged)) {
      normalized[key.trim().toLowerCase()] = value;
    }

    const sumInsured = Number(
      input.sum_insured ??
        normalized.sum_insured ??
        normalized.sum_insured_amount ??
        0,
    );

    if (!Number.isFinite(sumInsured) || sumInsured < 0) {
      throw new BadRequestException(
        'sum_insured must be a valid non-negative number',
      );
    }

    normalized.sum_insured = sumInsured;
    return normalized;
  }

  async validateForRisk(
    companyId: string,
    riskId: string,
    factorValues: PricingFactorValues,
    effectiveDate?: string | null,
  ): Promise<PricingFactorValidationResult> {
    const required = await this.pricingRuntimeCacheService.getRequiredFactors(
      companyId,
      riskId,
      () =>
        this.requiredFactorRepository.find({
          where: { company_id: companyId, risk_id: riskId, is_required: true },
          relations: { factor: true },
          order: { sort_order: 'ASC' },
        }),
    );

    const factorCodes = Object.keys(factorValues).filter(
      (code) => code !== 'sum_insured_amount',
    );
    const configuredFactors =
      factorCodes.length > 0
        ? await this.pricingRuntimeCacheService.getConfiguredFactors(
            companyId,
            factorCodes,
            () =>
              this.ratingFactorRepository.find({
                where: {
                  company_id: companyId,
                  code: In(factorCodes),
                },
              }),
          )
        : [];

    const configuredFactorMap = new Map(
      configuredFactors.map((factor) => [factor.code, factor]),
    );
    const errors: PricingValidationIssue[] = [];
    const warnings: PricingValidationIssue[] = [];
    const normalizedFactorValues: PricingFactorValues = { ...factorValues };

    required.forEach((rf) => {
      const value = factorValues[rf.factor.code];
      if (
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '')
      ) {
        errors.push({
          field: rf.factor.code,
          code: 'REQUIRED_FACTOR_MISSING',
          message: `Required factor "${rf.factor.code}" (${rf.factor.name}) is missing`,
        });
      }
    });

    for (const code of factorCodes) {
      const factor = configuredFactorMap.get(code);
      const value = factorValues[code];

      if (!factor) {
        warnings.push({
          field: code,
          code: 'UNKNOWN_FACTOR',
          message: `Factor "${code}" is not configured and will be ignored by validation`,
        });
        continue;
      }

      if (!factor.is_active) {
        warnings.push({
          field: code,
          code: 'INACTIVE_FACTOR',
          message: `Factor "${code}" is inactive but was supplied`,
        });
      }

      const validationIssue = this.validateFactorValue(factor, value);
      if (validationIssue) {
        errors.push(validationIssue);
        continue;
      }

      normalizedFactorValues[code] = this.normalizeFactorValue(factor, value);
      const semanticValidationIssue = this.validateSemanticFactorValue(
        factor,
        normalizedFactorValues[code],
        effectiveDate ?? null,
      );
      if (semanticValidationIssue) {
        errors.push(semanticValidationIssue);
      }
    }

    return {
      normalized_factor_values: normalizedFactorValues,
      errors,
      warnings,
      calculation_allowed: errors.length === 0,
    };
  }

  private validateFactorValue(
    factor: RatingFactor,
    value: string | number | boolean,
  ): PricingValidationIssue | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    switch (factor.data_type) {
      case FactorDataType.NUMBER:
      case FactorDataType.DECIMAL:
      case FactorDataType.INTEGER: {
        const parsed = typeof value === 'number' ? value : Number(value);
        if (!Number.isFinite(parsed)) {
          return {
            field: factor.code,
            code: 'INVALID_NUMBER',
            message: `Factor "${factor.code}" must be a valid number`,
          };
        }
        if (
          factor.data_type === FactorDataType.INTEGER &&
          !Number.isInteger(parsed)
        ) {
          return {
            field: factor.code,
            code: 'INVALID_INTEGER',
            message: `Factor "${factor.code}" must be a whole number`,
          };
        }
        break;
      }
      case FactorDataType.BOOLEAN:
        if (this.toBoolean(value) === null) {
          return {
            field: factor.code,
            code: 'INVALID_BOOLEAN',
            message: `Factor "${factor.code}" must be a valid boolean value`,
          };
        }
        break;
      case FactorDataType.DATE: {
        const raw = String(value).trim();
        if (!raw || Number.isNaN(Date.parse(raw))) {
          return {
            field: factor.code,
            code: 'INVALID_DATE',
            message: `Factor "${factor.code}" must be a valid date`,
          };
        }
        break;
      }
      case FactorDataType.SELECT: {
        const selected = String(value).trim();
        if (selected && !(factor.options ?? []).includes(selected)) {
          return {
            field: factor.code,
            code: 'INVALID_OPTION',
            message: `Factor "${factor.code}" must be one of: ${(factor.options ?? []).join(', ')}`,
          };
        }
        break;
      }
      case FactorDataType.MULTI_SELECT: {
        const values = String(value)
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
        const invalid = values.filter(
          (item) => !(factor.options ?? []).includes(item),
        );
        if (invalid.length > 0) {
          return {
            field: factor.code,
            code: 'INVALID_MULTI_SELECT_OPTION',
            message: `Factor "${factor.code}" contains invalid options: ${invalid.join(', ')}`,
          };
        }
        break;
      }
      case FactorDataType.TEXT:
      default:
        break;
    }

    return null;
  }

  private normalizeFactorValue(
    factor: RatingFactor,
    value: string | number | boolean,
  ): string | number | boolean {
    switch (factor.data_type) {
      case FactorDataType.NUMBER:
      case FactorDataType.DECIMAL:
      case FactorDataType.INTEGER:
        return typeof value === 'number' ? value : Number(value);
      case FactorDataType.BOOLEAN:
        return this.toBoolean(value) ?? false;
      case FactorDataType.DATE:
      case FactorDataType.SELECT:
      case FactorDataType.TEXT:
        return String(value).trim();
      case FactorDataType.MULTI_SELECT:
        return String(value)
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
          .join(',');
      default:
        return value;
    }
  }

  private toBoolean(value: string | number | boolean): boolean | null {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
      return null;
    }

    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }

    return null;
  }

  private validateSemanticFactorValue(
    factor: RatingFactor,
    value: string | number | boolean,
    effectiveDate: string | null,
  ): PricingValidationIssue | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }

    switch (factor.code) {
      case 'sum_insured':
        if (value <= 0) {
          return {
            field: factor.code,
            code: 'SUM_INSURED_MUST_BE_POSITIVE',
            message: 'Sum insured must be greater than zero',
          };
        }
        return null;
      case 'seat_capacity':
        if (!Number.isInteger(value) || value <= 0) {
          return {
            field: factor.code,
            code: 'SEAT_CAPACITY_INVALID',
            message: 'Seat capacity must be a positive whole number',
          };
        }
        return null;
      case 'gross_weight_tons':
        if (value <= 0) {
          return {
            field: factor.code,
            code: 'GROSS_WEIGHT_INVALID',
            message: 'Gross weight must be greater than zero',
          };
        }
        return null;
      case 'year_of_manufacture': {
        if (!Number.isInteger(value) || value < 1900 || value > 9999) {
          return {
            field: factor.code,
            code: 'YEAR_OF_MANUFACTURE_INVALID',
            message: 'Year of manufacture must be a four-digit whole year',
          };
        }

        const coverYear = this.resolveCoverYear(effectiveDate);
        if (value > coverYear) {
          return {
            field: factor.code,
            code: 'YEAR_OF_MANUFACTURE_IN_FUTURE',
            message:
              'Year of manufacture must not be in the future relative to the cover start date',
          };
        }

        return null;
      }
      default:
        if (
          factor.unit &&
          [
            FactorUnit.CURRENCY,
            FactorUnit.SEAT,
            FactorUnit.TONNE,
            FactorUnit.YEAR,
          ].includes(factor.unit) &&
          value < 0
        ) {
          return {
            field: factor.code,
            code: 'NUMERIC_FACTOR_NEGATIVE',
            message: `Factor "${factor.code}" must not be negative`,
          };
        }
        return null;
    }
  }

  private resolveCoverYear(effectiveDate: string | null): number {
    const parsed = effectiveDate ? new Date(effectiveDate) : new Date();
    return Number.isNaN(parsed.getTime())
      ? new Date().getUTCFullYear()
      : parsed.getUTCFullYear();
  }
}
