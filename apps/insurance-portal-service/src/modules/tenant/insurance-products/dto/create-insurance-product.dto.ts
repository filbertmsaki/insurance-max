import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { InsuranceBusinessLine } from '../../insurance-categories/enums/insurance-business-line.enum';

export class CreateInsuranceProductDto {
  @ApiProperty({
    description: 'Insurance category UUID this product belongs to',
  })
  @IsUUID()
  @IsNotEmpty()
  category_id: string;

  @ApiProperty({
    example: 'MOTOR-COMP',
    description: 'Unique product code within the company',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  product_code: string;

  @ApiProperty({
    example: 'Motor Comprehensive',
    description: 'Product display name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  product_name: string;

  @ApiPropertyOptional({ example: 'Comprehensive motor vehicle cover' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    enum: InsuranceBusinessLine,
    default: InsuranceBusinessLine.NON_MOTOR,
  })
  @IsEnum(InsuranceBusinessLine)
  business_line: InsuranceBusinessLine;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  supports_fleet?: boolean;

  @ApiPropertyOptional({ example: 'CP20100000' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tiramis_product_code?: string | null;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
