import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreateCommissionPaymentItemDto {
  @IsUUID()
  commission_transaction_id: string;

  @IsOptional()
  amount?: number | string | null;
}

export class CreateCommissionPaymentDto {
  @IsUUID()
  intermediary_company_id: string;

  @IsString()
  @MaxLength(50)
  payment_no: string;

  @IsString()
  @MaxLength(50)
  payment_method: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  payment_reference?: string | null;

  @IsOptional()
  total_amount?: number | string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;

  @IsOptional()
  @IsUUID()
  approved_by?: string | null;

  @IsOptional()
  @IsUUID()
  paid_by?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCommissionPaymentItemDto)
  items?: CreateCommissionPaymentItemDto[];
}
