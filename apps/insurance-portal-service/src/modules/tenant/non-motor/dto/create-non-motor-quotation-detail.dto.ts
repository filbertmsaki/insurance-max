import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateNonMotorQuotationDetailDto {
  @IsUUID()
  quotation_id: string;

  @IsUUID()
  quotation_risk_id: string;

  @IsUUID()
  subject_matter_id: string;

  @IsOptional()
  @IsString()
  cover_description?: string | null;

  @IsOptional()
  @IsString()
  risk_location?: string | null;

  @IsOptional()
  insured_value?: number | string | null;

  @IsOptional()
  limit_of_liability?: number | string | null;
}
