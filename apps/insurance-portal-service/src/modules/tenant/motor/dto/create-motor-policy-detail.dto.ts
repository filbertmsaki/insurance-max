import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateMotorPolicyDetailDto {
  @IsUUID()
  policy_id: string;

  @IsUUID()
  policy_risk_id: string;

  @IsUUID()
  motor_vehicle_id: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cover_type?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  usage_type?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  certificate_no?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sticker_no?: string | null;
}
