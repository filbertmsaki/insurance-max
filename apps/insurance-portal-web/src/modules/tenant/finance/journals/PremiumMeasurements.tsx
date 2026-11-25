import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api-error';
import { apiClient } from '@/modules/shared/api/client';
import { Field } from './GlFields';

interface Memo {
  id: string;
  invoiceId: string;
  hash: string;
  event: string;
  date: string;
  reference: string;
  amount: string;
  currency: string;
  movements: number;
}

export function PremiumMeasurements({
  scope,
  identity,
  canPrepare,
  refresh,
}: {
  scope: { bookId: string; legalEntityId: string };
  identity: string;
  canPrepare: boolean;
  refresh: () => Promise<unknown>;
}) {
  const [lookup, setLookup] = useState(''),
    [invoice, search] = useState(''),
    [delivery, setDelivery] = useState(''),
    [reason, setReason] = useState('');
  const qc = useQueryClient();
  const memos = useQuery({
    queryKey: ['gl-premium-memos', identity, scope.bookId, invoice],
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<Memo[]>(
          '/tenant/finance/foundation/gl/premium-memos',
          { params: { ...scope, invoice }, signal },
        )
      ).data,
  });
  const submit = useMutation({
    mutationFn: async () => {
      const input = JSON.parse(delivery);
      return (
        await apiClient.post('/tenant/finance/foundation/gl/measurements', {
          scope,
          reason,
          input,
        })
      ).data;
    },
    onSuccess: async () => {
      setDelivery('');
      await Promise.all([
        memos.refetch(),
        refresh(),
        qc.invalidateQueries({ queryKey: ['finance-operating-postings'] }),
      ]);
    },
  });
  return (
    <section className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search(lookup.trim());
        }}
        className="flex items-end gap-2"
      >
        <Field label="Invoice number or ID" value={lookup} change={setLookup} />
        <Button>Find memoranda</Button>
      </form>
      {memos.isError && <p role="alert">{getApiErrorMessage(memos.error)}</p>}
      {memos.data && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption>Latest premium billing memoranda</caption>
            <thead>
              <tr>
                {[
                  'Date',
                  'Invoice',
                  'Event',
                  'Premium',
                  'Memorandum ID and hash',
                  'Measurement movements',
                ].map((h) => (
                  <th scope="col" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {memos.data.map((m) => (
                <tr key={m.id}>
                  <td>{m.date}</td>
                  <td>{m.reference}</td>
                  <td>{m.event}</td>
                  <td>
                    {m.amount} {m.currency}
                  </td>
                  <td className="break-all">
                    {m.id}
                    <br />
                    {m.hash}
                  </td>
                  <td>{m.movements}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!memos.data.length && (
            <p>No premium memoranda match this book and invoice.</p>
          )}
        </div>
      )}
      {canPrepare && (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate();
          }}
        >
          <label className="grid gap-1">
            Signed measurement result (JSON)
            <textarea
              className="rounded border p-2 font-mono"
              rows={5}
              required
              value={delivery}
              onChange={(e) => setDelivery(e.target.value)}
            />
          </label>
          <Field
            label="Measurement submission reason"
            value={reason}
            change={setReason}
          />
          <Button
            disabled={submit.isPending || !delivery.trim() || !reason.trim()}
          >
            Submit measurement
          </Button>
        </form>
      )}
      {submit.isError && <p role="alert">{getApiErrorMessage(submit.error)}</p>}
      {submit.isSuccess && (
        <p role="status">
          {submit.data.state === 'NO_MOVEMENT'
            ? 'Zero movement recorded.'
            : submit.data.state === 'REJECTED'
              ? 'Finance rejected this measurement journal.'
              : submit.data.state === 'POSTED'
                ? 'This measurement journal is posted.'
                : submit.data.reused
                  ? 'This measurement is awaiting independent approval.'
                  : 'Measurement submitted for independent approval.'}
        </p>
      )}
    </section>
  );
}
