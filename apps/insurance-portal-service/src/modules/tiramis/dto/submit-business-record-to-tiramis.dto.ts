import { ApiPropertyOptional } from '@nestjs/swagger';
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
    description:
      'If true, allows resubmission after FAILED or FINAL_FAILED status.',
  })
  @IsOptional()
  @IsBoolean()
  forceResubmit?: boolean;

  @ApiPropertyOptional({
    example: true,
    description:
      'If duplicate active/success submission exists, return existing local tracking instead of throwing error.',
  })
  @IsOptional()
  @IsBoolean()
  returnExisting?: boolean;
}
