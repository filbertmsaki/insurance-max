import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  PolicyChangeCategory,
  PolicyTransactionChangeType,
} from '@insurance-max/contracts';

export class RecordEndorsementChangeDto {
  @ApiProperty({ enum: PolicyChangeCategory })
  @IsEnum(PolicyChangeCategory)
  category: PolicyChangeCategory;

  @ApiProperty({ enum: PolicyTransactionChangeType })
  @IsEnum(PolicyTransactionChangeType)
  operation: PolicyTransactionChangeType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  field_path: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  resource_id?: string;

  @ApiProperty()
  old_value: unknown;

  @ApiProperty()
  new_value: unknown;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_material?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  requires_repricing?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  requires_regulatory_submission?: boolean;
}
