import { ConflictException } from '@nestjs/common';
import { DecimalUtil } from '../../../shared/finance/decimal.util';
import {
  FinancePolicyScope,
  policyDate,
  policyHash,
  policyScope,
} from './finance-policy.types';

export interface GovernedRate {
  scope: FinancePolicyScope;
  transactionCurrency: string;
  functionalCurrency: string;
  assessmentHash: string;
  rate: string;
  rateDate: string;
  validTo: string;
  evidenceHash: string;
  sourceReference: string;
  makerNaturalPersonId: string;
  approverNaturalPersonId: string;
  approved: boolean;
}
const fail = (message: string): never => {
  throw new ConflictException({
    code: 'FINANCE_CURRENCY_EVIDENCE_REQUIRED',
    message,
  });
};
export function financialDecimal(value: string) {
  if (typeof value !== 'string' || !value.trim())
    throw new ConflictException({
      code: 'INVALID_FINANCE_AMOUNT',
      message:
        'A financial amount is required; missing values cannot represent zero.',
    });
  const amount = DecimalUtil.value(value);
  if (!amount.isFinite())
    throw new ConflictException({
      code: 'INVALID_FINANCE_AMOUNT',
      message: 'Financial amounts must be finite decimals.',
    });
  return amount;
}
function scale(value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 12)
    fail('An approved currency precision between zero and twelve is required.');
}
export function validateGovernedRate(
  scope: FinancePolicyScope,
  rate: GovernedRate,
  transactionCurrency: string,
  functionalCurrency: string,
  date: string,
  maxAgeDays: number,
) {
  policyScope(scope);
  policyScope(rate.scope);
  policyDate(date);
  policyDate(rate.rateDate);
  policyDate(rate.validTo);
  policyHash(rate.assessmentHash);
  policyHash(rate.evidenceHash);
  if (
    !/^[A-Z]{3}$/.test(transactionCurrency) ||
    !/^[A-Z]{3}$/.test(functionalCurrency) ||
    !Number.isInteger(maxAgeDays) ||
    maxAgeDays < 0 ||
    maxAgeDays > 366
  )
    fail('Explicit currency identities and rate age controls are required.');
  if (
    scope.tenantId !== rate.scope.tenantId ||
    scope.legalEntityId !== rate.scope.legalEntityId ||
    scope.bookId !== rate.scope.bookId ||
    rate.transactionCurrency !== transactionCurrency ||
    rate.functionalCurrency !== functionalCurrency
  )
    fail(
      'The rate evidence belongs to a different entity, book or currency pair.',
    );
  const value = financialDecimal(rate.rate);
  if (
    !value.greaterThan(0) ||
    !rate.approved ||
    !rate.sourceReference?.trim() ||
    rate.rateDate > date ||
    rate.validTo <= date ||
    (Date.parse(date) - Date.parse(rate.rateDate)) / 86400000 > maxAgeDays
  )
    fail(
      'A positive approved rate, current source and valid effective interval are required.',
    );
  policyScope(scope, {
    subjectId: rate.makerNaturalPersonId,
    naturalPersonId: rate.approverNaturalPersonId,
  });
  if (transactionCurrency === functionalCurrency) {
    if (!value.equals(1))
      fail('Same-currency conversion must use exact parity.');
  } else if (rate.makerNaturalPersonId === rate.approverNaturalPersonId)
    fail('Manual foreign-exchange evidence requires independent approval.');
  return value;
}
export function translateFunctional(input: {
  scope: FinancePolicyScope;
  amount: string;
  transactionCurrency: string;
  functionalCurrency: string;
  date: string;
  rate: GovernedRate;
  maxAgeDays: number;
  scale: number;
}) {
  scale(input.scale);
  const rate = validateGovernedRate(
    input.scope,
    input.rate,
    input.transactionCurrency,
    input.functionalCurrency,
    input.date,
    input.maxAgeDays,
  );
  return {
    transactionAmount: financialDecimal(input.amount).toString(),
    functionalAmount: financialDecimal(input.amount)
      .mul(rate)
      .toFixed(input.scale),
    rateHash: input.rate.evidenceHash,
    financialEffects: 0 as const,
  };
}
/** Realized difference uses the CURRENT carrying balance, including prior revaluation. */
export function settlementDifference(input: {
  remainingTransaction: string;
  settledTransaction: string;
  carryingFunctional: string;
  settledFunctional: string;
  position: 'ASSET' | 'LIABILITY';
  scale: number;
}) {
  scale(input.scale);
  const remaining = financialDecimal(input.remainingTransaction),
    settled = financialDecimal(input.settledTransaction),
    carrying = financialDecimal(input.carryingFunctional),
    cash = financialDecimal(input.settledFunctional);
  if (
    !remaining.greaterThan(0) ||
    !settled.greaterThan(0) ||
    settled.greaterThan(remaining) ||
    carrying.isNegative() ||
    cash.isNegative() ||
    !['ASSET', 'LIABILITY'].includes(input.position)
  )
    fail(
      'Settlement requires a positive unconsumed exposure and explicit asset/liability ownership.',
    );
  const released = settled.equals(remaining)
    ? carrying
    : DecimalUtil.value(
        carrying.mul(settled).div(remaining).toFixed(input.scale),
      );
  const difference =
    input.position === 'ASSET' ? cash.minus(released) : released.minus(cash);
  return {
    releasedCarrying: released.toFixed(input.scale),
    remainingCarrying: carrying.minus(released).toFixed(input.scale),
    remainingTransaction: remaining.minus(settled).toString(),
    fxGain: difference.greaterThan(0)
      ? difference.toFixed(input.scale)
      : DecimalUtil.value(0).toFixed(input.scale),
    fxLoss: difference.lessThan(0)
      ? difference.negated().toFixed(input.scale)
      : DecimalUtil.value(0).toFixed(input.scale),
    financialEffects: 0 as const,
  };
}
export function monetaryRevaluation(input: {
  owner: 'FINANCE_IAS21' | 'IFRS17_MEASUREMENT';
  previousFunctional: string;
  closingFunctional: string;
  position: 'ASSET' | 'LIABILITY';
  scale: number;
}) {
  scale(input.scale);
  if (input.owner !== 'FINANCE_IAS21')
    fail(
      'An IFRS 17-owned exposure cannot also produce a generic IAS 21 revaluation.',
    );
  if (!['ASSET', 'LIABILITY'].includes(input.position))
    fail('Explicit monetary-position ownership is required.');
  const old = financialDecimal(input.previousFunctional),
    closing = financialDecimal(input.closingFunctional);
  if (old.isNegative() || closing.isNegative())
    fail(
      'Monetary carrying amounts must be nonnegative with an explicit position.',
    );
  const movement =
    input.position === 'ASSET' ? closing.minus(old) : old.minus(closing);
  return {
    gain: movement.greaterThan(0)
      ? movement.toFixed(input.scale)
      : DecimalUtil.value(0).toFixed(input.scale),
    loss: movement.lessThan(0)
      ? movement.negated().toFixed(input.scale)
      : DecimalUtil.value(0).toFixed(input.scale),
    financialEffects: 0 as const,
  };
}
