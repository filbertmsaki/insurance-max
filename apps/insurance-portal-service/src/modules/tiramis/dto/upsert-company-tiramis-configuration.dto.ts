import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
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
  environment: 'local' | 'uat' | 'production';

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

  /**
   * Default TIRA sale point for this company, used only when a request has no
   * branch sale point. The TIRA system identity (client code/key, system
   * code/name, certificates, URLs) is platform-wide and not set per company.
   */
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MaxLength(12)
  sale_point_code?: string;

  /** Defaults to the insurer company code. */
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MaxLength(6)
  tran_company_code?: string;

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
