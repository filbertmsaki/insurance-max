import {
  IsDateString,
  IsDefined,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { SaasInvoiceAdjustmentType } from '../enums/saas-billing.enums';

export class CreateSubscriptionDto {
  @IsUUID()
  company_id: string;

  @IsUUID()
  plan_id: string;

  @IsOptional()
  @IsDateString()
  started_at?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class SuspendSubscriptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class SchedulePlanChangeDto {
  @IsUUID()
  plan_id: string;

  @IsOptional()
  @IsDateString()
  effective_at?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ScheduleCancellationDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RecordSaasPaymentDto {
  @IsDefined()
  amount: string | number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  payment_reference: string;

  @IsOptional()
  @IsDateString()
  payment_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ReverseSaasPaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class VoidSaasInvoiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class CreateSaasInvoiceAdjustmentDto {
  @IsEnum(SaasInvoiceAdjustmentType)
  adjustment_type: SaasInvoiceAdjustmentType;

  @IsDefined()
  amount: string | number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
