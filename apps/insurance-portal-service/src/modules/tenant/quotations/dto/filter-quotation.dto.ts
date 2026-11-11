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
import { PaginationDto } from '@insurance-max/portal-shared/dto/pagination.dto';
import { TIRA_STATES, type TiraState } from '../../policies/policy-list-views';
import { ApprovalStatus } from '../enums/approval-status.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { TiraStatus } from '../enums/tira-status.enum';
import { QuotationFlow } from '../enums/quotation-flow.enum';
import { QuotationStatus } from '../enums/quotation-status.enum';
import { QuotationType } from '../enums/quotation-type.enum';

export const QUOTATION_LIST_VIEWS = [
  'active',
  'expiring',
  'tira_failed',
  'drafts',
] as const;

export class FilterQuotationDto extends PaginationDto {
  @IsOptional()
  @IsString()
  declare search?: string;

  @IsOptional()
  @IsEnum(QuotationStatus)
  status?: QuotationStatus;

  @IsOptional()
  @IsEnum(ApprovalStatus)
  approval_status?: ApprovalStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  payment_status?: PaymentStatus;

  @IsOptional()
  @IsEnum(TiraStatus)
  tira_status?: TiraStatus;

  @IsOptional()
  @IsEnum(QuotationType)
  quotation_type?: QuotationType;

  @IsOptional()
  @IsEnum(QuotationFlow)
  quotation_flow?: QuotationFlow;

  @IsOptional()
  @IsUUID()
  customer_id?: string;

  @IsOptional()
  @IsUUID()
  product_id?: string;

  /** Summary chip: active, expiring (7 days or fewer), TIRA failed, drafts. */
  @IsOptional()
  @IsIn(QUOTATION_LIST_VIEWS)
  view?: (typeof QUOTATION_LIST_VIEWS)[number];

  /** Date issued (created) on or after this calendar day, YYYY-MM-DD. */
  @IsOptional()
  @IsDateString({ strict: true })
  date_from?: string;

  /** Date issued (created) on or before this calendar day, YYYY-MM-DD. */
  @IsOptional()
  @IsDateString({ strict: true })
  date_to?: string;

  /** Grouped TIRA state: success, failed, pending or not_submitted. */
  @IsOptional()
  @IsIn(TIRA_STATES)
  tira_state?: TiraState;

  /** Adds live summary-chip counts to the response meta. */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  include_summary?: boolean;
}

/**
 * Internal list query: adds server-only filters that must never be accepted
 * from a client (kept off the DTO class so the ValidationPipe never sees them).
 */
export type QuotationListQuery = FilterQuotationDto & {
  /** Several flows at once (Motor Insurance register). */
  quotation_flows?: QuotationFlow[];
};
