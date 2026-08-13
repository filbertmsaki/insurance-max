import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InsuranceRisk } from '../../insurance-risks/entities/insurance-risk.entity';
import type {
  PricingFactorValues,
  PricingSingleRiskInput,
} from '../domain/pricing.types';
import { PricingRuntimeCacheService } from './pricing-runtime-cache.service';
import {
  deriveMotorSelectionConstraint,
  isMotorProductCode,
} from '../domain/motor-rating.config';

@Injectable()
export class PricingValidationService {
  constructor(
    @InjectRepository(InsuranceRisk)
    private readonly riskRepository: Repository<InsuranceRisk>,

    private readonly pricingRuntimeCacheService: PricingRuntimeCacheService,
  ) {}

  async requireActiveRisk(
    companyId: string,
    riskId: string,
  ): Promise<InsuranceRisk> {
    const risk = await this.pricingRuntimeCacheService.getActiveRisk(
      companyId,
      riskId,
      () =>
        this.riskRepository.findOne({
          where: { id: riskId, company_id: companyId, is_active: true },
          relations: { product: true },
        }),
    );

    if (!risk) {
      throw new NotFoundException(`Risk not found or inactive: ${riskId}`);
    }

    return risk;
  }

  assertMultiRiskRequest(risks: PricingSingleRiskInput[] | undefined): void {
    if (!risks || risks.length === 0) {
      throw new BadRequestException('At least one risk must be provided');
    }
  }

  assertPricingConfigurationAvailable(risk: InsuranceRisk): void {
    if (!risk.product?.product_code?.trim()) {
      throw new ConflictException({
        status: 'CONFIGURATION_ERROR',
        code: 'RATING_CONFIGURATION_NOT_AVAILABLE',
        message:
          'Rating configuration is not available for the selected product',
        product_id: risk.product_id,
        product_code: risk.product?.product_code ?? null,
        risk_id: risk.id,
        risk_code: risk.risk_code,
      });
    }
  }

  assertMotorRiskSelectionMatches(
    risk: InsuranceRisk,
    factorValues: PricingFactorValues,
    effectiveDate?: string | null,
  ): void {
    if (!isMotorProductCode(risk.product?.product_code ?? null)) {
      return;
    }

    const constraint = deriveMotorSelectionConstraint(risk.risk_name);
    if (!constraint) {
      return;
    }

    if (constraint.kind === 'WEIGHT_BAND') {
      const weight = Number(factorValues.gross_weight_tons);
      if (!Number.isFinite(weight)) {
        throw new BadRequestException({
          status: 'INCOMPLETE',
          calculation_allowed: false,
          code: 'GROSS_WEIGHT_REQUIRED',
          message: `Selected risk ${risk.risk_code} requires gross_weight_tons`,
          validation_errors: [
            'gross_weight_tons is required for the selected risk',
          ],
        });
      }

      const isValid =
        (constraint.minExclusive === undefined ||
          weight > constraint.minExclusive) &&
        (constraint.minInclusive === undefined ||
          weight >= constraint.minInclusive) &&
        (constraint.maxExclusive === undefined ||
          weight < constraint.maxExclusive) &&
        (constraint.maxInclusive === undefined ||
          weight <= constraint.maxInclusive);

      if (!isValid) {
        throw new BadRequestException({
          status: 'INCOMPLETE',
          calculation_allowed: false,
          code: 'RISK_SELECTION_MISMATCH',
          message: `Selected risk ${risk.risk_code} does not match gross_weight_tons=${weight}. Expected ${constraint.expectedLabel}.`,
          selected_risk: risk.risk_code,
          factor_code: 'gross_weight_tons',
          supplied_value: weight,
          expected_range: constraint.expectedLabel,
          recommended_matching_risk_hint: constraint.recommendedRiskHint,
          validation_errors: [
            `Selected risk ${risk.risk_code} does not match gross_weight_tons=${weight}. Expected ${constraint.expectedLabel}.`,
          ],
        });
      }

      return;
    }

    const manufactureYear = Number(factorValues.year_of_manufacture);
    if (
      !Number.isFinite(manufactureYear) ||
      !Number.isInteger(manufactureYear)
    ) {
      throw new BadRequestException({
        status: 'INCOMPLETE',
        calculation_allowed: false,
        code: 'YEAR_OF_MANUFACTURE_REQUIRED',
        message: `Selected risk ${risk.risk_code} requires year_of_manufacture`,
        validation_errors: [
          'year_of_manufacture is required for the selected risk',
        ],
      });
    }

    const coverYear = this.resolveCoverYear(effectiveDate);
    const vehicleAge = coverYear - manufactureYear;
    const isValid =
      (constraint.minInclusive === undefined ||
        vehicleAge >= constraint.minInclusive) &&
      (constraint.maxExclusive === undefined ||
        vehicleAge < constraint.maxExclusive);

    if (!isValid) {
      throw new BadRequestException({
        status: 'INCOMPLETE',
        calculation_allowed: false,
        code: 'RISK_SELECTION_MISMATCH',
        message: `Selected risk ${risk.risk_code} does not match vehicle_age=${vehicleAge}. Expected ${constraint.expectedLabel}.`,
        selected_risk: risk.risk_code,
        factor_code: 'year_of_manufacture',
        supplied_value: manufactureYear,
        computed_vehicle_age: vehicleAge,
        expected_range: constraint.expectedLabel,
        recommended_matching_risk_hint: constraint.recommendedRiskHint,
        validation_errors: [
          `Selected risk ${risk.risk_code} does not match vehicle_age=${vehicleAge}. Expected ${constraint.expectedLabel}.`,
        ],
      });
    }
  }

  private resolveCoverYear(effectiveDate?: string | null): number {
    const parsed = effectiveDate ? new Date(effectiveDate) : new Date();
    return Number.isNaN(parsed.getTime())
      ? new Date().getUTCFullYear()
      : parsed.getUTCFullYear();
  }
}
