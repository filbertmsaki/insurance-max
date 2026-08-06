import { ConflictException, Injectable } from '@nestjs/common';
import { PricingRateBook } from './entities/pricing-rate-book.entity';
import { PricingRateBookStatus } from './enums/pricing-rate-book-status.enum';

@Injectable()
export class PricingRateBookEditabilityService {
  assertEditable(rateBook: PricingRateBook): void {
    if (
      ![PricingRateBookStatus.DRAFT, PricingRateBookStatus.REJECTED].includes(
        rateBook.status,
      )
    ) {
      throw new ConflictException({
        code: 'RATE_BOOK_NOT_EDITABLE',
        message: `Rate books in ${rateBook.status} status cannot be edited.`,
      });
    }
  }
}
