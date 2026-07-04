import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class TiramisStatusQueryDto {
  @ApiPropertyOptional({ example: 'tiramis-transaction-uuid' })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional({ example: 'AIC0000000001' })
  @IsOptional()
  @IsString()
  requestId?: string;

  @ApiPropertyOptional({ example: 'CLM-NOT-2026-00001' })
  @IsOptional()
  @IsString()
  businessReference?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  includePayload?: boolean;
}
