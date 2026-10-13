import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

/**
 * Query contract for server-side tables:
 *   ?page=1&limit=20&search=abc&sortBy=name&sortOrder=ASC&<module filters>
 *
 * Unlike PaginationDto it has no defaults, so endpoints that also serve
 * legacy unpaginated consumers can detect `page` and switch to the
 * `{ data, pagination }` response only when it is requested.
 * `sortBy` is validated as an identifier and must still be allowlisted by
 * the service (see paginateQueryBuilder).
 */
export class TableQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, description: 'Rows per page (max 100)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ example: 'admin' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  @ApiPropertyOptional({ example: 'created_at' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z_][A-Za-z0-9_.]{0,63}$/)
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'] })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}

export function isPagedRequest(query: { page?: unknown } | undefined): boolean {
  return query?.page !== undefined && query?.page !== null && query?.page !== '';
}
