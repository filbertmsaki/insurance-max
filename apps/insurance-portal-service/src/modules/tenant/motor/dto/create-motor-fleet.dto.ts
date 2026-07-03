import { IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateMotorFleetDto {
  @IsUUID()
  customer_id: string;

  @IsOptional()
  @IsUUID()
  quotation_id?: string | null;

  @IsOptional()
  @IsUUID()
  policy_id?: string | null;

  @IsString()
  @MaxLength(50)
  fleet_no: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  fleet_name?: string | null;

  @IsOptional()
  @IsInt()
  total_vehicles?: number;

  @IsOptional()
  total_sum_insured?: number | string | null;

  @IsOptional()
  total_premium?: number | string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;
}
