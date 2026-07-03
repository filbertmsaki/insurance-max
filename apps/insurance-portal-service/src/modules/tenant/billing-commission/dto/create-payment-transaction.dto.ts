import { IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreatePaymentTransactionDto {
  @IsOptional()
  @IsUUID()
  invoice_id?: string | null;

  @IsOptional()
  @IsUUID()
  receipt_id?: string | null;

  @IsString()
  @MaxLength(50)
  provider: string;

  @IsString()
  @MaxLength(100)
  provider_reference: string;

  @IsString()
  @MaxLength(100)
  internal_reference: string;

  @IsOptional()
  amount?: number | string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;

  @IsOptional()
  @IsObject()
  request_payload?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  response_payload?: Record<string, unknown> | null;
}
