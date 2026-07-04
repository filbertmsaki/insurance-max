import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { IsAfter } from '@insurance-max/portal-shared/validators/is-after.validator';
import { ProductChannelType } from '../../product-distribution/enums/product-channel-type.enum';
import { QuotationCalculationBase } from '../enums/quotation-calculation-base.enum';
import { QuotationPremiumItemType } from '../enums/quotation-premium-item-type.enum';
import { QuotationStatus } from '../enums/quotation-status.enum';
import { QuotationType } from '../enums/quotation-type.enum';

export class CreateQuotationRiskDto {
  @IsUUID()
  risk_id: string;

  @IsOptional()
  @IsUUID()
  subject_matter_id?: string | null;

  @IsOptional()
  @IsUUID()
  motor_vehicle_id?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sum_insured?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fixed_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  basic_premium?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tax_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  charges_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  commission_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  total_premium?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  net_premium?: number;

  @IsOptional()
  @IsUUID()
  rating_rule_id?: string | null;

  @IsOptional()
  @IsObject()
  rating_result_metadata?: Record<string, unknown> | null;
}

export class CreateQuotationFactorValueDto {
  @IsOptional()
  @IsUUID()
  quotation_risk_id?: string | null;

  @IsUUID()
  factor_id: string;

  @IsOptional()
  @IsString()
  value_text?: string | null;

  @IsOptional()
  value_number?: number | null;

  @IsOptional()
  @IsDateString()
  value_date?: string | null;

  @IsOptional()
  value_boolean?: boolean | null;

  @IsOptional()
  @IsObject()
  value_json?: Record<string, unknown> | null;
}

export class CreateQuotationPremiumBreakdownDto {
  @IsOptional()
  @IsUUID()
  quotation_risk_id?: string | null;

  @IsEnum(QuotationPremiumItemType)
  item_type: QuotationPremiumItemType;

  @IsString()
  @MaxLength(50)
  item_code: string;

  @IsString()
  @MaxLength(150)
  item_name: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsEnum(QuotationCalculationBase)
  calculation_base?: QuotationCalculationBase;

  @IsOptional()
  calculation_order?: number;
}

export class CreateQuotationDto {
  @IsUUID()
  insurer_company_id: string;

  @IsOptional()
  @IsUUID()
  intermediary_company_id?: string | null;

  @IsOptional()
  @IsUUID()
  branch_id?: string | null;

  @IsOptional()
  @IsUUID()
  department_id?: string | null;

  @IsUUID()
  customer_id: string;

  @IsUUID()
  category_id: string;

  @IsUUID()
  product_id: string;

  @IsOptional()
  @IsUUID()
  sub_class_id?: string | null;

  @IsEnum(QuotationType)
  quotation_type: QuotationType;

  @IsEnum(ProductChannelType)
  channel_type: ProductChannelType;

  @IsOptional()
  @IsEnum(QuotationStatus)
  status?: QuotationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sum_insured?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  basic_premium?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  total_discount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  total_tax?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  total_charges?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  total_commission?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  total_premium?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  net_premium?: number;

  @IsDateString()
  valid_from: string;

  @IsDateString()
  @IsAfter('valid_from')
  valid_until: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  rating_version?: string | null;

  @IsOptional()
  @IsObject()
  rating_metadata?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  rejection_reason?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuotationRiskDto)
  risks?: CreateQuotationRiskDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuotationFactorValueDto)
  factor_values?: CreateQuotationFactorValueDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuotationPremiumBreakdownDto)
  premium_breakdowns?: CreateQuotationPremiumBreakdownDto[];
}
