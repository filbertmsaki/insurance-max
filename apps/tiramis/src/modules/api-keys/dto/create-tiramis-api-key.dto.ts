import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateTiramisApiKeyDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(120)
  serviceName!: string;

  @ApiPropertyOptional({ example: 'ICC110' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tenantCompanyCode?: string | null;

  @ApiPropertyOptional({ example: 'LSYS_ALLIANCE_003' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tenantSystemCode?: string | null;

  @ApiPropertyOptional({ example: 'live' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  tenantEnvironment?: string | null;

  @ApiPropertyOptional({ example: ['tiramis:submit', 'tiramis:read'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
