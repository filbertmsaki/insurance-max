import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { UserPermissionGrantDto } from './user-access.dto';
import { QuotationPolicyDataScope } from '../../../shared/authorization/quotation-policy-data-scope.enum';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @IsString()
  @IsNotEmpty()
  last_name: string;

  @IsPhoneNumber()
  @IsNotEmpty()
  phone: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsNotEmpty()
  officer_title: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  branch_ids: string[];

  @IsUUID()
  active_branch_id: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  department_ids?: string[];

  @IsOptional()
  @IsUUID()
  active_department_id?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  role_ids?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserPermissionGrantDto)
  permission_grants?: UserPermissionGrantDto[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  excluded_permission_ids?: string[];

  @IsOptional()
  @IsEnum(QuotationPolicyDataScope)
  quotation_policy_data_scope?: QuotationPolicyDataScope;

  @IsOptional()
  @IsBoolean()
  insurance_channel_access?: boolean;
}
