import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class FilterAuditLogDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  limit = 50;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  event_category?: string;

  @IsOptional()
  @IsString()
  resource?: string;

  @IsOptional()
  @IsUUID()
  user_id?: string;

  @IsOptional()
  @IsIn(['success', 'failure'])
  status?: 'success' | 'failure';

  @IsOptional()
  @IsString()
  request_id?: string;

  @IsOptional()
  @IsString()
  correlation_id?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;
}
