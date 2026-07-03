import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsStrongPassword,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    return value.trim();
  })
  company_name: string;

  @IsEnum(CompanyType)
  company_type: CompanyType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tira_license_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  tira_license_status?: string;

  @IsOptional()
  @IsDateString()
  license_issued_at?: string;

  @IsOptional()
  @IsDateString()
  license_expires_at?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  brela_registration_number?: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  })
  @Matches(/^[A-Za-z\s]+$/, {
    message:
      'Administrator first name can only contain letters and spaces',
  })
  admin_first_name: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  })
  @Matches(/^[A-Za-z\s]+$/, {
    message:
      'Administrator last name can only contain letters and spaces',
  })
  admin_last_name: string;

  @IsEmail()
  @IsNotEmpty()
  admin_email: string;

  @IsString()
  @IsNotEmpty({ message: 'Administrator phone number is required' })
  @Transform(({ value }: TransformFnParams) => {
    if (typeof value !== 'string') return value;
    return value.replace(/\s+/g, '').trim();
  })
  @Matches(/^(0\d{9}|255\d{9}|\+255\d{9})$/, {
    message:
      'Phone number must be valid Tanzanian format: ' +
      '10 digits starting with 0, 12 digits starting with 255, ' +
      'or 13 characters starting with +255',
  })
  admin_phone: string;

  @IsNotEmpty()
  @MinLength(8)
  @IsStrongPassword(
    {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    },
    {
      message:
        'Password must be at least 8 characters long and contain at least ' +
        'one uppercase letter, one lowercase letter, one number, and one special character.',
    },
  )
  admin_password: string;
}
