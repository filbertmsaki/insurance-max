import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreatePricingRateBookDto {
  @ApiProperty({ description: 'Insurance product UUID' })
  @IsUUID()
  @IsNotEmpty()
  product_id: string;

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
}
