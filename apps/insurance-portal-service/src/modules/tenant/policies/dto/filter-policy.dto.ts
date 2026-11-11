import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { UnderwriteLine } from '@insurance-max/contracts';
import { PaginationDto } from '@insurance-max/portal-shared/dto/pagination.dto';
import {
  POLICY_LIST_VIEWS,
  TIRA_STATES,
  type PolicyListView,
  type TiraState,
} from '../policy-list-views';

export class FilterPolicyDto extends PaginationDto {
  @IsOptional()
  @IsString()
  declare search?: string;

  /**
   * A stored status, or EXPIRING_SOON: in force (active, endorsed or with a
   * cover note issued) and ending within the next 30 days.
   */
  @IsOptional()
  @IsString()
  policy_status?: string;

  /** Policy period overlaps [period_from, period_to] (inclusive dates). */
  @IsOptional()
  @IsDateString()
  period_from?: string;

  @IsOptional()
  @IsDateString()
  period_to?: string;

  @IsOptional()
  @IsString()
  customer_id?: string;

  @IsOptional()
  @IsUUID()
  quotation_id?: string;

  @IsOptional()
  @IsEnum(UnderwriteLine)
  business_line?: UnderwriteLine;

  /** Summary chip: active, expiring (7 days or fewer), TIRA failed. */
  @IsOptional()
  @IsIn(POLICY_LIST_VIEWS)
  view?: PolicyListView;

  /** TIRA state: success, failed, pending or not_submitted. */
  @IsOptional()
  @IsIn(TIRA_STATES)
  tira_state?: TiraState;

  /** Adds live summary-chip counts to the response meta. */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  include_summary?: boolean;
}

/** Internal list query with server-only filters (never from a client). */
export type PolicyListQuery = FilterPolicyDto & {
  /** Several lines at once (Motor Insurance register). */
  business_lines?: UnderwriteLine[];
};
