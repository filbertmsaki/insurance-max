import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ProductChannelType } from '../../product-distribution/enums/product-channel-type.enum';
import { QuotationFlow } from '../enums/quotation-flow.enum';
import { QuotationType } from '../enums/quotation-type.enum';

export class SaveQuotationDraftDto {
  @IsOptional()
  @IsUUID()
  insurer_company_id?: string | null;

  @IsOptional()
  @IsUUID()
  intermediary_company_id?: string | null;

  @IsOptional()
  @IsUUID()
  branch_id?: string | null;

  @IsOptional()
  @IsUUID()
  department_id?: string | null;

  @IsOptional()
  @IsUUID()
  customer_id?: string | null;

  @IsUUID()
  category_id!: string;

  @IsUUID()
  product_id!: string;

  @IsOptional()
  @IsUUID()
  sub_class_id?: string | null;

  @IsEnum(QuotationType)
  quotation_type!: QuotationType;

  @IsEnum(QuotationFlow)
  quotation_flow!: QuotationFlow;

  @IsEnum(ProductChannelType)
  channel_type!: ProductChannelType;

  @IsBoolean()
  is_fleet!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  current_wizard_step?: string | null;

  @IsObject()
  draft_payload!: Record<string, unknown>;
}

export class UpdateQuotationDraftDto extends SaveQuotationDraftDto {
  @IsOptional()
  @IsDateString()
  expected_updated_at?: string;
}

export class CancelQuotationDto {
  @IsString()
  @MaxLength(1000)
  cancellation_reason!: string;
}
