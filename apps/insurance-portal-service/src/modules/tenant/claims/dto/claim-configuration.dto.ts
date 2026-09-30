import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { ClaimApprovalType } from '../enums/claim.enums';
import { CLAIM_DOCUMENT_STAGES } from '../services/claim-document.service';
import { IsMoneyAmount } from './claim-validators';

export class SaveClaimApprovalLimitDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsEnum(ClaimApprovalType)
  approval_type: ClaimApprovalType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  level: number;

  @IsOptional()
  @IsUUID()
  role_id?: string | null;

  @IsOptional()
  @IsUUID()
  user_id?: string | null;

  @IsOptional()
  @IsUUID()
  insurance_category_id?: string | null;

  @IsOptional()
  @IsUUID()
  product_id?: string | null;

  @IsOptional()
  @IsUUID()
  branch_id?: string | null;

  @IsMoneyAmount()
  min_amount: string;

  @IsOptional()
  @IsMoneyAmount()
  max_amount?: string | null;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency_code?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string | null;
}

export class SaveClaimDocumentRequirementDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsOptional()
  @IsUUID()
  insurance_category_id?: string | null;

  @IsOptional()
  @IsUUID()
  product_id?: string | null;

  @IsIn(CLAIM_DOCUMENT_STAGES)
  claim_stage: string;

  @IsString()
  @MaxLength(80)
  document_type: string;

  @IsString()
  @MaxLength(180)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  is_mandatory?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class ClaimsDashboardQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsOptional()
  @IsUUID()
  product_id?: string;
}

export class ClaimDocumentsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class SaveClaimNumberFormatDto {
  @IsString()
  @MaxLength(60)
  document_type: string;

  @IsString()
  @Length(1, 40)
  prefix: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(10)
  sequence_length?: number;
}
