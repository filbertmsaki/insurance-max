import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { FactorDataType } from '@insurance-max/portal-shared/enums/factor-data-type.enum';
import { FactorUnit } from '@insurance-max/portal-shared/enums/factor-unit.enum';

export class CreateRatingFactorDto {
  @ApiProperty({
    example: 'sum_insured',
    description: 'Unique factor code within the company',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code: string;

  @ApiProperty({ example: 'Sum Insured', description: 'Factor display name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({ enum: FactorDataType, example: FactorDataType.DECIMAL })
  @IsEnum(FactorDataType)
  data_type: FactorDataType;

  @ApiPropertyOptional({
    enum: FactorUnit,
    example: FactorUnit.CURRENCY,
    description: 'Optional unit for numeric pricing factors',
  })
  @IsOptional()
  @IsEnum(FactorUnit)
  unit?: FactorUnit | null;

  @ApiPropertyOptional({
    type: [String],
    example: ['Sedan', 'SUV', 'Pickup'],
    description: 'Options for SELECT/MULTI_SELECT types',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiPropertyOptional({ example: '0', description: 'Default value as string' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  default_value?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  is_required?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
