import {
  IsDateString,
  IsEnum,
  Max,
  Min,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ProductCalculationBase } from '../enums/product-calculation-base.enum';
import { ProductChargeCategory } from '../enums/product-charge-category.enum';
import { ProductRuleStatus } from '../enums/product-rule-status.enum';
import { ProductTaxType } from '../enums/product-tax-type.enum';

export class CreateProductTaxRuleDto {
  @IsUUID()
  company_id: string;

  @IsOptional()
  @IsUUID()
  category_id?: string | null;

  @IsOptional()
  @IsUUID()
  product_id?: string | null;

  @IsOptional()
  @IsUUID()
  risk_id?: string | null;

  @IsString()
  tax_name: string;

  @IsString()
  tax_code: string;

  @IsOptional()
  @IsEnum(ProductChargeCategory)
  charge_category?: ProductChargeCategory;

  @IsEnum(ProductTaxType)
  tax_type: ProductTaxType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  tax_rate?: number | null;

  @IsOptional()
  @IsNumber()
  tax_amount?: number | null;

  @IsOptional()
  @IsBoolean()
  is_taxable?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimum_charge_amount?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maximum_charge_amount?: number | null;

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
