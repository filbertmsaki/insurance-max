import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsIP,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const TIRAMIS_API_KEY_SCOPES = [
  'tiramis:prepare',
  'tiramis:submit',
  'tiramis:read',
  'tiramis:verify',
  'tiramis:callback:test',
] as const;

export class CreateTiramisApiKeyDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(120)
  serviceName!: string;

  @ApiProperty({ example: ['203.0.113.10', '2001:db8::10'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsIP(undefined, { each: true })
  allowedIps!: string[];

  @ApiProperty({
    example: ['tiramis:submit', 'tiramis:read'],
    enum: TIRAMIS_API_KEY_SCOPES,
    isArray: true,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(TIRAMIS_API_KEY_SCOPES, { each: true })
  scopes!: string[];

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
