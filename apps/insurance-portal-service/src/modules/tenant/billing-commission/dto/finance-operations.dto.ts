import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

import { PaymentMethod } from '@insurance-max/contracts';

export class IssueInvoiceDto {
  @IsInt()
  @Min(1)
  expected_state_version: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  idempotency_key: string;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class VoidInvoiceDto {
  @IsString()
  @MaxLength(1000)
  reason: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  idempotency_key: string;
}

export class RecordPaymentTransactionDto {
  @IsOptional()
  @IsUUID()
  invoice_id?: string;

  @IsOptional()
  @IsUUID()
  customer_id?: string;

  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  provider_code: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  provider_transaction_id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  payment_reference: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @Transform(({ value }) => String(value).trim().toUpperCase())
  @Matches(/^[A-Z]{3}$/)
  currency_code: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0000000001)
  exchange_rate?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  payer_name: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  payer_phone?: string;

  @IsOptional()
  @IsEmail()
  payer_email?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  idempotency_key: string;
}

export class PostReceiptDto {
  @IsUUID()
  payment_transaction_id: string;

  @IsOptional()
  @IsUUID()
  invoice_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  allocation_amount?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  idempotency_key: string;
}

export class AllocateReceiptDto {
  @IsUUID()
  invoice_id: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  idempotency_key: string;
}

export class ReverseAllocationDto {
  @IsString()
  @MaxLength(1000)
  reason: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  idempotency_key: string;
}

export class ReverseReceiptDto {
  @IsString()
  @MaxLength(1000)
  reason: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  idempotency_key: string;
}

export class RequestRefundDto {
  @IsUUID()
  receipt_id: string;

  @IsOptional()
  @IsUUID()
  invoice_id?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  idempotency_key: string;
}

export class ApproveRefundDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  idempotency_key: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class PayRefundDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  idempotency_key: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  provider_refund_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CancelRefundDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  idempotency_key: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}

export class CreateReconciliationBatchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  provider_code: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  account_reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  statement_reference?: string;

  @IsDateString()
  statement_date: string;

  @Transform(({ value }) => String(value).trim().toUpperCase())
  @Matches(/^[A-Z]{3}$/)
  currency_code: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  opening_balance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  closing_balance?: number;
}

export class ImportReconciliationLineDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  line_number?: number;

  @IsDateString()
  transaction_date: string;

  @IsOptional()
  @IsDateString()
  value_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  external_reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  payer_reference?: string;

  @Type(() => Number)
  @IsNumber()
  amount: number;

  @Transform(({ value }) => String(value).trim().toUpperCase())
  @Matches(/^[A-Z]{3}$/)
  currency_code: string;
}

export class ImportReconciliationBatchDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ImportReconciliationLineDto)
  items: ImportReconciliationLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  file_hash?: string;
}

export class MatchReconciliationItemDto {
  @IsOptional()
  @IsUUID()
  payment_transaction_id?: string;

  @IsOptional()
  @IsUUID()
  receipt_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class ExcludeReconciliationItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class ApproveReconciliationBatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class PostReconciliationBatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CommissionPaymentAllocationDto {
  @IsUUID()
  commission_transaction_id: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;
}

export class ApproveCommissionAccrualDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  idempotency_key: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ReverseCommissionAccrualDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  idempotency_key: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}

export class CreateCommissionPaymentCommandDto {
  @IsUUID()
  intermediary_company_id: string;

  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  payment_reference: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @Transform(({ value }) => String(value).trim().toUpperCase())
  @Matches(/^[A-Z]{3}$/)
  currency_code: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CommissionPaymentAllocationDto)
  allocations: CommissionPaymentAllocationDto[];

  @IsString()
  @IsNotEmpty()
  idempotency_key: string;
}

export class ApproveCommissionPaymentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  idempotency_key: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class PayCommissionPaymentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  idempotency_key: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ReverseCommissionPaymentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  idempotency_key: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}
