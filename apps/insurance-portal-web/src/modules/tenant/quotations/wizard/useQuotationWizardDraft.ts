import { useCallback, useEffect } from 'react';
import type { QuotationFormSchemaValues } from '../schemas';

const DRAFT_STORAGE_KEY = 'insurance-portal:quotation-wizard:draft';

/**
 * Clears browser-local wizard snapshots so reload/refresh starts a fresh
 * unsaved wizard. Explicit backend draft saving remains the source of truth.
 */
export function useQuotationWizardDraft(
  _quotationId: string | null,
  draftScope = 'new',
) {
  const key = `${DRAFT_STORAGE_KEY}:${draftScope}`;

  useEffect(() => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* Storage may be unavailable. */
    }
  }, [key]);

  const loadDraft =
    useCallback((): Partial<QuotationFormSchemaValues> | null => {
      return null;
    }, []);

  const saveDraft = useCallback(
    (values: Partial<QuotationFormSchemaValues>) => {
      void values;
      /* Intentionally not persisted across refresh. */
    },
    [],
  );

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* Storage may be unavailable. */
    }
  }, [key]);

  return { loadDraft, saveDraft, clearDraft };
}
