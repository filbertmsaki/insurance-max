import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class BenchmarkQueryDto {
  @IsOptional()
  @IsString()
  metricCode?: string;

  @IsOptional()
  @IsString()
  cohortKey?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
