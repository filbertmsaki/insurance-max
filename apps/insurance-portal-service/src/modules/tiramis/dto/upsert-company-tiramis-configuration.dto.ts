import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class UpsertCompanyTiramisConfigurationDto {
  @IsOptional()
  @IsIn(['test', 'live'])
  environment: 'test' | 'live';

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  company_code: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MaxLength(30)
  insurer_company_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  client_code?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  system_code: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  system_name?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  callback_url?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
