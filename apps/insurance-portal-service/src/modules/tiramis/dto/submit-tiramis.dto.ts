import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

import { TiramisRequestType } from '../enums/tiramis-request-type.enum';

export class SubmitTiramisDto {
  @ApiProperty({
    enum: TiramisRequestType,
    example: TiramisRequestType.CLAIM_NOTIFICATION,
  })
  @IsEnum(TiramisRequestType)
  requestType!: TiramisRequestType;

  @ApiProperty({
    example: {
      insurerCompanyCode: 'IC001',
      claimNotificationNumber: 'CLM-NOT-2026-00001',
      coverNoteReferenceNumber: 'TIRA-CN-000001',
    },
  })
  @IsObject()
  @IsNotEmpty()
  payload!: Record<string, any>;

  @ApiPropertyOptional({
    example: 'insurance-portal-service',
  })
  @IsOptional()
  @IsString()
  sourceService?: string;

  @ApiPropertyOptional({
    example: 'company-uuid',
  })
  @IsOptional()
  @IsString()
  sourceCompanyId?: string | null;

  @ApiPropertyOptional({
    example: 'user-uuid',
  })
  @IsOptional()
  @IsString()
  sourceUserId?: string | null;

  @ApiPropertyOptional({
    example: 'claims',
  })
  @IsOptional()
  @IsString()
  sourceModule?: string | null;

  @ApiPropertyOptional({
    example: 'claim-record-uuid',
  })
  @IsOptional()
  @IsString()
  sourceRecordId?: string | null;

  @ApiPropertyOptional({
    example: 'policy-uuid',
  })
  @IsOptional()
  @IsString()
  policyId?: string | null;

  @ApiPropertyOptional({
    example: 'quotation-uuid',
  })
  @IsOptional()
  @IsString()
  quotationId?: string | null;

  @ApiPropertyOptional({
    example: 'CLM-NOT-2026-00001',
  })
  @IsOptional()
  @IsString()
  businessReference?: string | null;

  @ApiPropertyOptional({
    example: false,
    description:
      'If true, allows a new submission even when a previous failed submission exists.',
  })
  @IsOptional()
  @IsBoolean()
  forceResubmit?: boolean;

  @ApiPropertyOptional({
    example: true,
    description:
      'If duplicate active/success submission exists, return the existing tracking record instead of throwing an error.',
  })
  @IsOptional()
  @IsBoolean()
  returnExisting?: boolean;
}
