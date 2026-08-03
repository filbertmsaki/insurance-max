import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

import { DischargeResponse } from '../enums/claim.enums';

export class CreateClaimIntimationDto {
  @IsOptional()
  claim_estimated_amount?: string | number;

  claim_reserve_amount: string | number;

  @IsString()
  @MaxLength(100)
  claim_reserve_method: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  loss_assessment_option?: number;

  @IsOptional()
  @IsString()
  assessor_name?: string;

  @IsOptional()
  @IsString()
  assessor_id_number?: string;

  @IsOptional()
  @IsInt()
  assessor_id_type?: number;
}

export class CreateClaimReserveDto {
  @IsString()
  reserve_type: string;

  amount: string | number;

  @IsString()
  reason: string;

  @IsOptional()
  @IsDateString()
  effective_at?: string;
}

export class ClaimDecisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class AssignClaimDto {
  @IsUUID()
  assigned_user_id: string;

  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsOptional()
  @IsString()
  instructions?: string;
}

export class CreateServiceAssignmentDto {
  @IsOptional()
  @IsUUID()
  provider_company_id?: string;

  @IsOptional()
  @IsUUID()
  assigned_user_id?: string;

  @IsString()
  service_type: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsDateString()
  due_at?: string;

  @IsOptional()
  estimated_fee?: string | number;
}

export class CreateClaimAssessmentDto {
  @IsOptional()
  @IsUUID()
  service_assignment_id?: string;

  @IsDateString()
  assessment_received_date: string;

  @IsString()
  assessment_report_summary: string;

  assessment_amount: string | number;

  approved_claim_amount: string | number;

  @IsOptional()
  @IsBoolean()
  is_re_assessment?: boolean;
}

export class CreateDischargeVoucherDto {
  @IsOptional()
  @IsUUID()
  claimant_id?: string;

  claim_offer_amount: string | number;

  @IsOptional()
  @IsDateString()
  claim_offer_communication_date?: string;
}

export class RespondToDischargeDto {
  @IsOptional()
  @IsUUID()
  signed_document_id?: string;

  @IsEnum(DischargeResponse)
  response: DischargeResponse;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateClaimPaymentDto {
  @IsOptional()
  @IsUUID()
  claimant_id?: string;

  @IsOptional()
  @IsUUID()
  discharge_voucher_id?: string;

  paid_amount: string | number;

  @IsOptional()
  @IsInt()
  payment_mode?: number;

  @IsOptional()
  @IsString()
  payment_method?: string;

  @IsOptional()
  @IsString()
  payment_reference?: string;

  @IsOptional()
  net_premium_earned?: string | number;

  @IsOptional()
  @IsBoolean()
  claim_resulted_litigation?: boolean;

  @IsOptional()
  @IsString()
  litigation_reason?: string;
}

export class MarkClaimPaymentPaidDto {
  @IsString()
  payment_method: string;

  @IsString()
  payment_reference: string;

  @IsOptional()
  @IsDateString()
  payment_date?: string;
}

export class RejectClaimDto {
  @IsString()
  @MaxLength(2000)
  rejection_reason: string;
}

export class CloseClaimDto {
  @IsString()
  @MaxLength(1000)
  closure_reason: string;
}

export class AddClaimDocumentDto {
  @IsString()
  document_type: string;

  @IsOptional()
  @IsString()
  requirement_code?: string;

  @IsString()
  title: string;

  @IsString()
  storage_key: string;

  @IsString()
  file_name: string;

  @IsOptional()
  @IsString()
  mime_type?: string;

  @IsOptional()
  file_size?: number;

  @IsOptional()
  @IsString()
  checksum?: string;

  @IsOptional()
  @IsDateString()
  expires_at?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class VerifyClaimDocumentDto {
  @IsString()
  @IsEnum(['VERIFIED', 'REJECTED'] as const)
  decision: 'VERIFIED' | 'REJECTED';

  @IsOptional()
  @IsString()
  rejection_reason?: string;
}
