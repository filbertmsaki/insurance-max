import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

import { ProductChannelType } from '../../product-distribution/enums/product-channel-type.enum';

export enum DashboardGroupBy {
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
}

export class DashboardQueryDto {
  @ApiPropertyOptional({
    example: '2026-08-01',
    description:
      'Beginning of the reporting period. Defaults to the first day of the current month.',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-08-31',
    description: 'End of the reporting period. The date is inclusive.',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    enum: DashboardGroupBy,
    default: DashboardGroupBy.DAY,
  })
  @IsOptional()
  @IsEnum(DashboardGroupBy)
  group_by?: DashboardGroupBy = DashboardGroupBy.DAY;

  @ApiPropertyOptional({
    description:
      'Optional branch filter. The branch must be within the authenticated user scope.',
  })
  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  product_id?: string;

  @ApiPropertyOptional({
    enum: ProductChannelType,
  })
  @IsOptional()
  @IsEnum(ProductChannelType)
  channel_type?: ProductChannelType;

  @ApiPropertyOptional({
    example: 'TZS',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ApiPropertyOptional({
    default: 10,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
