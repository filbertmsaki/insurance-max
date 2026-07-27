import { PartialType } from '@nestjs/swagger';
import { CreatePricingRateBookDto } from './create-pricing-rate-book.dto';

export class UpdatePricingRateBookDto extends PartialType(
  CreatePricingRateBookDto,
) {}
