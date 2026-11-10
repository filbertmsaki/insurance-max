import type { QuotationPreviewHistoryItem } from '../types';
import { humanizeCode, tiraText } from './quotationFormat';

/*
 * Display-only mapping of the stored quotation history. Records are never
 * modified: this only orders, labels and groups what the API returned.
 */

export type HistoryEventKind =
  | 'success'
  | 'failure'
  | 'payment'
  | 'user'
  | 'system';
export type HistoryFilter = 'all' | 'user' | 'system' | 'errors';

export interface HistoryEvent {
  title: string;
  actor: string;
  /** True when no person performed it (automated / integration event). */
  automated: boolean;
  kind: HistoryEventKind;
  /** "Draft → Completed", omitted when nothing changed. */
  transition: string | null;
  remarks: string | null;
  dateTime: string | null;
}

export interface HistoryGroup {
  key: string;
  /** Newest event of the run; the others are in `events`. */
  latest: HistoryEvent;
  events: HistoryEvent[];
  count: number;
}

const FAILURE = /fail|error|reject|exhausted|declin|not ready|invalid/i;
const SUCCESS = /complet|success|issued|approv|accept|paid|synced|acknowledg/i;
const PAYMENT = /payment|paid|receipt|invoice|refund/i;

function classify(text: string, automated: boolean): HistoryEventKind {
  if (FAILURE.test(text)) return 'failure';
  if (PAYMENT.test(text)) return 'payment';
  if (SUCCESS.test(text)) return 'success';
  return automated ? 'system' : 'user';
}

export function toHistoryEvent(
  item: QuotationPreviewHistoryItem,
): HistoryEvent {
  const actor = item.performed_by?.trim() || '';
  const automated = !actor || /^system\b/i.test(actor);
  const title = humanizeCode(item.action);
  const remarks = item.remarks?.trim() ? tiraText(item.remarks.trim()) : null;
  const prev = item.previous_status ? humanizeCode(item.previous_status) : null;
  const next = item.new_status ? humanizeCode(item.new_status) : null;
  const transition =
    prev && next && prev !== next
      ? `${prev} → ${next}`
      : !prev && next
        ? next
        : null;
  return {
    title,
    actor: automated ? 'System' : actor,
    automated,
    // Remarks carry the failure reason for integration events.
    kind: classify(
      `${item.action} ${item.new_status ?? ''} ${remarks ?? ''}`,
      automated,
    ),
    transition,
    remarks,
    dateTime: item.date_time,
  };
}

export function matchesHistoryFilter(
  event: HistoryEvent,
  filter: HistoryFilter,
) {
  if (filter === 'all') return true;
  if (filter === 'errors') return event.kind === 'failure';
  if (filter === 'system') return event.automated;
  return !event.automated;
}

/**
 * Newest first, then consecutive identical events (same title, transition,
 * remarks and actor) collapse into one group with a count.
 */
export function groupHistory(
  history: QuotationPreviewHistoryItem[],
  filter: HistoryFilter = 'all',
): HistoryGroup[] {
  const events = history
    .map((item, index) => ({ event: toHistoryEvent(item), index }))
    .sort(
      (a, b) =>
        (Date.parse(b.event.dateTime ?? '') || 0) -
          (Date.parse(a.event.dateTime ?? '') || 0) || b.index - a.index,
    )
    .map(({ event }) => event)
    .filter((event) => matchesHistoryFilter(event, filter));

  const groups: HistoryGroup[] = [];
  for (const event of events) {
    const signature = [
      event.title,
      event.transition,
      event.remarks,
      event.actor,
    ].join('\u0000');
    const last = groups[groups.length - 1];
    if (last && last.key.startsWith(signature + '\u0001')) {
      last.events.push(event);
      last.count += 1;
    } else {
      groups.push({
        key: `${signature}\u0001${groups.length}`,
        latest: event,
        events: [event],
        count: 1,
      });
    }
  }
  return groups;
}
