import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

import type { ServiceProductContext } from '@insurance-max/contracts';
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

  @ApiPropertyOptional({
    description:
      'Signed product-definition context, resolved internally — never accepted from an external caller.',
  })
  @IsOptional()
  @IsObject()
  productContext?: ServiceProductContext;
}
