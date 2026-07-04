import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ProductRuleStatus } from '../enums/product-rule-status.enum';

export class CreateProductDocumentRequirementDto {
  @IsUUID()
  company_id: string;

  @IsUUID()
  product_id: string;

  @IsOptional()
  @IsUUID()
  risk_id?: string | null;

  @IsString()
  document_type: string;

  @IsString()
  document_name: string;

  @IsOptional()
  @IsBoolean()
  is_required?: boolean;

  @IsOptional()
  @IsBoolean()
  is_required_before_quote?: boolean;

  @IsOptional()
  @IsBoolean()
  is_required_before_policy?: boolean;

  @IsOptional()
  @IsBoolean()
  is_required_before_claim?: boolean;

  @IsOptional()
  @IsEnum(ProductRuleStatus)
  status?: ProductRuleStatus;
}
