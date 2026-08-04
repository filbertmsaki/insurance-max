import { IsISO8601, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class RunForecastDto {
  @IsUUID()
  @IsNotEmpty()
  definitionId: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsISO8601()
  @IsNotEmpty()
  trainingPeriodStart: string;

  @IsISO8601()
  @IsNotEmpty()
  trainingPeriodEnd: string;

  @IsISO8601()
  @IsNotEmpty()
  forecastPeriodStart: string;

  @IsISO8601()
  @IsNotEmpty()
  forecastPeriodEnd: string;
}
