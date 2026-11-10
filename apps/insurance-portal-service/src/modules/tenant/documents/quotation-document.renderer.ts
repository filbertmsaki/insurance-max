import { renderBrandedDocument } from './branded-document.renderer';
import type { QuotationDocument } from './quotation-document.model';

/** Renders the customer-facing quotation with the shared document layout. */
export function renderQuotationDocument(
  doc: QuotationDocument,
): Promise<Uint8Array> {
  return renderBrandedDocument(doc);
}
