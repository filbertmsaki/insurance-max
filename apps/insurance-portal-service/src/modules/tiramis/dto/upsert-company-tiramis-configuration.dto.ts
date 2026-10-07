import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class UpsertCompanyTiramisConfigurationDto {
  @IsOptional()
  @IsArray()
  @IsIn(
    [
      'TIRAMIS_CONNECTION_TEST',
      'TIRAMIS_ACK_RECEIVED',
      'TIRAMIS_ACK_FAILED',
      'TIRAMIS_FINAL_RESPONSE_RECEIVED',
      'TIRAMIS_FINAL_SUCCESS',
      'TIRAMIS_FINAL_FAILED',
      'TIRAMIS_FINAL_CALLBACK_OVERDUE',
      'TIRAMIS_RESPONSE_ACK_SENT',
      'TIRAMIS_CALLBACK_REJECTED',
      'TIRAMIS_SUBMISSION_FAILED',
    ],
    { each: true },
  )
  notification_events?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(['submit', 'read_status', 'receive_notifications'], { each: true })
  integration_permissions?: string[];

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
  @Transform(({ value, obj }) => value ?? obj.allowExpiredCertificates)
  @IsBoolean()
  allow_expired_certificates?: boolean;

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
