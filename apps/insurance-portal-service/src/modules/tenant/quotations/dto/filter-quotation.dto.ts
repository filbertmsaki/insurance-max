import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '@insurance-max/portal-shared/dto/pagination.dto';
import { ApprovalStatus } from '../enums/approval-status.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { TiraStatus } from '../enums/tira-status.enum';
import { QuotationFlow } from '../enums/quotation-flow.enum';
import { QuotationStatus } from '../enums/quotation-status.enum';
import { QuotationType } from '../enums/quotation-type.enum';

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
}

/**
 * Internal list query: adds server-only filters that must never be accepted
 * from a client (kept off the DTO class so the ValidationPipe never sees them).
 */
export type QuotationListQuery = FilterQuotationDto & {
  /** Several flows at once (Motor Insurance register). */
  quotation_flows?: QuotationFlow[];
};
