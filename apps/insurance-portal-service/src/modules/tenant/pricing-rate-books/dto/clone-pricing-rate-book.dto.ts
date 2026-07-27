import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class ClonePricingRateBookDto {
  @ApiProperty({ description: 'Existing pricing rate-book UUID' })
  @IsUUID()
  @IsNotEmpty()
  source_rate_book_id: string;

  @ApiProperty({ example: '2026.2' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  version: string;

  @ApiPropertyOptional({ example: 'MOTOR-STANDARD' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({ example: 'Motor Standard 2026 Revision 2' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsDateString()
  effective_from?: string;

  @ApiPropertyOptional({ example: '2027-07-31' })
  @IsOptional()
  @IsDateString()
  effective_to?: string | null;
}
