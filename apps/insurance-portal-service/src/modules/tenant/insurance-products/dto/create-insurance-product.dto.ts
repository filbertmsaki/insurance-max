import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateInsuranceProductDto {
  @ApiProperty({
    description: 'Insurance category UUID this product belongs to',
  })
  @IsUUID()
  @IsNotEmpty()
  category_id: string;

  @ApiProperty({
    example: 'MOTOR-COMP',
    description: 'Unique, permanent product code within the company',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[A-Z0-9_-]+$/)
  product_code: string;

  @ApiProperty({
    example: 'Motor Comprehensive',
    description: 'Product display name (compatibility projection)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  product_name: string;

  @ApiPropertyOptional({ example: 'Comprehensive motor vehicle cover' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  supports_fleet?: boolean;

  @ApiPropertyOptional({ example: 'CP20100000' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MaxLength(50)
  tiramis_product_code?: string;

  @ApiPropertyOptional({ example: 3, description: 'TIRAMIS cover note type' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  cover_note_type?: number;

  @ApiPropertyOptional({ example: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3660)
  default_cover_duration_days?: number;

  @ApiPropertyOptional({ example: 'TZS' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z]{3}$/)
  currency_code?: string;
}
