import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreateInvoiceItemDto {
  @IsString()
  @MaxLength(50)
  item_type: string;

  @IsString()
  @MaxLength(150)
  item_name: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  quantity?: number | string | null;

  @IsOptional()
  unit_amount?: number | string | null;

  @IsOptional()
  total_amount?: number | string | null;
}

export class CreateInvoiceDto {
  @IsUUID()
  insurer_company_id: string;

  @IsOptional()
  @IsUUID()
  intermediary_company_id?: string | null;

  @IsUUID()
  customer_id: string;

  @IsOptional()
  @IsUUID()
  quotation_id?: string | null;

  @IsOptional()
  @IsUUID()
  policy_id?: string | null;

  @IsOptional()
  @IsUUID()
  endorsement_id?: string | null;

  @IsOptional()
  @IsUUID()
  cancellation_id?: string | null;

  @IsOptional()
  @IsUUID()
  renewal_id?: string | null;

  @IsString()
  @MaxLength(30)
  invoice_type: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  gross_amount?: number | string | null;

  @IsOptional()
  discount_amount?: number | string | null;

  @IsOptional()
  tax_amount?: number | string | null;

  @IsOptional()
  charges_amount?: number | string | null;

  @IsOptional()
  total_amount?: number | string | null;

  @IsOptional()
  paid_amount?: number | string | null;

  @IsOptional()
  balance_amount?: number | string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;

  @IsOptional()
  @IsDateString()
  due_date?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items?: CreateInvoiceItemDto[];
}
