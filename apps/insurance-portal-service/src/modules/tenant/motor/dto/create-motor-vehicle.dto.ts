import { IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateMotorVehicleDto {
  @IsUUID()
  customer_id: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  registration_no?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  chassis_no?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  engine_no?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  make?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  body_type?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string | null;

  @IsOptional()
  @IsInt()
  manufacture_year?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  usage_type?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  vehicle_category?: string | null;

  @IsOptional()
  @IsInt()
  seating_capacity?: number | null;

  @IsOptional()
  tonnage?: number | string | null;

  @IsOptional()
  @IsInt()
  cubic_capacity?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  fuel_type?: string | null;

  @IsOptional()
  vehicle_value?: number | string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
