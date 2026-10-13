import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { TableQueryDto } from '@insurance-max/portal-shared/dto/table-query.dto';

/**
 * GET /audit-logs — server-side table query. Always paged (page defaults to
 * 1, limit to 20, capped at 100 by TableQueryDto/paginateQueryBuilder).
 */
export class FilterAuditLogDto extends TableQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  event_category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  resource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  resource_id?: string;

  @IsOptional()
  @IsUUID()
  user_id?: string;

  @IsOptional()
  @IsIn(['success', 'failure'])
  status?: 'success' | 'failure';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  request_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  correlation_id?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;
}
