import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  Matches,
} from 'class-validator';
import { TableQueryDto } from '@insurance-max/portal-shared/dto/table-query.dto';
import { TIRA_STATES, type TiraState } from '../../policies/policy-list-views';

export const TRANSACTION_LIST_VIEWS = [
  'active',
  'expiring',
  'tira_failed',
  'drafts',
] as const;
export type TransactionListView = (typeof TRANSACTION_LIST_VIEWS)[number];

/**
 * Register query for renewals, endorsements and cancellations: the table
 * params plus the standard list filters and summary-chip counts.
 */
export class TransactionListQueryDto extends TableQueryDto {
  /** Stored stage (endorsements, cancellations) or renewal status. */
  @ApiPropertyOptional({ example: 'COMPLETED' })
  @IsOptional()
  @Matches(/^[A-Z_]{1,40}$/)
  status?: string;

  @ApiPropertyOptional({ enum: TIRA_STATES })
  @IsOptional()
  @IsIn(TIRA_STATES)
  tira_state?: TiraState;

  /** Summary chip: active, expiring (7 days or fewer), TIRA failed, drafts. */
  @ApiPropertyOptional({ enum: TRANSACTION_LIST_VIEWS })
  @IsOptional()
  @IsIn(TRANSACTION_LIST_VIEWS)
  view?: TransactionListView;

  /** Date issued (created) from this calendar day, YYYY-MM-DD. */
  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @IsDateString({ strict: true })
  date_from?: string;

  @ApiPropertyOptional({ example: '2026-11-30' })
  @IsOptional()
  @IsDateString({ strict: true })
  date_to?: string;

  /** Motor Insurance register only: narrow to Single Motor or Fleet. */
  @ApiPropertyOptional({ enum: ['single', 'fleet'] })
  @IsOptional()
  @IsIn(['single', 'fleet'])
  type?: 'single' | 'fleet';

  /** Adds live summary-chip counts to the response. */
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  include_summary?: boolean;
}

export interface TransactionListSummary {
  all: number;
  active: number;
  expiring: number;
  tira_failed: number;
  drafts: number;
}
