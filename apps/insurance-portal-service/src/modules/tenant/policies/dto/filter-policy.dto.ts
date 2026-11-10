import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { UnderwriteLine } from '@insurance-max/contracts';
import { PaginationDto } from '@insurance-max/portal-shared/dto/pagination.dto';

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
}

/** Internal list query with server-only filters (never from a client). */
export type PolicyListQuery = FilterPolicyDto & {
  /** Several lines at once (Motor Insurance register). */
  business_lines?: UnderwriteLine[];
};
