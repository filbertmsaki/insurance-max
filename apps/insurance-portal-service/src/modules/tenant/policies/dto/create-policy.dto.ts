import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { IsAfter } from '@insurance-max/portal-shared/validators/is-after.validator';
import { IsNonNegativeMoney } from '@insurance-max/portal-shared/validators/is-non-negative-money.validator';
import { ProductChannelType } from '../../product-distribution/enums/product-channel-type.enum';
import { QuotationCalculationBase } from '../../quotations/enums/quotation-calculation-base.enum';
import { QuotationPremiumItemType } from '../../quotations/enums/quotation-premium-item-type.enum';

export class CreatePolicyRiskDto {
  @IsOptional()
  @IsUUID()
  quotation_entry_risk_id?: string | null;

  @IsUUID()
  risk_id: string;

  @IsOptional()
  @IsUUID()
  subject_matter_id?: string | null;

  @IsOptional()
  @IsUUID()
  motor_vehicle_id?: string | null;

  @IsOptional()
  @IsNonNegativeMoney()
  sum_insured?: number | string | null;

  @IsOptional()
  @IsNonNegativeMoney()
  rate?: number | string | null;

  @IsOptional()
  @IsNonNegativeMoney()
  basic_premium?: number | string | null;

  @IsOptional()
  @IsNonNegativeMoney()
  discount_amount?: number | string | null;

  @IsOptional()
  @IsNonNegativeMoney()
  tax_amount?: number | string | null;

  @IsOptional()
  @IsNonNegativeMoney()
  charges_amount?: number | string | null;

  @IsOptional()
  @IsNonNegativeMoney()
  commission_amount?: number | string | null;

  @IsOptional()
  @IsNonNegativeMoney()
  total_premium?: number | string | null;

  @IsOptional()
  @IsNonNegativeMoney()
  net_premium?: number | string | null;

  @IsOptional()
  @IsBoolean()
  reinsurance_required?: boolean;

  @IsOptional()
  @IsNonNegativeMoney()
  retention_amount?: number | string | null;

  @IsOptional()
  @IsNonNegativeMoney()
  ceded_sum_insured?: number | string | null;

  @IsOptional()
  @IsNonNegativeMoney()
  ceded_premium?: number | string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  reinsurance_status?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;
}

export class CreatePolicyPremiumBreakdownDto {
  @IsOptional()
  @IsUUID()
  policy_risk_id?: string | null;

  @IsEnum(QuotationPremiumItemType)
  item_type: QuotationPremiumItemType;

  @IsString()
  @MaxLength(50)
  item_code: string;

  @IsString()
  @MaxLength(150)
  item_name: string;

  @IsOptional()
  @IsNonNegativeMoney()
  rate?: number | string | null;

  @IsOptional()
  @IsNonNegativeMoney()
  amount?: number | string | null;

  @IsOptional()
  @IsEnum(QuotationCalculationBase)
  calculation_base?: QuotationCalculationBase;

  @IsOptional()
  calculation_order?: number;
}

export class CreatePolicyDto {
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

  @IsOptional()
  @IsUUID()
  quotation_id?: string | null;

  @IsOptional()
  @IsUUID()
  proposal_id?: string | null;

  @IsUUID()
  category_id: string;

  @IsUUID()
  product_id: string;

  @IsOptional()
  @IsUUID()
  sub_class_id?: string | null;

  @IsEnum(ProductChannelType)
  channel_type: ProductChannelType;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  policy_status?: string;

  @IsDateString()
  start_date: string;

  @IsDateString()
  @IsAfter('start_date')
  end_date: string;

  @IsDateString()
  issue_date: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsNonNegativeMoney()
  sum_insured?: number | string | null;

  @IsOptional()
  @IsNonNegativeMoney()
  basic_premium?: number | string | null;

  @IsOptional()
  @IsNonNegativeMoney()
  total_discount?: number | string | null;

  @IsOptional()
  @IsNonNegativeMoney()
  total_tax?: number | string | null;

  @IsOptional()
  @IsNonNegativeMoney()
  total_charges?: number | string | null;

  @IsOptional()
  @IsNonNegativeMoney()
  total_commission?: number | string | null;

  @IsOptional()
  @IsNonNegativeMoney()
  total_premium?: number | string | null;

  @IsOptional()
  @IsNonNegativeMoney()
  net_premium?: number | string | null;

  @IsOptional()
  @IsBoolean()
  reinsurance_required?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  reinsurance_status?: string;

  @IsOptional()
  @IsNonNegativeMoney()
  retention_amount?: number | string | null;

  @IsOptional()
  @IsNonNegativeMoney()
  ceded_sum_insured?: number | string | null;

  @IsOptional()
  @IsNonNegativeMoney()
  ceded_premium?: number | string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  tira_status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tira_portal_transaction_id?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tiramis_transaction_id?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePolicyRiskDto)
  risks?: CreatePolicyRiskDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePolicyPremiumBreakdownDto)
  premium_breakdowns?: CreatePolicyPremiumBreakdownDto[];
}
