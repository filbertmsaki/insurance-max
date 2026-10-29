import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { QuotationType } from '../../quotations/enums/quotation-type.enum';

export class PricingAdjustmentRequestDto {
  @ApiPropertyOptional({
    example: 0.05,
    description:
      'Adjustment rate as a decimal fraction (e.g. 0.05 for 5%). Mutually exclusive with fixed_amount — if both are supplied, rate takes precedence.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rate?: number;

  @ApiPropertyOptional({
    example: 15000,
    description: 'Fixed adjustment amount in the quotation currency.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fixed_amount?: number;
}

export class AddonSelectionDto {
  @ApiProperty({ description: 'ProductAddonDefinition UUID' })
  @IsUUID()
  addon_definition_id: string;

  @ApiPropertyOptional({ example: 1, description: 'Defaults to 1.' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({
    example: 10000000,
    description:
      'Required only when the addon definition allows a separate sum insured and its pricing rule is PERCENTAGE-based.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sum_insured?: number;
}

export class CalculateSingleRiskPremiumDto {
  @ApiPropertyOptional({
    example: 'VEHICLE-001',
    description:
      'Optional client-provided identifier echoed back in pricing responses.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  client_reference?: string;

  @ApiProperty({ description: 'Insurance risk UUID' })
  @IsUUID()
  @IsNotEmpty()
  risk_id: string;

  @ApiPropertyOptional({
    example: 10000000,
    description:
      'Sum insured used for percentage calculations. Required only for risks whose pricing model depends on it.',
  })
  @IsOptional()
  @IsNumber()
  sum_insured?: number;

  @ApiProperty({
    type: Object,
    example: {
      seat_capacity: 10,
      vehicle_weight: 7,
      claim_record: 'NO_CLAIM',
    },
    description:
      'Map of factor_code to value. All required factors must be provided.',
  })
  @IsObject()
  factors: Record<string, string | number | boolean>;

  @ApiPropertyOptional({
    type: Object,
    description:
      'Deprecated alias for factors. If present, values are merged with factors.',
  })
  @IsOptional()
  @IsObject()
  factor_values?: Record<string, string | number | boolean>;

  @ApiPropertyOptional({
    example: '2026-07-27',
    description:
      'Optional charge-rule effective date. Defaults to the server date when omitted.',
  })
  @IsOptional()
  @IsDateString()
  effective_date?: string;

  @ApiPropertyOptional({
    example: '2026-07-27',
    description:
      'Cover start date used by rate books that prorate short-period covers.',
  })
  @IsOptional()
  @IsDateString()
  cover_start_date?: string;

  @ApiPropertyOptional({
    example: '2027-07-26',
    description:
      'Cover end date used by rate books that prorate short-period covers.',
  })
  @IsOptional()
  @IsDateString()
  cover_end_date?: string;

  @ApiPropertyOptional({
    enum: QuotationType,
    description:
      'Optional quotation type context for snapshot storage and downstream pricing governance.',
  })
  @IsOptional()
  @IsEnum(QuotationType)
  quotation_type?: QuotationType;

  @ApiPropertyOptional({
    example: 'TZS',
    description:
      'Optional currency context stored with the pricing quote snapshot.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency_code?: string;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Optional manual exchange rate for the quotation currency. Required for non-base currency pricing until an automatic source is configured.',
  })
  @IsOptional()
  @IsNumber()
  exchange_rate?: number;

  @ApiPropertyOptional({
    type: PricingAdjustmentRequestDto,
    description:
      "Requested discount. Computed as a live preview against the matched rule's discount limits — an over-limit request is still calculated and flagged, not rejected, here; approval is enforced at quotation submission.",
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PricingAdjustmentRequestDto)
  discount?: PricingAdjustmentRequestDto;

  @ApiPropertyOptional({
    type: PricingAdjustmentRequestDto,
    description: 'Requested loading, computed the same way as discount.',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PricingAdjustmentRequestDto)
  loading?: PricingAdjustmentRequestDto;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Deprecated. Use tax_codes to select catalogue taxes. Tax rules are no longer used.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tax_rule_ids?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['VAT-MAINLAND'],
    description:
      'Selected active catalogue tax codes. Missing or empty means no tax; rates are resolved by the backend.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tax_codes?: string[];

  @ApiPropertyOptional({
    type: [AddonSelectionDto],
    description:
      "Optional covers priced against the risk's resolved rate book (e.g. windscreen, radio). Each selection is priced via the product's configured product_addon_rate_rules and returned as addon_results — it is not folded into the risk's own premium_including_tax/total_premium submitted for the cover note, which stays addon-free to match the existing cover_note_addons submission contract.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddonSelectionDto)
  addons?: AddonSelectionDto[];
}

export class CalculateMultiRiskPremiumDto {
  @ApiProperty({ type: [CalculateSingleRiskPremiumDto] })
  @IsArray()
  risks: CalculateSingleRiskPremiumDto[];

  @ApiPropertyOptional({
    example: 'MOTOR',
    description: 'Optional product code context for fleet or batch pricing.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  product_code?: string;

  @ApiPropertyOptional({
    example: '2026-07-27',
    description:
      'Optional effective date context stored with the batch pricing request.',
  })
  @IsOptional()
  @IsDateString()
  effective_date?: string;

  @ApiPropertyOptional({ description: 'Company user UUID for access check' })
  @IsOptional()
  @IsUUID()
  company_user_id?: string;

  @ApiPropertyOptional({ description: 'Branch UUID for access context' })
  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @ApiPropertyOptional({ description: 'Department UUID for access context' })
  @IsOptional()
  @IsUUID()
  department_id?: string;

  @ApiPropertyOptional({
    enum: QuotationType,
    description:
      'Optional quotation type context for snapshot storage and downstream pricing governance.',
  })
  @IsOptional()
  @IsEnum(QuotationType)
  quotation_type?: QuotationType;

  @ApiPropertyOptional({
    example: 'TZS',
    description:
      'Optional currency context stored with the pricing quote snapshot.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency_code?: string;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Optional manual exchange rate applied consistently across the batch.',
  })
  @IsOptional()
  @IsNumber()
  exchange_rate?: number;
}

export class FleetVehiclePricingDto {
  @ApiProperty({
    example: 'VEHICLE-001',
    description: 'Client identifier for the vehicle, echoed back per result.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  client_reference: string;

  @ApiPropertyOptional({
    example: 25000000,
    description:
      "The vehicle's own sum insured. Optional for risks whose pricing does not depend on it (e.g. third party).",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sum_insured?: number;

  @ApiProperty({
    type: Object,
    description: 'Map of factor_code to value for this vehicle.',
  })
  @IsObject()
  factors: Record<string, string | number | boolean>;
}

/**
 * Motor fleet pricing: one risk, discount and tax selection shared by the
 * whole fleet, rated per vehicle and rolled up into fleet totals.
 */
export class CalculateFleetPremiumDto {
  @ApiProperty({ description: 'Insurance risk UUID applied to every vehicle' })
  @IsUUID()
  @IsNotEmpty()
  risk_id: string;

  @ApiProperty({ type: [FleetVehiclePricingDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FleetVehiclePricingDto)
  vehicles: FleetVehiclePricingDto[];

  @ApiPropertyOptional({ type: PricingAdjustmentRequestDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PricingAdjustmentRequestDto)
  discount?: PricingAdjustmentRequestDto;

  @ApiPropertyOptional({ type: [String], example: ['VAT-MAINLAND'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tax_codes?: string[];

  @ApiPropertyOptional({ example: 'MOTOR' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  product_code?: string;

  @ApiPropertyOptional({ example: '2026-07-27' })
  @IsOptional()
  @IsDateString()
  effective_date?: string;

  @ApiPropertyOptional({ example: '2026-07-27' })
  @IsOptional()
  @IsDateString()
  cover_start_date?: string;

  @ApiPropertyOptional({ example: '2027-07-26' })
  @IsOptional()
  @IsDateString()
  cover_end_date?: string;

  @ApiPropertyOptional({ enum: QuotationType })
  @IsOptional()
  @IsEnum(QuotationType)
  quotation_type?: QuotationType;

  @ApiPropertyOptional({ example: 'TZS' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency_code?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  exchange_rate?: number;
}
