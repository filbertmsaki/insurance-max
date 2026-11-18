import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaymentMethod } from '@insurance-max/contracts';

export const PaymentReferenceStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  PAID: 'PAID',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;

export type PaymentReferenceStatus =
  (typeof PaymentReferenceStatus)[keyof typeof PaymentReferenceStatus];

export const PaymentChannel = {
  CASH: 'CASH',
  EFT: 'EFT',
  BANK: 'BANK',
  BANK_TRANSFER: 'BANK_TRANSFER',
  MOBILE_MONEY: 'MOBILE_MONEY',
  MPESA: 'MPESA',
  AIRTEL_MONEY: 'AIRTEL_MONEY',
  MIXX_BY_YAS: 'MIXX_BY_YAS',
  HALOPESA: 'HALOPESA',
  CARD: 'CARD',
  UNKNOWN: 'UNKNOWN',
} as const;

export type PaymentChannel =
  (typeof PaymentChannel)[keyof typeof PaymentChannel];

export class CreatePaymentReferenceDto {
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  provider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  channel?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
