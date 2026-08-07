import {
  AnalyticsPeriodType,
  AnalyticsValueKind,
} from '@insurance-max/contracts';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class MetricCompareDto {
  @IsString()
  metricCode: string;

  @IsEnum(AnalyticsPeriodType)
  periodType: AnalyticsPeriodType;

  @IsDateString()
  periodStart: string;

  @IsDateString()
  periodEnd: string;

  @IsOptional()
  @IsEnum(AnalyticsValueKind)
  valueKind?: AnalyticsValueKind;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @Type(() => Object)
  @IsObject()
  dimensions?: Record<string, string>;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  currencyCode?: string;

  @IsOptional()
  @IsDateString()
  comparePeriodStart?: string;

  @IsOptional()
  @IsDateString()
  comparePeriodEnd?: string;
}
