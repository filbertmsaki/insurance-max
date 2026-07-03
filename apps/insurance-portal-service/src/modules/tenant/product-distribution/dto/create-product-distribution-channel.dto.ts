import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ProductChannelType } from '../enums/product-channel-type.enum';
import { ProductRuleStatus } from '../enums/product-rule-status.enum';

export class CreateProductDistributionChannelDto {
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
  sub_class_id?: string | null;

  @IsEnum(ProductChannelType)
  channel_type: ProductChannelType;

  @IsOptional()
  @IsBoolean()
  can_quote?: boolean;

  @IsOptional()
  @IsBoolean()
  can_bind?: boolean;

  @IsOptional()
  @IsBoolean()
  can_issue_policy?: boolean;

  @IsOptional()
  @IsBoolean()
  can_collect_premium?: boolean;

  @IsOptional()
  @IsBoolean()
  requires_underwriting?: boolean;

  @IsOptional()
  @IsBoolean()
  requires_insurer_approval?: boolean;

  @IsDateString()
  effective_from: string;

  @IsDateString()
  effective_to: string;

  @IsOptional()
  @IsEnum(ProductRuleStatus)
  status?: ProductRuleStatus;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
