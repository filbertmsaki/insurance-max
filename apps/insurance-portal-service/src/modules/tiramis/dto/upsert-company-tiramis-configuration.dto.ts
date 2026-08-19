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

  /**
   * The TIRA-issued client secret for this company/environment. Optional on
   * update (blank keeps the existing value on both sides); required the
   * first time a company/environment is linked to TIRAMIS.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  client_key?: string;

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
  base_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  source_service?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  callback_url?: string;

  @IsOptional()
  @IsString()
  tiramis_service_api_key?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  use_as_target_environment?: boolean;

  @IsOptional()
  @IsBoolean()
  confirm_live_activation?: boolean;

  @IsOptional()
  @IsBoolean()
  force_activation?: boolean;
}
