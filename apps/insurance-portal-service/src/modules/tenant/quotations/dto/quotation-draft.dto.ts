import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { UnderwriteCover } from '@insurance-max/contracts';
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

  /**
   * Cover the client is quoting (e.g. SHORT_TERM_SINGLE). Only decides a
   * draft that has no risk yet, and must fit the flow and product; once
   * risks exist the server classifies the cover from them.
   */
  @IsOptional()
  @IsIn(Object.values(UnderwriteCover))
  underwrite_cover?: string | null;
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
