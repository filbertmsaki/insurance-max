import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  PortalPaymentProofStatus,
  PortalRequestStatus,
  PortalRequestType,
} from '../enums/portal.enums';

export class CreatePolicyPortalRequestDto {
  @IsUUID()
  policy_id: string;

  @IsEnum(PortalRequestType)
  request_type:
    | PortalRequestType.ENDORSEMENT
    | PortalRequestType.CANCELLATION
    | PortalRequestType.RENEWAL;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  subject: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description: string;

  @IsOptional()
  @IsObject()
  requested_changes?: Record<string, unknown>;
}

export class CreateClaimNotificationDto {
  @IsUUID()
  policy_id: string;

  @IsDateString()
  loss_date: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  loss_location: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  loss_description: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  police_reference?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  estimated_loss_amount?: number;
}

export class CreateQuotationAssistanceDto {
  @IsUUID()
  quotation_id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  subject: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description: string;
}

export class CreatePaymentProofDto {
  @IsUUID()
  invoice_id: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  amount: number;

  @IsDateString()
  payment_date: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  payment_reference?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description: string;
}

export class PortalRequestFilterDto {
  @IsOptional()
  @IsEnum(PortalRequestType)
  request_type?: PortalRequestType;

  @IsOptional()
  @IsEnum(PortalRequestStatus)
  status?: PortalRequestStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export class AssignPortalRequestDto {
  @IsUUID()
  assigned_to: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}

export class TransitionPortalRequestDto {
  @IsEnum(PortalRequestStatus)
  status: PortalRequestStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class CompletePortalRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  /**
   * Examples: CLAIM, POLICY_ENDORSEMENT, POLICY_RENEWAL,
   * POLICY_CANCELLATION, RECEIPT
   */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  result_type?: string;

  /** UUID of the operational record created by the internal module. */
  @IsOptional()
  @IsUUID()
  result_id?: string;

  /** Human-readable reference such as CLM-2026-000001, END-2026-000004. */
  @IsOptional()
  @IsString()
  @MaxLength(150)
  result_reference?: string;
}

export class ReviewPaymentProofDto {
  @IsEnum(PortalPaymentProofStatus)
  status:
    | PortalPaymentProofStatus.VERIFIED
    | PortalPaymentProofStatus.REJECTED;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class UploadPortalAttachmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  document_type: string;
}
