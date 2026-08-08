import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

import { ConfigValueType } from '../entities/company-config.entity';

export class UpsertCompanyConfigDto {
  @ApiProperty({
    description: 'The config value. Must match `value_type` — a string for STRING, a number for NUMBER, true/false for BOOLEAN, or any JSON value for JSON.',
    example: 30,
  })
  config_value: unknown;

  @ApiProperty({ enum: ConfigValueType, example: ConfigValueType.NUMBER })
  @IsEnum(ConfigValueType)
  value_type: ConfigValueType;

  @ApiPropertyOptional({ example: 'Days before expiry to send the renewal notice' })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
