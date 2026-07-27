import { z } from 'zod';
import type { PricingQuoteMetadata } from '../types/pricing';

export const pricingQuoteMetadataSchema = z.object({
  pricing_quote_id: z.string().trim().min(1).nullable().optional(),
  pricing_status: z.literal('CALCULATED').nullable().optional(),
  calculated_at: z.string().trim().min(1).nullable().optional(),
  expires_at: z.string().trim().min(1).nullable().optional(),
  input_signature: z.string().trim().min(1).nullable().optional(),
  quotation_type: z.string().trim().min(1).nullable().optional(),
  currency_code: z.string().trim().min(1).nullable().optional(),
  minimum_applied: z.boolean().optional(),
  minimum_amount: z.number().finite().optional(),
  validation_errors: z.array(z.string()).optional(),
  validation_warnings: z.array(z.string()).optional(),
});

export function readPricingQuoteMetadata(
  value: unknown,
): PricingQuoteMetadata | null {
  const parsed = pricingQuoteMetadataSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
