import { BadRequestException } from '@nestjs/common';

export type MoneyValue = string | number | null | undefined;

export class MoneyUtil {
  static toMinor(value: MoneyValue): bigint {
    if (value === null || value === undefined || value === '') {
      return 0n;
    }

    const normalized = String(value).trim();

    if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
      throw new BadRequestException(
        `Invalid monetary value: ${normalized}`,
      );
    }

    const negative = normalized.startsWith('-');
    const unsigned = negative ? normalized.substring(1) : normalized;
    const [whole, decimal = ''] = unsigned.split('.');

    const minor =
      BigInt(whole) * 100n + BigInt(decimal.padEnd(2, '0'));

    return negative ? -minor : minor;
  }

  static fromMinor(value: bigint): string {
    const negative = value < 0n;
    const absolute = negative ? -value : value;
    const whole = absolute / 100n;
    const decimal = String(absolute % 100n).padStart(2, '0');

    return `${negative ? '-' : ''}${whole}.${decimal}`;
  }

  static add(...values: MoneyValue[]): string {
    return this.fromMinor(
      values.reduce(
        (total, value) => total + this.toMinor(value),
        0n,
      ),
    );
  }

  static subtract(left: MoneyValue, right: MoneyValue): string {
    return this.fromMinor(this.toMinor(left) - this.toMinor(right));
  }

  static compare(left: MoneyValue, right: MoneyValue): number {
    const a = this.toMinor(left);
    const b = this.toMinor(right);

    if (a > b) return 1;
    if (a < b) return -1;
    return 0;
  }

  static multiplyRatio(
    amount: MoneyValue,
    numerator: MoneyValue,
    denominator: MoneyValue,
  ): string {
    const amountMinor = this.toMinor(amount);
    const numeratorMinor = this.toMinor(numerator);
    const denominatorMinor = this.toMinor(denominator);

    if (denominatorMinor === 0n) {
      return '0.00';
    }

    return this.fromMinor(
      (amountMinor * numeratorMinor) / denominatorMinor,
    );
  }
}
