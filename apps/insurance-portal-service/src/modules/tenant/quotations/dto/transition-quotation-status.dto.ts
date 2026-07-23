import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

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
}
