import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PricingRateBookStatus } from '../enums/pricing-rate-book-status.enum';

export class FilterPricingRateBookDto {
  @ApiPropertyOptional({ description: 'Filter by product UUID' })
  @IsOptional()
  @IsUUID()
  product_id?: string;

  @ApiPropertyOptional({ enum: PricingRateBookStatus })
  @IsOptional()
  @IsEnum(PricingRateBookStatus)
  status?: PricingRateBookStatus;
}
