import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  foundationReadApi,
  type FoundationScope,
  type JournalSearch,
} from './api';

export function JournalSearchPanel({
  scope,
  identity,
}: {
  scope: FoundationScope;
  identity: string[];
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [mode, setMode] = useState<'VALIDATION' | 'LIVE'>('VALIDATION');
  const [search, setSearch] = useState<JournalSearch | null>(null);
  const [exportError, setExportError] = useState(false);
  const exportRequest = useRef<AbortController | null>(null);
  useEffect(() => () => exportRequest.current?.abort(), []);
  const result = useQuery({
    queryKey: [
      'foundation-journals',
      ...identity,
      scope.tenantId,
      scope.legalEntityId,
      scope.bookId,
      search,
    ],
    queryFn: ({ signal }) => foundationReadApi.journals(scope, search!, signal),
    enabled: search !== null,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    placeholderData: undefined,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
  async function exportPage() {
    if (!search) return;
    setExportError(false);
    exportRequest.current?.abort();
    const controller = new AbortController();
    exportRequest.current = controller;
    try {
      // Recheck access and integrity before exporting; export only this bounded page.
      const page = await foundationReadApi.journals(
        scope,
        search,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const rows = [
        [
          'Journal ID',
          'Accounting date',
          'Transaction date',
          'Transaction currency',
          'Functional currency',
          'Kind',
          'Reversal of',
          'Subject hash',
          'Financial effects',
        ],
        ...page.journals.map((j) => [
          j.id,
          j.accountingDate,
          j.transactionDate,
          j.transactionCurrency,
          j.functionalCurrency,
          j.kind,
          j.reversalOf ?? '',
          j.subjectHash,
          String(j.financialEffects),
        ]),
      ];
      const csv = rows
        .map((row) =>
          row.map((value) => `"${value.replace(/"/g, '""')}"`).join(','),
        )
        .join('\r\n');
      const url = URL.createObjectURL(
        new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `journals-${search.mode.toLowerCase()}-${search.from}-${search.to}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      if (controller.signal.aborted) return;
      setSearch(null);
      setExportError(true);
    }
  }
  async function exportRange() {
    if (!search) return;
    setExportError(false);
    exportRequest.current?.abort();
    const controller = new AbortController();
    exportRequest.current = controller;
    try {
      const result = await foundationReadApi.exportJournals(
        scope,
        search,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(result, null, 2)], {
          type: 'application/json',
        }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `journal-evidence-${search.mode.toLowerCase()}-${search.from}-${search.to}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      if (controller.signal.aborted) return;
      setSearch(null);
      setExportError(true);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Journal search</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            exportRequest.current?.abort();
            setExportError(false);
            setSearch({ mode, from, to });
          }}
        >
          <label>
            From{' '}
            <input
              aria-label="Journal from date"
              type="date"
              required
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            To{' '}
            <input
              aria-label="Journal to date"
              type="date"
              required
              min={from || undefined}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <label>
            Population{' '}
            <select
              aria-label="Journal population"
              value={mode}
              onChange={(e) => setMode(e.target.value as 'VALIDATION' | 'LIVE')}
            >
              <option value="VALIDATION">Validation</option>
              <option value="LIVE">Live</option>
            </select>
          </label>
          <Button type="submit">Search journals</Button>
        </form>
        {result.isFetching && <p role="status">Checking journals…</p>}
        {result.isError && (
          <p role="alert">
            Journal access or verification failed. Search again to retry.
          </p>
        )}
        {exportError && (
          <p role="alert">
            Export failed. Check your current Finance access or select a smaller
            date range, then retry.
          </p>
        )}
        {!result.isError && !result.isFetching && result.data && (
          <>
            <p>
              Showing {result.data.journals.length} journals for{' '}
              {search?.mode.toLowerCase()}.
            </p>
            <ul>
              {result.data.journals.map((j) => (
                <li key={j.id}>
                  {j.accountingDate} · {j.kind} · {j.id} ·{' '}
                  {j.transactionCurrency}/{j.functionalCurrency}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => void exportPage()}
              >
                Export current page CSV
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={() => void exportRange()}
              >
                Export date range evidence
              </Button>
              {result.data.nextCursor && (
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    exportRequest.current?.abort();
                    setSearch(
                      (current) =>
                        current && { ...current, ...result.data!.nextCursor! },
                    );
                  }}
                >
                  Next page
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
