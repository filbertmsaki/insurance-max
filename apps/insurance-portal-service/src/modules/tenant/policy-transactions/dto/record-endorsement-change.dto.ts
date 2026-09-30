import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Allow,
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

  @ApiPropertyOptional({
    description:
      'Informational only. Backend resolves the authoritative original value.',
  })
  @IsOptional()
  old_value?: unknown;

  // Any JSON value (null for REMOVE); the service validates it against the
  // field rules. @Allow keeps it past the global forbidNonWhitelisted pipe.
  @ApiProperty()
  @Allow()
  new_value: unknown;

  @ApiPropertyOptional({
    default: true,
    description:
      'Informational only. Backend resolves whether the change is material.',
  })
  @IsOptional()
  @IsBoolean()
  is_material?: boolean;

  @ApiPropertyOptional({
    default: true,
    description:
      'Informational only. Backend resolves whether repricing is required.',
  })
  @IsOptional()
  @IsBoolean()
  requires_repricing?: boolean;

  @ApiPropertyOptional({
    default: true,
    description:
      'Informational only. Backend resolves whether regulatory submission is required.',
  })
  @IsOptional()
  @IsBoolean()
  requires_regulatory_submission?: boolean;
}
