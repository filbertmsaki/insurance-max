import {
  IsDateString,
  IsEnum,
  Max,
  Min,
  IsNumber,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ProductChannelType } from '../enums/product-channel-type.enum';
import { ProductCalculationBase } from '../enums/product-calculation-base.enum';
import { ProductCommissionType } from '../enums/product-commission-type.enum';
import { ProductRuleStatus } from '../enums/product-rule-status.enum';

export class CreateProductCommissionRuleDto {
  @IsUUID()
  insurer_company_id: string;

  @IsOptional()
  @IsUUID()
  intermediary_company_id?: string | null;

  @IsOptional()
  @IsUUID()
  category_id?: string | null;

  @IsUUID()
  product_id: string;

  @IsOptional()
  @IsUUID()
  risk_id?: string | null;

  @IsEnum(ProductChannelType)
  channel_type: ProductChannelType;

  @IsEnum(ProductCommissionType)
  commission_type: ProductCommissionType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  commission_rate?: number | null;

  @IsOptional()
  @IsNumber()
  commission_amount?: number | null;

  @IsOptional()
  @IsNumber()
  minimum_commission?: number | null;

  @IsOptional()
  @IsNumber()
  maximum_commission?: number | null;

  @IsOptional()
  @IsEnum(ProductCalculationBase)
  calculation_base?: ProductCalculationBase;

  @IsDateString()
  effective_from: string;

  @IsDateString()
  effective_to: string;

  @IsOptional()
  @IsEnum(ProductRuleStatus)
  status?: ProductRuleStatus;
}
