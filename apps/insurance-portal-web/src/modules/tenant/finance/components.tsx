/* eslint-disable react-refresh/only-export-components */

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createBrowserSafeId } from '@/lib/ids';
import { formatMoney as formatConfiguredMoney } from '@/modules/shared/formatting/number-format';

export function createIdempotencyKey(prefix: string) {
  return `${prefix}:${createBrowserSafeId()}`;
}

export function formatMoney(
  amount: string | number | null | undefined,
  currency?: string | null,
) {
  return formatConfiguredMoney(amount ?? 0, currency);
}

export function formatDate(value?: string | null) {
  if (!value) return ' - ';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

export function partyName(
  party?: {
    company_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    customer_no?: string | null;
    name?: string | null;
  } | null,
) {
  if (!party) return ' - ';

  return (
    party.company_name ||
    party.name ||
    [party.first_name, party.last_name].filter(Boolean).join(' ') ||
    party.customer_no ||
    ' - '
  );
}

export function FinanceStatusBadge({ status }: { status?: string | null }) {
  const normalized = String(status ?? 'UNKNOWN').toUpperCase();
  const variant =
    normalized.includes('PAID') ||
    normalized === 'POSTED' ||
    normalized === 'MATCHED'
      ? 'default'
      : normalized.includes('REVERSE') ||
          normalized.includes('VOID') ||
          normalized.includes('FAILED') ||
          normalized.includes('CANCEL')
        ? 'destructive'
        : 'secondary';

  return <Badge variant={variant}>{normalized}</Badge>;
}

export function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="max-w-[70%] text-right text-slate-900">{value}</span>
    </div>
  );
}

export function MetricCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold text-slate-900">{value}</div>
        {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export function JsonCard({ title, value }: { title: string; value: unknown }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
          {JSON.stringify(value, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}
