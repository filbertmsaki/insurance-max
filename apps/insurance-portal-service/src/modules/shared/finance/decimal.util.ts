import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';

Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
});

export class DecimalUtil {
  static value(value: string | number | Decimal | null | undefined): Decimal {
    if (value === null || value === undefined || value === '') {
      return new Decimal(0);
    }

    try {
      return new Decimal(value);
    } catch {
      throw new BadRequestException(`Invalid decimal value: ${value}`);
    }
  }

  static exactMoney(
    value: string | number | Decimal | null | undefined,
  ): string {
    const amount = this.value(value);
    if (!amount.isFinite() || amount.decimalPlaces() > 12)
      throw new BadRequestException(
        'Enter an exact monetary amount with up to 12 decimal places.',
      );
    return amount.toFixed(Math.max(4, amount.decimalPlaces()));
  }

  static money(value: string | number | Decimal | null | undefined): string {
    return this.value(value).toFixed(2);
  }

  static quantity(value: string | number | Decimal | null | undefined): string {
    return this.value(value).toFixed(6);
  }

  static rate(value: string | number | Decimal | null | undefined): string {
    return this.value(value).toFixed(10);
  }

  static percentage(amount: string | number, rate: string | number): string {
    return this.value(amount).mul(this.value(rate)).div(100).toFixed(2);
  }

  static proRate(
    amount: string | number,
    numerator: string | number,
    denominator: string | number,
  ): string {
    const denominatorValue = this.value(denominator);

    if (denominatorValue.isZero()) {
      return '0.00';
    }

    return this.value(amount)
      .mul(this.value(numerator))
      .div(denominatorValue)
      .toFixed(2);
  }

  static add(...values: Array<string | number | Decimal>): string {
    return values
      .reduce<Decimal>(
        (total, value) => total.plus(this.value(value)),
        new Decimal(0),
      )
      .toFixed(2);
  }

  static subtract(left: string | number, right: string | number): string {
    return this.value(left).minus(this.value(right)).toFixed(2);
  }
}
