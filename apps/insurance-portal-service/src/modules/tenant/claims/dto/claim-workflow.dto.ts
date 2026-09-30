import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { ClaimQueue, DischargeResponse } from '../enums/claim.enums';
import { IsExchangeRate, IsMoneyAmount } from './claim-validators';

export class TiramisSubmitOptionsDto {
  /** Resubmit after a failed or rejected TIRA attempt. */
  @IsOptional()
  @IsBoolean()
  retry?: boolean;
}

export class CreateClaimIntimationDto {
  @IsOptional()
  @IsMoneyAmount()
  claim_estimated_amount?: string;

  @IsMoneyAmount()
  claim_reserve_amount: string;

  @IsString()
  @MaxLength(100)
  claim_reserve_method: string;

  @IsOptional()
  @IsDateString()
  claim_intimation_date?: string;

  @IsOptional()
  @IsExchangeRate()
  exchange_rate?: string;

  /** 1 = in-house insurer employee, 2 = external registered adjuster. */
  @IsInt()
  @IsIn([1, 2])
  loss_assessment_option: number;

  @IsOptional()
  @IsUUID()
  assessor_user_id?: string;

  @IsOptional()
  @IsUUID()
  assessor_company_id?: string;

  @IsString()
  @MaxLength(100)
  assessor_name: string;

  @IsString()
  @MaxLength(50)
  assessor_id_number: string;

  @IsInt()
  @Min(1)
  @Max(7)
  assessor_id_type: number;
}

export class UpdateClaimIntimationDto extends PartialType(
  CreateClaimIntimationDto,
) {}

export class CreateClaimReserveDto {
  @IsIn(['INITIAL', 'INCREASE', 'DECREASE'])
  reserve_type: 'INITIAL' | 'INCREASE' | 'DECREASE';

  @IsMoneyAmount()
  amount: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;

  @IsOptional()
  @IsDateString()
  effective_at?: string;
}

export class ReleaseReserveDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;
}

export class ApprovalActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comments?: string;
}

export class ApprovalDeclineDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  comments: string;

  /** RETURN sends the item back for rework instead of declining it. */
  @IsOptional()
  @IsIn(['REJECT', 'RETURN'])
  decision?: 'REJECT' | 'RETURN';
}

export class AssignClaimDto {
  @IsUUID()
  assigned_user_id: string;

  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
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
  @MaxLength(80)
  service_type: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructions?: string;

  @IsOptional()
  @IsDateString()
  due_at?: string;

  @IsOptional()
  @IsMoneyAmount()
  estimated_fee?: string;
}

export class CreateClaimAssessmentDto {
  @IsOptional()
  @IsUUID()
  service_assignment_id?: string;

  @IsDateString()
  assessment_received_date: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  assessment_report_summary: string;

  @IsMoneyAmount()
  assessment_amount: string;

  @IsMoneyAmount()
  approved_claim_amount: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  assessor_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  assessor_company?: string;

  @IsOptional()
  @IsDateString()
  inspection_date?: string;

  @IsOptional()
  @IsMoneyAmount()
  recommended_amount?: string;

  @IsOptional()
  @IsMoneyAmount()
  deductible_amount?: string;

  @IsOptional()
  @IsMoneyAmount()
  salvage_amount?: string;

  @IsOptional()
  @IsMoneyAmount()
  contribution_amount?: string;

  @IsOptional()
  @IsMoneyAmount()
  betterment_amount?: string;

  @IsOptional()
  @IsMoneyAmount()
  recovery_amount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  remarks?: string;
}

export class UpdateClaimAssessmentDto extends PartialType(
  CreateClaimAssessmentDto,
) {}

export class CreateDischargeVoucherDto {
  @IsOptional()
  @IsUUID()
  claimant_id?: string;

  @IsMoneyAmount()
  claim_offer_amount: string;

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
  @IsDateString()
  claimant_response_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class AdjustDischargeVoucherDto {
  @IsOptional()
  @IsDateString()
  adjustment_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adjustment_reason?: string;

  @IsOptional()
  @IsMoneyAmount()
  adjustment_amount?: string;

  @IsOptional()
  @IsDateString()
  reconciliation_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reconciliation_summary?: string;

  @IsOptional()
  @IsMoneyAmount()
  reconciled_amount?: string;
}

export class CreateClaimPaymentDto {
  @IsOptional()
  @IsUUID()
  claimant_id?: string;

  @IsOptional()
  @IsUUID()
  discharge_voucher_id?: string;

  @IsMoneyAmount()
  paid_amount: string;

  /** 1 = Cash, 2 = Cheque, 3 = EFT (TIRAMIS §13.1). */
  @IsInt()
  @IsIn([1, 2, 3])
  payment_mode: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  payment_method?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  payment_reference?: string;

  @IsOptional()
  @IsIn(['CLAIMANT', 'GARAGE', 'HOSPITAL', 'ASSESSOR', 'OTHER'])
  payee_type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  payee_name?: string;

  @IsOptional()
  @IsObject()
  payee_bank_details?: Record<string, unknown>;

  @IsOptional()
  @IsIn(['Y', 'N'])
  parties_notified?: 'Y' | 'N';

  @IsOptional()
  @IsBoolean()
  claim_resulted_litigation?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  litigation_reason?: string;
}

export class CreateClaimRejectionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  rejection_reason: string;

  /** Reason sent to TIRA; TIRAMIS limits RejectionReason to 100 characters. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  tira_rejection_reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  recommendation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  policy_clause_reference?: string;

  @IsOptional()
  @IsBoolean()
  claim_resulted_litigation?: boolean;

  @IsOptional()
  @IsMoneyAmount()
  claim_amount?: string;
}

export class CloseClaimDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  closure_reason: string;
}

export class ReopenClaimDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}

export class AddClaimDocumentDto {
  @IsString()
  @MaxLength(80)
  document_type: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  requirement_code?: string;

  @IsString()
  @MaxLength(180)
  title: string;

  @IsString()
  @MaxLength(255)
  file_name: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mime_type?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  file_size?: number;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  checksum?: string;

  @IsOptional()
  @IsDateString()
  expires_at?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ClaimDocumentUploadSessionDto {
  @IsString()
  @MaxLength(80)
  document_type: string;

  @IsString()
  @MaxLength(180)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  requirement_code?: string;

  /** Claim stage the document supports, e.g. NOTIFICATION or ASSESSMENT. */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  claim_stage?: string;

  @IsOptional()
  @IsUUID()
  subject_id?: string;
}

export class LinkClaimDocumentDto {
  @IsUUID()
  document_id: string;

  @IsString()
  @MaxLength(80)
  document_type: string;

  @IsString()
  @MaxLength(180)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  requirement_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  claim_stage?: string;

  @IsOptional()
  @IsUUID()
  subject_id?: string;
}

export class VerifyClaimDocumentDto {
  @IsIn(['VERIFIED', 'REJECTED'])
  decision: 'VERIFIED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rejection_reason?: string;
}

export class ClaimQueueQueryDto {
  @IsOptional()
  @IsEnum(ClaimQueue)
  queue?: ClaimQueue;
}
