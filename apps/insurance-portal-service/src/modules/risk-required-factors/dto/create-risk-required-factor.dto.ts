import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateRiskRequiredFactorDto {
  @ApiProperty({ description: 'Insurance risk UUID' })
  @IsUUID()
  @IsNotEmpty()
  risk_id: string;

  @ApiProperty({ description: 'Rating factor UUID' })
  @IsUUID()
  @IsNotEmpty()
  factor_id: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  is_required?: boolean;

  @ApiPropertyOptional({ example: 0, description: 'Sort order for display' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}
