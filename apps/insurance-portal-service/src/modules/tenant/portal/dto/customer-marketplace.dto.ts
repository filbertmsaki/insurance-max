import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

import { MotorVerificationCategory } from '../../verifications/dto/verify.dto';

export class CustomerCompanyProductQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  motor_only?: boolean;
}

export class CustomerCompanyRiskQueryDto {
  @IsOptional()
  @IsUUID()
  sub_class_id?: string;
}

export class CustomerCoverCheckDto {
  @IsOptional()
  @IsEnum(MotorVerificationCategory)
  motorCategory?: MotorVerificationCategory;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  registration_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  chassis_number?: string;
}
