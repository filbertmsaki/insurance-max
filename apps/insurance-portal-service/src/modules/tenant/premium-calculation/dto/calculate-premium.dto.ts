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
      'Requested discount. Computed as a live preview against the matched rule\'s discount limits — an over-limit request is still calculated and flagged, not rejected, here; approval is enforced at quotation submission.',
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
      'Specific product-tax-rule UUIDs to apply. When omitted, every currently active rule applicable to the product/risk is applied (unchanged default behavior).',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tax_rule_ids?: string[];
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
