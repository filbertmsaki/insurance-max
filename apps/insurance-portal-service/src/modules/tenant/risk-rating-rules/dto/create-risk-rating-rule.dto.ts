import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { RateType } from '@insurance-max/portal-shared/enums/rate-type.enum';

export class CreateRiskRatingRuleDto {
  @ApiProperty({ description: 'Insurance risk UUID' })
  @IsUUID()
  @IsNotEmpty()
  risk_id: string;

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
      'PERCENTAGE, FIXED, PERCENTAGE_PLUS_FIXED, PERCENTAGE_PLUS_PER_UNIT, PER_UNIT, FORMULA',
  })
  @IsEnum(RateType)
  rate_type: RateType;

  @ApiPropertyOptional({
    example: 3.5,
    description: 'Percentage rate (e.g. 3.5 = 3.5%)',
  })
  @IsOptional()
  @IsNumber()
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
    example: '(sum_insured * 0.03) + (seat_capacity * 15000)',
    description:
      'Formula string for FORMULA rate type using factor codes as variables',
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
