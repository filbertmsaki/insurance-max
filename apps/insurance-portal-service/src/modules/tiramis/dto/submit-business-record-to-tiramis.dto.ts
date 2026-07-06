import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class SubmitBusinessRecordToTiramisDto {
  @ApiPropertyOptional({
    description:
      'Optional payload override. If provided, this payload will be sent to tiramis-service.',
    example: {
      insurerCompanyCode: 'IC001',
      policyNumber: 'POL-2026-000001',
    },
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, any>;

  @ApiPropertyOptional({
    example: 'POL-2026-000001',
  })
  @IsOptional()
  @IsString()
  businessReference?: string;

  @ApiPropertyOptional({
    example: 'policy-record-uuid',
  })
  @IsOptional()
  @IsString()
  sourceRecordId?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Allow a new submission even if an active duplicate exists.',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  forceResubmit?: boolean;

  @ApiPropertyOptional({
    example: true,
    description:
      'Return the existing active submission instead of throwing duplicate error.',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  returnExisting?: boolean;
}
