import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateMotorQuotationDetailDto {
  @IsUUID()
  quotation_id: string;

  @IsUUID()
  quotation_risk_id: string;

  @IsUUID()
  motor_vehicle_id: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cover_type?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  usage_type?: string | null;

  @IsOptional()
  no_claim_discount_rate?: number | string | null;

  @IsOptional()
  no_claim_discount_amount?: number | string | null;

  @IsOptional()
  @IsBoolean()
  excess_applicable?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  excess_type?: string | null;

  @IsOptional()
  excess_rate?: number | string | null;

  @IsOptional()
  excess_amount?: number | string | null;
}
