import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';
import {
  PricingProrationMethod,
  PricingRoundingMode,
} from '@insurance-max/contracts';

export class CreatePricingRateBookDto {
  @ApiProperty({
    description:
      'Published insurance product-version UUID this rate book is bound to',
  })
  @IsUUID()
  @IsNotEmpty()
  product_version_id: string;

  @ApiProperty({ example: 'MOTOR-STANDARD' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiProperty({ example: '2026.1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  version: string;

  @ApiPropertyOptional({ example: 'Motor Standard 2026' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ example: 'TZS' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency_code?: string;

  @ApiProperty({ example: '2026-07-27' })
  @IsDateString()
  effective_from: string;

  @ApiPropertyOptional({ example: '2027-07-26' })
  @IsOptional()
  @IsDateString()
  effective_to?: string | null;

  @ApiPropertyOptional({ enum: PricingRoundingMode })
  @IsOptional()
  @IsEnum(PricingRoundingMode)
  rounding_mode?: PricingRoundingMode;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  rounding_increment?: number;

  @ApiPropertyOptional({ enum: PricingProrationMethod })
  @IsOptional()
  @IsEnum(PricingProrationMethod)
  proration_method?: PricingProrationMethod;
}
