import type { CustomerRecord } from '@/modules/tenant/customers/types';
import { buildQuotationPayload, type QuotationFormSchemaValues } from '../../schemas';

type QuotationPayloadPreviewContext = {
  salePointCode?: string | null;
  productCode?: string | null;
  productName?: string | null;
  existingCustomer?: CustomerRecord | null;
};

export function buildQuotationPayloadPreview(
  values: QuotationFormSchemaValues,
  context: QuotationPayloadPreviewContext = {},
) {
  return buildQuotationPayload(values, {
    salePointCode: context.salePointCode ?? 'SALE-POINT',
    productCode: context.productCode ?? values.product_id ?? 'PRODUCT',
    existingCustomer: context.existingCustomer ?? null,
  });
}
