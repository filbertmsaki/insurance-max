import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { InsuranceBusinessLine } from '../enums/insurance-business-line.enum';

export class CreateInsuranceCategoryDto {
  @ApiProperty({
    example: 'MOTOR',
    description: 'Unique category code within the company',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiProperty({
    example: 'Motor Insurance',
    description: 'Category display name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({
    example: 'Covers motor vehicles against loss or damage',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    enum: InsuranceBusinessLine,
    default: InsuranceBusinessLine.NON_MOTOR,
  })
  @IsEnum(InsuranceBusinessLine)
  business_line: InsuranceBusinessLine;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ example: 'MOT' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MaxLength(50)
  tiramis_category_code?: string | null;

  @ApiPropertyOptional({ example: 100, default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sort_order?: number;
}
