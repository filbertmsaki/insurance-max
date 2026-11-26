import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/modules/shared/api/client';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api-error';
import { Field } from '../journals/GlFields';
import type { Register } from './asset-model';
export function AssetSourceField({
  scope,
  identity,
  today,
  date,
  initial,
  side,
  value,
  change,
}: {
  scope: { bookId: string; legalEntityId: string };
  identity: string;
  today: string;
  date: string;
  initial: Register['sources'];
  side: 'debit' | 'credit';
  value: string;
  change: (v: string) => void;
}) {
  const [text, T] = useState(''),
    [search, S] = useState(''),
    [page, P] = useState(0);
  const useInitial = !search && page === 0 && date === today;
  const query = useQuery({
    queryKey: [
      'fixed-assets',
      identity,
      scope.bookId,
      'sources',
      date,
      search,
      page,
    ],
    enabled: !!date && !useInitial,
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<Register['sources']>(
          '/tenant/finance/fixed-assets/sources',
          { params: { ...scope, q: search, to: date, page }, signal },
        )
      ).data,
  });
  const rows = useInitial ? initial : (query.data ?? []);
  const move = (n: number) => {
    P(n);
    change('');
  };
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1">
        <Field
          label="Find journal by reference or account"
          value={text}
          change={T}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            S(text.trim());
            move(0);
          }}
        >
          Search
        </Button>
      </div>
      <Field
        label="Posted source journal line"
        value={value}
        change={change}
        options={rows
          .filter((x) => Number(x[side]) > 0)
          .map((x) => ({
            value: x.journal + '|' + x.line,
            label: [
              x.reference,
              x.line,
              x.account_code,
              x.role_code,
              x[side],
            ].join(' · '),
          }))}
      />
      {query.error && <p role="alert">{getApiErrorMessage(query.error)}</p>}
      {(page > 0 || rows.length === 80) && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!page}
            onClick={() => move(page - 1)}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={rows.length < 80}
            onClick={() => move(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
