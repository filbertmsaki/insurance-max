import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { QuotationStatusTransitionAction } from '../enums/quotation-status-transition-action.enum';

export class TransitionQuotationStatusDto {
  @ApiProperty({
    enum: QuotationStatusTransitionAction,
    description: 'Requested quotation lifecycle transition.',
  })
  @IsEnum(QuotationStatusTransitionAction)
  action!: QuotationStatusTransitionAction;

  @ApiPropertyOptional({
    description:
      'Human-readable reason or approval/rejection note for the transition.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  @ApiPropertyOptional({
    description: 'Optional comment stored alongside the lifecycle transition.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comments?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  request_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  payment_transaction_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tira_request_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tira_response_id?: string;

  @ApiPropertyOptional({
    description: 'Optional structured transition metadata.',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
