import { Transform, Type } from 'class-transformer';
import { TableQueryDto } from '@insurance-max/portal-shared/dto/table-query.dto';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class PortalListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;
}

/**
 * Server-side table query for portal lists. No defaults, so endpoints can
 * keep their legacy array response when `page` is absent (dashboard widgets)
 * and return `{ data, pagination }` only when a table asks for a page.
 */
export class PortalTableQueryDto extends TableQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;
}

export class PortalNotificationsQueryDto extends TableQueryDto {
  @IsOptional()
  @Transform(({ value }) =>
    value === true || value === 'true' || value === '1'
      ? true
      : value === false || value === 'false' || value === '0' || value === ''
        ? false
        : value,
  )
  @IsBoolean()
  unread_only?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  type?: string;
}
