import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
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
  Min,
  MaxLength,
} from 'class-validator';
import { AddonPricingType } from '@insurance-max/contracts';

export class CreateAddonRateRuleDto {
  @ApiProperty({ description: 'Product add-on definition UUID' })
  @IsUUID()
  @IsNotEmpty()
  addon_definition_id: string;

  @ApiProperty({ example: 'ADDON-PA-BASE' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  rule_code: string;

  @ApiProperty({ enum: AddonPricingType })
  @IsEnum(AddonPricingType)
  pricing_type: AddonPricingType;

  @ApiPropertyOptional({
    example: 0.02,
    description: 'Percentage rate as a decimal fraction (PERCENTAGE only)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  percentage_rate?: number;

  @ApiPropertyOptional({
    description: 'Fixed addon premium amount (FIXED only)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fixed_amount?: number;

  @ApiPropertyOptional({ description: 'Amount per unit (PER_UNIT only)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  per_unit_amount?: number;

  @ApiPropertyOptional({
    description: 'Factor code used as the unit for PER_UNIT pricing',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  per_unit_factor_code?: string;

  @ApiPropertyOptional({ description: 'Minimum addon premium amount' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minimum_amount?: number;

  @ApiPropertyOptional({ description: 'Maximum addon premium amount' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maximum_amount?: number;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  effective_from?: string | null;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  effective_to?: string | null;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
