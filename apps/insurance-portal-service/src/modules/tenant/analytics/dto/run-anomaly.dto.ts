import { IsISO8601, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class RunAnomalyDto {
  @IsUUID()
  @IsNotEmpty()
  ruleId: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsISO8601()
  @IsNotEmpty()
  from: string;

  @IsISO8601()
  @IsNotEmpty()
  to: string;
}
