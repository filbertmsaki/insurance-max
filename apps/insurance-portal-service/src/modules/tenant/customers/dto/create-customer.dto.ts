import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { CustomerGender } from '../enums/customer-gender.enum';
import { CustomerIdType } from '../enums/customer-id-type.enum';
import { CustomerPolicyHolderType } from '../enums/customer-policy-holder-type.enum';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const emptyToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

/**
 * Public customer contract. Mirrors the TIRA `PolicyHolder` element
 * field-for-field (snake_case), so the API accepts only what TIRA needs.
 */
export class CreateCustomerDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  policy_holder_name: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'policy_holder_birth_date must use the YYYY-MM-DD format',
  })
  @IsDateString({ strict: true })
  policy_holder_birth_date: string;

  @Type(() => Number)
  @IsInt()
  @IsIn([
    CustomerPolicyHolderType.INDIVIDUAL,
    CustomerPolicyHolderType.CORPORATE,
  ])
  policy_holder_type: CustomerPolicyHolderType;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  policy_holder_id_number: string;

  @Type(() => Number)
  @IsInt()
  @IsEnum(CustomerIdType)
  policy_holder_id_type: CustomerIdType;

  // Mandatory for individuals, optional for corporate entities.
  @Transform(emptyToNull)
  @ValidateIf(
    (o) =>
      o.policy_holder_type === CustomerPolicyHolderType.INDIVIDUAL ||
      (o.gender !== undefined && o.gender !== null),
  )
  @IsEnum(CustomerGender)
  gender?: CustomerGender | null;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z]{3}$/, {
    message: 'country_code must be an ISO 3166-1 alpha-3 code',
  })
  country_code: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  region: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  district: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  street: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  policy_holder_phone_number: string;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  policy_holder_fax?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  postal_address?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email_address?: string | null;

  // Workflow control for the possible-duplicate check, not customer data.
  @IsOptional()
  @IsString()
  @MaxLength(255)
  duplicate_override_reason?: string | null;
}
