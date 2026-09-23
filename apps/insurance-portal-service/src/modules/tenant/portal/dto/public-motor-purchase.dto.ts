import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MotorVerificationCategory } from '../../verifications/dto/verify.dto';

export class PublicMotorVerifyDto {
  @IsOptional()
  @IsUUID()
  company_id?: string;

  @IsString()
  @MaxLength(200)
  full_name!: string;

  @IsString()
  @MaxLength(50)
  registration_number!: string;

  @IsString()
  @MaxLength(30)
  phone!: string;

  @IsOptional()
  @IsEnum(MotorVerificationCategory)
  motor_category?: MotorVerificationCategory;
}

export class PublicMotorVehicleDto {
  @IsEnum(MotorVerificationCategory)
  motor_category!: MotorVerificationCategory;

  @IsInt()
  @Min(1)
  motor_type!: number;

  @IsString()
  @MaxLength(50)
  registration_number!: string;

  @IsString()
  @MaxLength(100)
  chassis_number!: string;

  @IsString()
  @MaxLength(100)
  make!: string;

  @IsString()
  @MaxLength(100)
  model!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  model_number?: string | null;

  @IsString()
  @MaxLength(100)
  body_type!: string;

  @IsString()
  @MaxLength(50)
  color!: string;

  @IsString()
  @MaxLength(100)
  engine_number!: string;

  @IsString()
  @MaxLength(50)
  engine_capacity!: string;

  @IsString()
  @MaxLength(50)
  fuel_used!: string;

  @IsInt()
  @Min(1)
  number_of_axles!: number;

  @IsNumber()
  @Min(0)
  axle_distance!: number;

  @IsInt()
  @Min(1)
  sitting_capacity!: number;

  @IsInt()
  @Min(1886)
  @Max(2100)
  year_of_manufacture!: number;

  @IsNumber()
  @Min(0)
  tare_weight!: number;

  @IsNumber()
  @Min(0)
  gross_weight!: number;

  @IsInt()
  @Min(1)
  motor_usage!: number;

  @IsString()
  @MaxLength(200)
  owner_name!: string;

  @IsInt()
  @Min(1)
  owner_category!: number;

  @IsString()
  @MaxLength(300)
  owner_address!: string;
}

export class PublicMotorPolicyHolderDto {
  @IsInt()
  @Min(1)
  policy_holder_type!: number;

  @IsString()
  @MaxLength(200)
  policy_holder_name!: string;

  @IsDateString()
  policy_holder_birth_date!: string;

  @IsInt()
  @Min(1)
  policy_holder_id_type!: number;

  @IsString()
  @MaxLength(100)
  policy_holder_id_number!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1)
  gender?: 'M' | 'F' | null;

  @IsString()
  @MaxLength(3)
  country_code!: string;

  @IsString()
  @MaxLength(100)
  region!: string;

  @IsString()
  @MaxLength(100)
  district!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  street?: string | null;

  @IsString()
  @MaxLength(30)
  policy_holder_phone_number!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  policy_holder_fax?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  postal_address?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email_address?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tin?: string | null;
}

export class PublicMotorQuoteDto {
  @IsUUID()
  company_id!: string;

  @IsUUID()
  product_id!: string;

  @IsUUID()
  risk_id!: string;

  @ValidateNested()
  @Type(() => PublicMotorVehicleDto)
  vehicle!: PublicMotorVehicleDto;

  @ValidateNested()
  @Type(() => PublicMotorPolicyHolderDto)
  policy_holder!: PublicMotorPolicyHolderDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sum_insured?: number;

  @IsOptional()
  @IsObject()
  factors?: Record<string, string | number | boolean>;

  @IsOptional()
  @IsDateString()
  cover_start_date?: string;

  @IsOptional()
  @IsDateString()
  cover_end_date?: string;
}

export class PublicMotorSubmitDto extends PublicMotorQuoteDto {
  @IsBoolean()
  confirmed!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotency_key?: string;
}
