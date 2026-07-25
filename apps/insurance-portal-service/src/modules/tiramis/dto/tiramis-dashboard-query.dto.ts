import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsEnum, IsOptional, IsString } from 'class-validator';

import { TiramisRequestType } from '../enums/tiramis-request-type.enum';
import { TiramisSubmissionStatus } from '../enums/tiramis-submission-status.enum';

export class TiramisDashboardQueryDto {
  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-07-31' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional({ enum: TiramisSubmissionStatus })
  @IsOptional()
  @IsEnum(TiramisSubmissionStatus)
  status?: TiramisSubmissionStatus;

  @ApiPropertyOptional({ enum: TiramisRequestType })
  @IsOptional()
  @IsEnum(TiramisRequestType)
  requestType?: TiramisRequestType;

  @ApiPropertyOptional({ example: 'claims' })
  @IsOptional()
  @IsString()
  sourceModule?: string;

  @ApiPropertyOptional({ example: 'company-uuid' })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({ example: 'company-uuid' })
  @IsOptional()
  @IsString()
  sourceCompanyId?: string;

  @ApiPropertyOptional({ example: 'claim-record-uuid' })
  @IsOptional()
  @IsString()
  sourceRecordId?: string;

  @ApiPropertyOptional({ example: 'CLM-NOT-2026-00001' })
  @IsOptional()
  @IsString()
  businessReference?: string;

  @ApiPropertyOptional({ example: 'AIC0000000001' })
  @IsOptional()
  @IsString()
  tiramisRequestId?: string;

  @ApiPropertyOptional({ example: 'tiramis-transaction-uuid' })
  @IsOptional()
  @IsString()
  tiramisTransactionId?: string;

  @ApiPropertyOptional({ example: 'TIRA001' })
  @IsOptional()
  @IsString()
  finalResponseStatusCode?: string;

  @ApiPropertyOptional({ example: 'true' })
  @IsOptional()
  @IsBooleanString()
  isRetryable?: string;

  @ApiPropertyOptional({ example: 'POL-2026' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-07-31' })
  @IsOptional()
  @IsString()
  dateTo?: string;
}
