import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

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
  @IsString()
  @MaxLength(100)
  model_no?: string | null;

  @IsOptional()
  @IsInt()
  number_of_axles?: number | null;

  @IsOptional()
  axle_distance?: number | string | null;

  @IsOptional()
  tare_weight?: number | string | null;

  @IsOptional()
  gross_weight?: number | string | null;

  @IsOptional()
  @IsInt()
  motor_category?: number | null;

  @IsOptional()
  @IsInt()
  motor_type?: number | null;

  @IsOptional()
  @IsInt()
  motor_usage?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  owner_name?: string | null;

  @IsOptional()
  @IsInt()
  owner_category?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  owner_address?: string | null;

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
