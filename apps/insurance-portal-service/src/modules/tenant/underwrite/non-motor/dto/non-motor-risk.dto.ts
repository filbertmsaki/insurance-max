import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  OmitType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  RISK_FIELD_DATA_TYPES,
  type RiskFieldDataType,
} from '../risk-field.types';

export class RiskFieldOptionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  value: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  label: string;
}

export class RiskFieldValidationRulesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  min?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  max?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  max_length?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  pattern?: string;
}

export class CreateRiskFieldDto {
  @ApiProperty()
  @IsUUID()
  product_id: string;

  @ApiPropertyOptional({ description: 'Omit to apply to every sub-class' })
  @IsOptional()
  @IsUUID()
  sub_class_id?: string | null;

  @ApiProperty({ example: 'construction_type' })
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'field_key must be lower_snake_case, starting with a letter',
  })
  @MaxLength(80)
  field_key: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  label: string;

  @ApiProperty({ enum: RISK_FIELD_DATA_TYPES })
  @IsIn(RISK_FIELD_DATA_TYPES)
  data_type: RiskFieldDataType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  section?: string | null;

  @ApiPropertyOptional({ type: [RiskFieldOptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RiskFieldOptionDto)
  options?: RiskFieldOptionDto[] | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_required?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sort_order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  help_text?: string | null;

  @ApiPropertyOptional({ type: RiskFieldValidationRulesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RiskFieldValidationRulesDto)
  validation_rules?: RiskFieldValidationRulesDto | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

/** product_id / sub_class_id / field_key are fixed once created. */
export class UpdateRiskFieldDto extends PartialType(
  OmitType(CreateRiskFieldDto, [
    'product_id',
    'sub_class_id',
    'field_key',
  ] as const),
) {}

export class ListRiskFieldsQueryDto {
  @ApiProperty()
  @IsUUID()
  product_id: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sub_class_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['true', 'false'])
  include_inactive?: 'true' | 'false';
}

export class SaveRiskDetailsDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  risk_data: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  risk_location?: string | null;

  @ApiPropertyOptional({ description: 'Limit of liability / indemnity' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  limit_of_liability?: number | null;
}
