import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RateType } from '@insurance-max/portal-shared/enums/rate-type.enum';

export class CreateRiskRatingRuleDto {
  @ApiProperty({ description: 'Insurance risk UUID' })
  @IsUUID()
  @IsNotEmpty()
  risk_id: string;

  @ApiPropertyOptional({
    description:
      'Optional pricing rate-book UUID. When provided, the rule becomes part of that versioned rate book.',
  })
  @IsOptional()
  @IsUUID()
  rate_book_id?: string;

  @ApiProperty({
    example: 'Base Rate',
    description: 'Unique rule name within this risk',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  rule_name: string;

  @ApiProperty({
    enum: RateType,
    example: RateType.PERCENTAGE_PLUS_PER_UNIT,
    description:
      'PERCENTAGE, FIXED, PERCENTAGE_PLUS_FIXED, PERCENTAGE_PLUS_PER_UNIT, PER_UNIT, FORMULA (legacy shorthand only)',
  })
  @IsEnum(RateType)
  rate_type: RateType;

  @ApiPropertyOptional({
    example: 0.035,
    description: 'Percentage rate as a decimal fraction (e.g. 0.035 = 3.5%)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  percentage_rate?: number;

  @ApiPropertyOptional({ example: 5000, description: 'Fixed premium amount' })
  @IsOptional()
  @IsNumber()
  fixed_amount?: number;

  @ApiPropertyOptional({
    example: 15000,
    description:
      'Amount per unit for PER_UNIT and PERCENTAGE_PLUS_PER_UNIT rate types',
  })
  @IsOptional()
  @IsNumber()
  per_unit_amount?: number;

  @ApiPropertyOptional({
    example: 'seat_capacity',
    description:
      'Factor code used as unit for PER_UNIT and PERCENTAGE_PLUS_PER_UNIT rate types',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  per_unit_factor_code?: string;

  @ApiPropertyOptional({ example: 2500, description: 'Minimum premium amount' })
  @IsOptional()
  @IsNumber()
  minimum_amount?: number;

  @ApiPropertyOptional({
    example: 5000000,
    description: 'Maximum premium ceiling amount',
  })
  @IsOptional()
  @IsNumber()
  maximum_amount?: number;

  @ApiPropertyOptional({
    example: 0.1,
    description: 'Maximum aggregate discount rate allowed (decimal fraction)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  max_discount_rate?: number | null;

  @ApiPropertyOptional({
    example: 50000,
    description: 'Maximum aggregate discount amount allowed for this rule',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  max_discount_amount?: number | null;

  @ApiPropertyOptional({
    example: 0.05,
    description:
      'Discount approval threshold rate (decimal fraction). Requests above this require approval.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  discount_approval_threshold_rate?: number | null;

  @ApiPropertyOptional({
    example: 25000,
    description:
      'Discount approval threshold amount. Requests above this require approval.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_approval_threshold_amount?: number | null;

  @ApiPropertyOptional({
    example: 0.08,
    description: 'Maximum aggregate loading rate allowed (decimal fraction)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  max_loading_rate?: number | null;

  @ApiPropertyOptional({
    example: 40000,
    description: 'Maximum aggregate loading amount allowed for this rule',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  max_loading_amount?: number | null;

  @ApiPropertyOptional({
    example: 0.04,
    description:
      'Loading approval threshold rate (decimal fraction). Requests above this require approval.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  loading_approval_threshold_rate?: number | null;

  @ApiPropertyOptional({
    example: 20000,
    description:
      'Loading approval threshold amount. Requests above this require approval.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  loading_approval_threshold_amount?: number | null;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description:
      'Optional effective start date for discount/loading controls on this rule',
  })
  @IsOptional()
  @IsDateString()
  adjustment_effective_from?: string | null;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description:
      'Optional effective end date for discount/loading controls on this rule',
  })
  @IsOptional()
  @IsDateString()
  adjustment_effective_to?: string | null;

  @ApiPropertyOptional({
    example: '5.5% + 15,000 per seat',
    description:
      'Legacy shorthand text for FORMULA rules. Supported patterns are limited to safe structured forms like "2% + 200,000", "15,000 per seat", or "5.5% + 15,000 per seat".',
  })
  @IsOptional()
  @IsString()
  formula?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Evaluation priority (lower = higher priority)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
