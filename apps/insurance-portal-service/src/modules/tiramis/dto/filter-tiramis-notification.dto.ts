import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsOptional, IsString } from 'class-validator';

import { TiramisNotificationDeliveryStatus } from '../enums/tiramis-notification-delivery-status.enum';
import { TiramisNotificationSeverity } from '../enums/tiramis-notification-severity.enum';
import { TiramisNotificationType } from '../enums/tiramis-notification-type.enum';

export class FilterTiramisNotificationDto {
  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ example: '50' })
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional({ enum: TiramisNotificationType })
  @IsOptional()
  @IsString()
  type?: TiramisNotificationType | string;

  @ApiPropertyOptional({ enum: TiramisNotificationSeverity })
  @IsOptional()
  @IsString()
  severity?: TiramisNotificationSeverity | string;

  @ApiPropertyOptional({ enum: TiramisNotificationDeliveryStatus })
  @IsOptional()
  @IsString()
  deliveryStatus?: TiramisNotificationDeliveryStatus | string;

  @ApiPropertyOptional({ example: 'NIN_VERIFICATION' })
  @IsOptional()
  @IsString()
  requestType?: string;

  @ApiPropertyOptional({ example: 'true' })
  @IsOptional()
  @IsBooleanString()
  isRead?: string;

  @ApiPropertyOptional({ example: 'false' })
  @IsOptional()
  @IsBooleanString()
  includeDismissed?: string;

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
