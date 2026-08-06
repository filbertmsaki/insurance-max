export const PricingRoundingMode = {
  HALF_UP: 'HALF_UP',
  UP: 'UP',
  DOWN: 'DOWN',
} as const;

export type PricingRoundingMode =
  (typeof PricingRoundingMode)[keyof typeof PricingRoundingMode];

export const PricingProrationMethod = {
  NONE: 'NONE',
  DAILY_365: 'DAILY_365',
  DAILY_366: 'DAILY_366',
  MONTHLY_12: 'MONTHLY_12',
} as const;

export type PricingProrationMethod =
  (typeof PricingProrationMethod)[keyof typeof PricingProrationMethod];

export const AddonPricingType = {
  PERCENTAGE: 'PERCENTAGE',
  FIXED: 'FIXED',
  PER_UNIT: 'PER_UNIT',
  INCLUDED: 'INCLUDED',
} as const;

export type AddonPricingType =
  (typeof AddonPricingType)[keyof typeof AddonPricingType];
