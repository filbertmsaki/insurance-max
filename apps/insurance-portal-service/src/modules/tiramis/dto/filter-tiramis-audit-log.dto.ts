import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsOptional, IsString } from 'class-validator';

import { TiramisAuditAction } from '../enums/tiramis-audit-action.enum';
import { TiramisAuditSeverity } from '../enums/tiramis-audit-severity.enum';

export class FilterTiramisAuditLogDto {
  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ example: '50' })
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional({ enum: TiramisAuditAction })
  @IsOptional()
  @IsString()
  action?: TiramisAuditAction | string;

  @ApiPropertyOptional({ enum: TiramisAuditSeverity })
  @IsOptional()
  @IsString()
  severity?: TiramisAuditSeverity | string;

  @ApiPropertyOptional({ example: 'NIN_VERIFICATION' })
  @IsOptional()
  @IsString()
  requestType?: string;

  @ApiPropertyOptional({ example: 'true' })
  @IsOptional()
  @IsBooleanString()
  includePayload?: string;

  @ApiPropertyOptional({ example: 'corr-123' })
  @IsOptional()
  @IsString()
  correlationId?: string;

  @ApiPropertyOptional({ example: 'tracking-123' })
  @IsOptional()
  @IsString()
  localTrackingId?: string;

  @ApiPropertyOptional({ example: '19900101123456789001' })
  @IsOptional()
  @IsString()
  businessReference?: string;

  @ApiPropertyOptional({ example: 'verifications' })
  @IsOptional()
  @IsString()
  sourceModule?: string;

  @ApiPropertyOptional({ example: 'record-123' })
  @IsOptional()
  @IsString()
  sourceRecordId?: string;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-07-31' })
  @IsOptional()
  @IsString()
  endDate?: string;
}
