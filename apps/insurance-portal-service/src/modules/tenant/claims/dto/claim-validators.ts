import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

/**
 * Non-negative money amount with up to two decimals, accepted as a number or
 * numeric string and normalised to a string for exact decimal handling.
 */
export function IsMoneyAmount() {
  return applyDecorators(
    Transform(({ value }) =>
      value === undefined || value === null || value === ''
        ? value
        : String(value).trim(),
    ),
    IsString(),
    Matches(/^\d{1,16}(\.\d{1,2})?$/, {
      message: '$property must be a non-negative amount with up to 2 decimals',
    }),
  );
}

/** Positive exchange rate with up to six decimals. */
export function IsExchangeRate() {
  return applyDecorators(
    Transform(({ value }) =>
      value === undefined || value === null || value === ''
        ? value
        : String(value).trim(),
    ),
    IsString(),
    Matches(/^(?!0+(\.0+)?$)\d{1,12}(\.\d{1,6})?$/, {
      message: '$property must be a positive rate with up to 6 decimals',
    }),
  );
}
