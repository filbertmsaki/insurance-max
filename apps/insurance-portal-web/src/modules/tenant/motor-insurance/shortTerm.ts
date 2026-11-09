import { computeCoverNoteEndFromStart } from '@/modules/tenant/quotations/wizard/utils/coverNoteDateRange';

/**
 * Short-Term (In-Transit) motor cover. It is not a separate product: it is the
 * existing Private Vehicle product and its Transit risk, quoted through the
 * normal Motor (single) or Fleet line. Only the frontend presets these.
 */
export const SHORT_TERM_COVER = {
  name: 'Short-Term (In-Transit)',
  motorClass: 'Private Vehicle',
  productCode: 'SP014001000000',
  riskCode: 'SP014001000007',
  durationDays: 30,
} as const;

export type ShortTermMode = 'single' | 'fleet';

/**
 * Expiry = start + 30 calendar days − 1 day, ending 23:59:59 — the same
 * inclusive-end convention the other cover periods use.
 */
export function shortTermExpiry(validFrom: string): string {
  return computeCoverNoteEndFromStart(validFrom, SHORT_TERM_COVER.durationDays);
}

/**
 * True when a saved quotation covers the Short-Term transit risk, so it is
 * reopened in the Short-Term wizard. Looks at the single-vehicle risk rows,
 * the fleet-wide cover and every fleet vehicle (saved record or draft).
 */
export function isShortTermQuotation(record: unknown): boolean {
  const target = SHORT_TERM_COVER.riskCode;
  const seen = new Set<unknown>();
  const visit = (node: unknown, depth: number): boolean => {
    if (!node || typeof node !== 'object' || depth > 8 || seen.has(node)) {
      return false;
    }
    seen.add(node);
    if (Array.isArray(node)) return node.some((item) => visit(item, depth + 1));
    const value = node as Record<string, unknown>;
    if (value.risk_code === target) return true;
    return Object.values(value).some((child) => visit(child, depth + 1));
  };
  return visit(record, 0);
}
