import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PartnerType } from '../enums/partner-type.enum';

export class CreateInsurancePartnerDto {
  @IsUUID()
  insurer_company_id: string;

  @IsUUID()
  intermediary_company_id: string;

  @IsEnum(PartnerType)
  partner_type: PartnerType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  commission_rate?: number;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsString()
  agreement_reference?: string;

  @IsOptional()
  @IsString()
  agreement_document_url?: string;
}
