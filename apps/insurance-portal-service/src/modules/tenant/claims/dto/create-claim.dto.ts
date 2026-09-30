import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  ClaimantType,
  ClaimPriority,
  TiraClaimantCategory,
  TiraPartyType,
} from '../enums/claim.enums';
import { IsMoneyAmount } from './claim-validators';

/**
 * A claimant as TIRAMIS knows it (§10.1). With `uses_policyholder` the
 * identity and address are copied from the policy's customer and any values
 * sent here are ignored.
 */
export class CreateClaimantDto {
  @IsEnum(ClaimantType)
  claimant_type: ClaimantType;

  @IsOptional()
  @IsBoolean()
  uses_policyholder?: boolean;

  @IsOptional()
  @IsUUID()
  customer_id?: string;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  full_name?: string;

  @IsOptional()
  @IsEnum(TiraClaimantCategory)
  claimant_category?: TiraClaimantCategory;

  @IsOptional()
  @IsEnum(TiraPartyType)
  party_type?: TiraPartyType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  id_type?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  identification_number?: string;

  @IsOptional()
  @IsDateString()
  birth_date?: string;

  @IsOptional()
  @IsIn(['M', 'F'])
  gender?: 'M' | 'F';

  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/)
  country_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  street?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  fax?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  postal_address?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;

  @IsOptional()
  @IsMoneyAmount()
  amount_claimed?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateClaimantDto extends PartialType(CreateClaimantDto) {}

export class CreateClaimDto {
  @IsUUID()
  policy_id: string;

  /** The affected risk; for fleet policies, the single affected vehicle. */
  @IsOptional()
  @IsUUID()
  policy_risk_id?: string;

  @IsDateString()
  loss_date: string;

  @IsOptional()
  @IsDateString()
  claim_report_date?: string;

  @IsString()
  @MaxLength(100)
  loss_nature: string;

  @IsString()
  @MaxLength(100)
  loss_type: string;

  @IsString()
  @MaxLength(100)
  loss_location: string;

  @IsString()
  @MaxLength(5000)
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  claim_title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  cause_of_loss?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  police_report_number?: string;

  @IsOptional()
  @IsMoneyAmount()
  estimated_amount?: string;

  @IsOptional()
  @IsEnum(ClaimPriority)
  priority?: ClaimPriority;

  @IsOptional()
  @IsBoolean()
  claim_form_dully_filled?: boolean;

  @IsOptional()
  @IsIn(['WALK_IN', 'PHONE', 'EMAIL', 'PORTAL', 'INTERMEDIARY', 'OTHER'])
  notification_source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  reporter_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  reporter_phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  reporter_email?: string;

  @IsOptional()
  @IsUUID()
  assigned_user_id?: string;

  @IsOptional()
  @IsUUID()
  department_id?: string;

  /** Class-specific incident data (motor accident, fire, etc.); internal only. */
  @IsOptional()
  @IsObject()
  incident_details?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  internal_notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateClaimantDto)
  claimants: CreateClaimantDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  duplicate_override_reason?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/** Draft edits; policy and claimants are managed through their own routes. */
export class UpdateClaimDto extends PartialType(CreateClaimDto) {}
