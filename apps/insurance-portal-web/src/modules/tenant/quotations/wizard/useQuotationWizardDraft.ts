import { useCallback, useEffect, useRef } from 'react';
import type { QuotationFormSchemaValues } from '../schemas';

const DRAFT_STORAGE_KEY = 'insurance-portal:quotation-wizard:draft';

/**
 * Persists in-progress wizard form values to localStorage so a page refresh
 * (or accidental navigation away) before the first "Save Draft" doesn't lose
 * everything. Mirrors the pattern already used by tiramis-wizard's
 * `useTiramisWizardDraft`, generalized to react-hook-form's `watch` stream
 * instead of local component state.
 *
 * Once a quotation has been saved to the backend (`quotationId` is set),
 * the draft is cleared — the backend record is the source of truth from then on.
 */
export function useQuotationWizardDraft(
  quotationId: string | null,
  draftScope = 'new',
) {
  const key = `${DRAFT_STORAGE_KEY}:${draftScope}`;
  const cleared = useRef(false);

  useEffect(() => {
    if (quotationId && !cleared.current) {
      localStorage.removeItem(key);
      cleared.current = true;
    }
  }, [quotationId, key]);

  const loadDraft = useCallback((): Partial<QuotationFormSchemaValues> | null => {
    if (quotationId) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Partial<QuotationFormSchemaValues>;
    } catch {
      return null;
    }
  }, [key, quotationId]);

  const saveDraft = useCallback((values: Partial<QuotationFormSchemaValues>) => {
    if (quotationId) return;
    localStorage.setItem(key, JSON.stringify(values));
  }, [key, quotationId]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(key);
  }, [key]);

  return { loadDraft, saveDraft, clearDraft };
}
