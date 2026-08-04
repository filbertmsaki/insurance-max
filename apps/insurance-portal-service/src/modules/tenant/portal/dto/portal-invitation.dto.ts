import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsStrongPassword,
  IsUUID,
  MaxLength,
} from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class InviteCustomerPortalDto {
  @IsUUID()
  customer_id: string;

  // Optional: when omitted, the service resolves the email from the
  // Customer record.
  @IsOptional()
  @IsEmail()
  @Transform(normalizeEmail)
  email?: string;
}

export class InviteIntermediaryPortalDto {
  @IsEmail()
  @Transform(normalizeEmail)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  first_name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  last_name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone: string;
}

export class AcceptPortalInvitationDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  // Optional: an invitation may link to an existing user account. Required
  // by the service when no existing user is found.
  @IsOptional()
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  password?: string;

  @IsBoolean()
  accept_terms: boolean;

  @IsBoolean()
  accept_privacy: boolean;
}

export class SuspendPortalAccountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}
