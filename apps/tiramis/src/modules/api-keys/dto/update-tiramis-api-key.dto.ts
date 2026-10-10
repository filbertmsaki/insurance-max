import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  IsIP,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

import { TIRAMIS_API_KEY_SCOPES } from './create-tiramis-api-key.dto';

export class UpdateTiramisApiKeyDto {
  @IsOptional()
  @IsUUID()
  clientConfigurationId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  tenantCompanyCode?: string | null;

  @IsOptional()
  @IsIn(['test', 'live'])
  tenantEnvironment?: 'local' | 'uat' | 'production' | null;

  @IsOptional()
  @ApiPropertyOptional({ example: ['203.0.113.10', '2001:db8::10'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIP(undefined, { each: true })
  allowedIps!: string[];

  @IsOptional()
  @ApiPropertyOptional({
    enum: TIRAMIS_API_KEY_SCOPES,
    isArray: true,
    example: ['tiramis:submit', 'tiramis:read'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(TIRAMIS_API_KEY_SCOPES, { each: true })
  scopes?: string[];

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}
