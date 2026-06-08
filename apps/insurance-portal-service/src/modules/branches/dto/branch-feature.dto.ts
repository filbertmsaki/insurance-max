import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpsertCompanyFeatureDto {
  @ApiProperty({
    example: 'reports',
    description: 'Unique feature key within the company',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  feature_key: string;

  @ApiProperty({ example: 'Reports Module' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  display_name: string;

  @ApiPropertyOptional({ example: 'Access to generate and export reports' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Enable or disable this feature company-wide',
  })
  @IsOptional()
  @IsBoolean()
  is_enabled?: boolean;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class SetBranchFeatureDto {
  @ApiProperty({
    description:
      'Enable or disable this feature for the branch. Cannot exceed company-level setting.',
  })
  @IsBoolean()
  is_enabled: boolean;
}
