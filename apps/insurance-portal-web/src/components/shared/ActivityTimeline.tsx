import type { ReactNode } from 'react';
import { SectionCard, EmptyState } from './DetailSections';
import { formatDateTime, humanizeCode } from './detailFormat';

export interface ActivityEntry {
  id: string | number;
  dateTime: string | null;
  action: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  performedBy?: string | null;
  remarks?: string | null;
}

interface ActivityTimelineProps {
  entries: ActivityEntry[];
  emptyText?: string;
  /** Lets each page plug in its own status badge (QuotationStatusBadge, StatusBadge, ...). */
  renderStatus?: (status: string) => ReactNode;
}

/** Secondary, scannable audit trail — humanized action + status change, not a raw event table. */
export function ActivityTimeline({
  entries,
  emptyText = 'No activity recorded.',
  renderStatus,
}: ActivityTimelineProps) {
  if (entries.length === 0) return <EmptyState text={emptyText} />;

  return (
    <SectionCard title="Activity">
      <div className="divide-y divide-slate-100">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-500">
                {formatDateTime(entry.dateTime)}
              </span>
              {entry.newStatus && renderStatus
                ? renderStatus(entry.newStatus)
                : null}
            </div>
            <p className="text-sm font-medium text-slate-900">
              {humanizeCode(entry.action)}
              {entry.previousStatus && entry.newStatus
                ? ` (${humanizeCode(entry.previousStatus)} → ${humanizeCode(entry.newStatus)})`
                : null}
            </p>
            {entry.performedBy && (
              <p className="text-xs text-slate-500">{entry.performedBy}</p>
            )}
            {entry.remarks && (
              <p className="text-xs text-slate-500">{entry.remarks}</p>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
