import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
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
}
