import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateReceiptDto {
  @IsUUID()
  customer_id: string;

  @IsOptional()
  @IsUUID()
  invoice_id?: string | null;

  @IsString()
  @MaxLength(50)
  payment_method: string;

  @IsOptional()
  amount?: number | string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  payment_reference?: string | null;

  @IsOptional()
  @IsUUID()
  received_by?: string | null;

  @IsOptional()
  @IsDateString()
  received_at?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;
}
