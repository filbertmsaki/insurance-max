import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ProposePartnerAmendmentDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  commission_rate?: number | null;

  @IsOptional()
  @IsDateString()
  start_date?: string | null;

  @IsOptional()
  @IsDateString()
  end_date?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  agreement_reference?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  agreement_document_url?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

export class RespondPartnerAmendmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string | null;
}
