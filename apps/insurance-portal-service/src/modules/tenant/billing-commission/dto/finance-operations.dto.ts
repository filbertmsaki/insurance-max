import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class IssueInvoiceDto {
  @IsOptional()
  @IsDateString()
  due_date?: string;
}

export class VoidInvoiceDto {
  @IsString()
  @MaxLength(1000)
  reason: string;
}

export class PostReceiptDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  posting_reference?: string;
}

export class AllocateReceiptDto {
  @IsUUID()
  invoice_id: string;

  amount: string | number;
}

export class ReverseFinancialRecordDto {
  @IsString()
  @MaxLength(1000)
  reason: string;
}
