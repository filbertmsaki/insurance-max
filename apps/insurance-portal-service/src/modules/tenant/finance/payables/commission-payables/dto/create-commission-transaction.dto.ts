import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateCommissionTransactionDto {
  @IsUUID()
  insurer_company_id: string;

  @IsUUID()
  intermediary_company_id: string;

  @IsUUID()
  policy_id: string;

  @IsOptional()
  @IsUUID()
  invoice_id?: string | null;

  @IsOptional()
  @IsUUID()
  receipt_id?: string | null;

  @IsOptional()
  @IsUUID()
  commission_rule_id?: string | null;

  @IsString()
  @MaxLength(30)
  commission_type: string;

  @IsString()
  @MaxLength(30)
  calculation_base: string;

  @IsOptional()
  gross_premium?: number | string | null;

  @IsOptional()
  net_premium?: number | string | null;

  @IsOptional()
  commission_rate?: number | string | null;

  @IsOptional()
  commission_amount?: number | string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;

  @IsOptional()
  @IsDateString()
  earned_at?: string | null;

  @IsOptional()
  @IsDateString()
  paid_at?: string | null;
}
