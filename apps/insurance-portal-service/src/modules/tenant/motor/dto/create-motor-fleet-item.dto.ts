import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateMotorFleetItemDto {
  @IsUUID()
  motor_vehicle_id: string;

  @IsOptional()
  @IsUUID()
  quotation_entry_risk_id?: string | null;

  @IsOptional()
  @IsUUID()
  policy_risk_id?: string | null;

  @IsOptional()
  sum_insured?: number | string | null;

  @IsOptional()
  premium?: number | string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;
}
