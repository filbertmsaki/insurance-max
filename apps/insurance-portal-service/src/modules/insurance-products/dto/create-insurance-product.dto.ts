import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
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

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
