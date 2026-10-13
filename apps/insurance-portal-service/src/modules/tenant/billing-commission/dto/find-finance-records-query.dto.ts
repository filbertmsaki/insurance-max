import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { TableQueryDto } from '@insurance-max/portal-shared/dto/table-query.dto';

/**
 * Server-side table query for finance record lists
 * (invoices, receipts, payments, refunds, journals, commissions,
 * reconciliation batches). Sort keys are allowlisted per service method.
 */
export class FindFinanceRecordsQueryDto extends TableQueryDto {
  @ApiPropertyOptional({ description: 'Filter invoices by quotation ID' })
  @IsOptional()
  @IsUUID()
  quotation_id?: string;

  @ApiPropertyOptional({ example: 'ISSUED' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Za-z_]+$/)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  status?: string;
}

/** Shape accepted by the finance list service methods (also satisfied by FilterBillingDto). */
export interface FinanceListQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  status?: string;
  quotation_id?: string;
}
