import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  foundationReadApi,
  type FoundationScope,
  type FoundationDocumentSummary,
} from './api';

const fieldClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm';
const today = () => new Date().toISOString().slice(0, 10);

export function TrialBalancePanel({
  scope,
  identity,
}: {
  scope: FoundationScope;
  identity: string[];
}) {
  const [openingId, setOpeningId] = useState('');
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [request, setRequest] = useState<{
    opening: FoundationDocumentSummary;
    from: string;
    to: string;
  } | null>(null);
  const [accountCode, setAccountCode] = useState('');
  const openings = useQuery({
    queryKey: [
      'finance-foundation',
      ...identity,
      scope.bookId,
      'reviewed-openings',
    ],
    queryFn: ({ signal }) =>
      foundationReadApi.documents(scope, 'OPENING', signal),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
  const available =
    openings.data?.filter((item) => item.state === 'REVIEWED') ?? [];
  const selected = available.find((item) => item.id === openingId);
  const report = useQuery({
    queryKey: [
      'finance-foundation',
      ...identity,
      scope.bookId,
      'trial-balance',
      request?.opening.id,
      request?.opening.subject_hash,
      request?.from,
      request?.to,
    ],
    queryFn: ({ signal }) =>
      foundationReadApi.trialBalance(scope, request!, signal),
    enabled: Boolean(
      request &&
      available.some(
        (item) =>
          item.id === request.opening.id &&
          item.subject_hash === request.opening.subject_hash,
      ),
    ),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
  const current =
    request &&
    selected?.id === request.opening.id &&
    selected.subject_hash === request.opening.subject_hash &&
    from === request.from &&
    to === request.to;
  const visible =
    current && !openings.isError && !report.isError ? report.data : undefined;
  const account = useQuery({
    queryKey: [
      'finance-foundation',
      ...identity,
      scope.bookId,
      'account-ledger',
      request?.opening.id,
      request?.from,
      request?.to,
      accountCode,
    ],
    queryFn: ({ signal }) =>
      foundationReadApi.accountLedger(
        scope,
        { ...request!, accountCode },
        signal,
      ),
    enabled: Boolean(
      visible?.rows.some((row) => row.accountCode === accountCode),
    ),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const periodJournals =
    account.data?.sourceJournals.filter(
      (journal) => journal.date >= from && journal.date < to,
    ) ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Trial balance</CardTitle>
        <p className="text-sm text-slate-500">
          Read certified account totals for one book and accounting period. The
          end date is exclusive.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {openings.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Opening certificates unavailable</AlertTitle>
            <AlertDescription>
              Refresh the book to verify access again.
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            Reviewed opening
            <select
              className={fieldClass}
              value={openingId}
              onChange={(event) => {
                setOpeningId(event.target.value);
                setRequest(null);
              }}
            >
              <option value="">Select certificate</option>
              {available.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.document_key} · {item.mode} · v{item.version}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Trial balance from
            <input
              className={fieldClass}
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setRequest(null);
              }}
            />
          </label>
          <label className="text-sm">
            To (exclusive)
            <input
              className={fieldClass}
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setRequest(null);
              }}
            />
          </label>
        </div>
        {!openings.isLoading && available.length === 0 ? (
          <p className="text-sm text-slate-500">
            No reviewed opening certificate is available in the latest 50
            records.
          </p>
        ) : null}
        <Button
          disabled={
            !selected || !from || !to || from >= to || report.isFetching
          }
          onClick={() => {
            setAccountCode('');
            setRequest({ opening: selected!, from, to });
          }}
        >
          Read trial balance
        </Button>
        {report.isError && current ? (
          <Alert variant="destructive">
            <AlertTitle>Trial balance unavailable</AlertTitle>
            <AlertDescription>
              The selected evidence or period could not be verified. No totals
              are shown.
            </AlertDescription>
          </Alert>
        ) : null}
        {report.isFetching && current ? (
          <p role="status">Verifying ledger totals…</p>
        ) : null}
        {visible ? (
          <>
            <p className="text-sm">
              {visible.mode} · {visible.currency} · {visible.rows.length}{' '}
              accounts · evidence {visible.evidenceHash.slice(0, 16)}…
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  Trial balance for {scope.book_code}
                </caption>
                <thead>
                  <tr className="border-b">
                    {['Account', 'Opening', 'Debit', 'Credit', 'Closing'].map(
                      (name) => (
                        <th className="p-2" scope="col" key={name}>
                          {name}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visible.rows.map((row) => (
                    <tr className="border-b" key={row.accountCode}>
                      <td className="p-2">
                        <Button
                          variant="link"
                          onClick={() => setAccountCode(row.accountCode)}
                        >
                          {row.accountCode}
                        </Button>
                      </td>
                      <td className="p-2">{row.opening}</td>
                      <td className="p-2">{row.debit}</td>
                      <td className="p-2">{row.credit}</td>
                      <td className="p-2">{row.closing}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <th className="p-2" scope="row">
                      Period totals
                    </th>
                    <td />
                    <td className="p-2">{visible.totalDebit}</td>
                    <td className="p-2">{visible.totalCredit}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            {accountCode && account.isError ? (
              <Alert variant="destructive">
                <AlertTitle>Account activity unavailable</AlertTitle>
                <AlertDescription>
                  The account evidence could not be verified.
                </AlertDescription>
              </Alert>
            ) : null}
            {accountCode && account.isFetching ? (
              <p role="status">Verifying account activity…</p>
            ) : null}
            {accountCode &&
            account.data &&
            !account.isError &&
            account.data.evidenceHash === visible.evidenceHash ? (
              <div className="rounded-md border p-4">
                <h3 className="font-semibold">Account {accountCode}</h3>
                <p className="text-sm">
                  {periodJournals.length} period source journals · closing{' '}
                  {account.data.closing} {account.data.currency}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {periodJournals.map((journal) => (
                    <li key={journal.id}>
                      {journal.date} · {journal.id} · evidence{' '}
                      {journal.subjectHash.slice(0, 12)}…
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
