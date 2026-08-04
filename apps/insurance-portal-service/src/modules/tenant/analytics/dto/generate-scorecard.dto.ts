import { IsISO8601, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class GenerateScorecardDto {
  @IsUUID()
  @IsNotEmpty()
  templateId: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsISO8601()
  @IsNotEmpty()
  periodStart: string;

  @IsISO8601()
  @IsNotEmpty()
  periodEnd: string;
}
