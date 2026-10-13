import { IsOptional, IsString, MaxLength } from 'class-validator';
import { TableQueryDto } from '@insurance-max/portal-shared/dto/table-query.dto';

/**
 * Failed / retryable lists. Without `page` they keep the legacy
 * `?limit=` array response; with `page` they return `{ data, pagination }`.
 * `companyId`/`sourceCompanyId` are accepted (and validated) by
 * TiramisCompanyScopeGuard.
 */
export class TiramisRecordListQueryDto extends TableQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  companyId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sourceCompanyId?: string;
}
