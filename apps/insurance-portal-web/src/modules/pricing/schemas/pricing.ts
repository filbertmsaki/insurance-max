import { z } from 'zod';
import type { PricingQuoteMetadata } from '../types/pricing';

export const pricingQuoteMetadataSchema = z.object({
  pricing_quote_id: z.string().trim().min(1).nullable().optional(),
  pricing_status: z.enum(['CALCULATED', 'STALE']).nullable().optional(),
  calculated_at: z.string().trim().min(1).nullable().optional(),
  expires_at: z.string().trim().min(1).nullable().optional(),
  input_signature: z.string().trim().min(1).nullable().optional(),
  pricing_input_signature: z.string().trim().min(1).nullable().optional(),
  pricing_is_stale: z.boolean().optional(),
  stale_reason: z.string().trim().min(1).nullable().optional(),
  quotation_type: z.string().trim().min(1).nullable().optional(),
  currency_code: z.string().trim().min(1).nullable().optional(),
  exchange_rate_snapshot: z
    .object({
      quotation_currency_code: z.string().trim().min(1),
      base_currency_code: z.string().trim().min(1),
      exchange_rate: z.number().finite(),
      exchange_rate_source: z.enum(['PARITY', 'MANUAL']),
      exchange_rate_date: z.string().trim().min(1),
      exchange_rate_precision: z.number().int().nonnegative(),
      approval_required: z.boolean(),
      approval_granted: z.boolean(),
      approved_by_user_id: z.string().trim().min(1).nullable(),
      approved_at: z.string().trim().min(1).nullable(),
      conversion_direction: z.literal('QUOTE_TO_BASE_MULTIPLY'),
      rounding_method: z.literal('ROUND_HALF_UP'),
    })
    .nullable()
    .optional(),
  minimum_applied: z.boolean().optional(),
  minimum_amount: z.number().finite().optional(),
  discount_control: z
    .object({
      max_rate: z.number().finite().nullable(),
      max_amount: z.number().finite().nullable(),
      approval_threshold_rate: z.number().finite().nullable(),
      approval_threshold_amount: z.number().finite().nullable(),
      effective_from: z.string().nullable(),
      effective_to: z.string().nullable(),
    })
    .nullable()
    .optional(),
  loading_control: z
    .object({
      max_rate: z.number().finite().nullable(),
      max_amount: z.number().finite().nullable(),
      approval_threshold_rate: z.number().finite().nullable(),
      approval_threshold_amount: z.number().finite().nullable(),
      effective_from: z.string().nullable(),
      effective_to: z.string().nullable(),
    })
    .nullable()
    .optional(),
  discount_approval_required: z.boolean().optional(),
  loading_approval_required: z.boolean().optional(),
  validation_errors: z.array(z.string()).optional(),
  validation_warnings: z.array(z.string()).optional(),
});

export function readPricingQuoteMetadata(
  value: unknown,
): PricingQuoteMetadata | null {
  const parsed = pricingQuoteMetadataSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
