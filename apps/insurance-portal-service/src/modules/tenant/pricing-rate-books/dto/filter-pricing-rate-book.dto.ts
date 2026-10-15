import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PricingRateBookStatus } from '../enums/pricing-rate-book-status.enum';
import { TableQueryDto } from '@insurance-max/portal-shared/dto/table-query.dto';

/** Rate book list filters; paged (table contract) only when `page` is sent. */
export class FilterPricingRateBookDto extends TableQueryDto {
  @ApiPropertyOptional({ description: 'Filter by product UUID' })
  @IsOptional()
  @IsUUID()
  product_id?: string;

  @ApiPropertyOptional({ enum: PricingRateBookStatus })
  @IsOptional()
  @IsEnum(PricingRateBookStatus)
  status?: PricingRateBookStatus;
}
