import { IsDateString, IsOptional } from 'class-validator';

export class IntermediarySettlementReportQueryDto {
  @IsOptional()
  @IsDateString()
  from_date?: string;

  @IsOptional()
  @IsDateString()
  to_date?: string;
}
