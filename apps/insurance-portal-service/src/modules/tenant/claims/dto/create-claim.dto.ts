import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { ClaimantType, ClaimPriority } from '../enums/claim.enums';

export class CreateClaimantDto {
  @IsEnum(ClaimantType)
  claimant_type: ClaimantType;

  @IsOptional()
  @IsUUID()
  customer_id?: string;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @IsString()
  @MaxLength(180)
  full_name: string;

  @IsOptional()
  @IsString()
  identification_type?: string;

  @IsOptional()
  @IsString()
  identification_number?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  amount_claimed?: string | number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateClaimDto {
  @IsUUID()
  policy_id: string;

  @IsOptional()
  @IsUUID()
  policy_risk_id?: string;

  @IsString()
  loss_date: string;

  @IsString()
  @MaxLength(150)
  loss_nature: string;

  @IsString()
  @MaxLength(100)
  loss_type: string;

  @IsString()
  loss_location: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  cause_of_loss?: string;

  @IsOptional()
  @IsString()
  police_report_number?: string;

  @IsOptional()
  estimated_amount?: string | number;

  @IsOptional()
  @IsEnum(ClaimPriority)
  priority?: ClaimPriority;

  @IsOptional()
  @IsBoolean()
  claim_form_dully_filled?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateClaimantDto)
  claimants: CreateClaimantDto[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
