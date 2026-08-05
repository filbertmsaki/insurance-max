import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ProductDefinitionItemType,
  ProductDocumentRequirementType,
  ProductRequirementAppliesTo,
} from '@insurance-max/contracts';

export class ProductDefinitionItemDto {
  @Transform(({ value }) => String(value).trim().toUpperCase())
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @IsEnum(ProductDefinitionItemType)
  item_type: ProductDefinitionItemType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsBoolean()
  is_mandatory?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sort_order?: number;
}

export class ProductAddonDefinitionDto {
  @Transform(({ value }) => String(value).trim().toUpperCase())
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MaxLength(50)
  tiramis_addon_code?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  name: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  is_optional?: boolean;

  @IsOptional()
  @IsBoolean()
  is_default_selected?: boolean;

  @IsOptional()
  @IsBoolean()
  allows_separate_sum_insured?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maximum_quantity?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sort_order?: number;
}

export class ProductDocumentRequirementDto {
  @Transform(({ value }) => String(value).trim().toUpperCase())
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @IsEnum(ProductDocumentRequirementType)
  requirement_type: ProductDocumentRequirementType;

  @IsEnum(ProductRequirementAppliesTo)
  applies_to: ProductRequirementAppliesTo;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  name: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  is_mandatory?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  accepted_mime_types?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maximum_file_size_mb?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sort_order?: number;
}

export class UpsertProductVersionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  product_name: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  supports_fleet?: boolean;

  @Transform(({ value }) => String(value).trim().toUpperCase())
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  tiramis_product_code: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  cover_note_type: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3660)
  default_cover_duration_days: number;

  @Transform(({ value }) => String(value).trim().toUpperCase())
  @Matches(/^[A-Z]{3}$/)
  currency_code: string;

  @IsString()
  @IsNotEmpty()
  cover_note_description: string;

  @IsString()
  @IsNotEmpty()
  operative_clause: string;

  @IsString()
  @IsNotEmpty()
  policy_operative_clause: string;

  @IsString()
  special_conditions: string;

  @IsString()
  exclusions: string;

  @IsOptional()
  @IsBoolean()
  allows_cover_text_override?: boolean;

  @IsDateString()
  effective_from: string;

  @IsOptional()
  @IsDateString()
  effective_to?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  sub_class_ids?: string[];

  @IsOptional()
  @IsUUID()
  default_sub_class_id?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductDefinitionItemDto)
  definition_items: ProductDefinitionItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAddonDefinitionDto)
  addons: ProductAddonDefinitionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductDocumentRequirementDto)
  document_requirements: ProductDocumentRequirementDto[];
}
