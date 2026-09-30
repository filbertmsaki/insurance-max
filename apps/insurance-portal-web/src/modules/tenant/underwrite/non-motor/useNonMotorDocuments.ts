import { useQuery } from '@tanstack/react-query';
import { productDefinitionsApi } from '@/modules/tenant/product-engine/api/product-definitions';
import { nonMotorApi } from '../api';
import { underwriteKeys } from '../hooks';

export const quotationDocumentsKey = (quotationId: string) =>
  [...underwriteKeys.all, 'non-motor', 'documents', quotationId] as const;

export function useProductDocumentRequirements(
  productId: string | undefined,
  subClassId?: string,
) {
  return useQuery({
    queryKey: [
      ...underwriteKeys.all,
      'non-motor',
      'document-requirements',
      productId ?? '',
      subClassId ?? '',
    ],
    queryFn: () =>
      productDefinitionsApi.publishedDefinition(productId!, {
        sub_class_id: subClassId || undefined,
      }),
    select: (definition) =>
      [...definition.documentRequirements]
        .filter((item) => item.appliesTo === 'QUOTATION')
        .sort((a, b) => a.sortOrder - b.sortOrder),
    enabled: Boolean(productId),
    staleTime: 60_000,
  });
}

/** Mandatory quotation documents not yet attached (for the review step). */
export function useMissingMandatoryDocuments(
  quotationId: string | null,
  productId: string | undefined,
  subClassId?: string,
) {
  const requirements = useProductDocumentRequirements(productId, subClassId);
  const documents = useQuery({
    queryKey: quotationDocumentsKey(quotationId ?? ''),
    queryFn: () => nonMotorApi.getQuotationDocuments(quotationId!),
    enabled: Boolean(quotationId),
  });
  const attachedTypes = new Set(
    (documents.data ?? []).map((document) => document.document_type),
  );
  return (requirements.data ?? []).filter(
    (requirement) =>
      requirement.isMandatory && !attachedTypes.has(requirement.code),
  );
}
