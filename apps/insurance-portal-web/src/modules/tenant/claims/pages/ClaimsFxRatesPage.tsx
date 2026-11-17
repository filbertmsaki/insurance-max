import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/modules/shared/api/client';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/PageHeader';
import { ClaimErrorAlert } from '../components/ClaimErrorAlert';

type Draft = {
  transaction_currency: string;
  functional_currency: string;
  rate: string;
  effective_date: string;
  source_reference: string;
  justification: string;
};
type Rate = Draft & {
  id: string;
  status: string;
  created_by: string;
  submitted_by: string | null;
};
type Audit = {
  id: string;
  action: string;
  actor_id: string;
  created_at: string;
};
const empty: Draft = {
  transaction_currency: '',
  functional_currency: '',
  rate: '',
  effective_date: '',
  source_reference: '',
  justification: '',
};
const base = '/tenant/claims-fx/rates';

export function ClaimsFxRatesPage() {
  const [draft, setDraft] = useState<Draft>(empty);
  const [edit, setEdit] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const has = useAuthStore((state) => state.hasPermission);
  const user = useAuthStore((state) => state.user);
  const client = useQueryClient();
  const list = useQuery({
    queryKey: ['claims-fx-rates'],
    queryFn: () => apiClient.get<Rate[]>(base).then((r) => r.data),
  });
  const history = useQuery({
    queryKey: ['claims-fx-rate', detail],
    enabled: !!detail,
    queryFn: () =>
      apiClient
        .get<{ rate: Rate; audit: Audit[] }>(`${base}/${detail}`)
        .then((r) => r.data),
  });
  const mutation = useMutation({
    mutationFn: async ({
      action,
      id,
      data,
    }: {
      action: string;
      id?: string;
      data?: Draft | { reason: string };
    }) => {
      if (action === 'create') return apiClient.post(base, data);
      if (action === 'edit') return apiClient.patch(`${base}/${id}`, data);
      return apiClient.post(`${base}/${id}/${action}`, data ?? {});
    },
    onSuccess: async () => {
      setDraft(empty);
      setEdit(null);
      setReason('');
      await client.invalidateQueries({ queryKey: ['claims-fx-rates'] });
      await client.invalidateQueries({ queryKey: ['claims-fx-rate'] });
    },
  });
  function save(event: FormEvent) {
    event.preventDefault();
    mutation.mutate({
      action: edit ? 'edit' : 'create',
      id: edit ?? undefined,
      data: draft,
    });
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Claims exchange rates"
        description="Manual rates require approval by a different user. Claims FX integration is incomplete; consult the event history for recorded conversions."
      />
      {has('claims.fx.create') && (
        <form
          onSubmit={save}
          className="grid gap-3 rounded border p-4 sm:grid-cols-2"
        >
          {(
            [
              ['transaction_currency', 'Transaction currency'],
              ['functional_currency', 'Functional currency'],
              ['rate', 'Rate (multiply)'],
              ['effective_date', 'Effective date'],
              ['source_reference', 'Source reference'],
              ['justification', 'Justification'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="space-y-1 text-sm">
              {label}
              <Input
                required
                type={key === 'effective_date' ? 'date' : 'text'}
                value={draft[key]}
                onChange={(event) =>
                  setDraft({ ...draft, [key]: event.target.value })
                }
              />
            </label>
          ))}
          <div className="flex gap-2">
            <Button type="submit" disabled={mutation.isPending}>
              {edit ? 'Save draft' : 'Create draft'}
            </Button>
            {edit && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEdit(null);
                  setDraft(empty);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}
      <ClaimErrorAlert error={mutation.error ?? list.error ?? history.error} />
      {list.isLoading && <p>Loading rates…</p>}
      <div className="space-y-3">
        {list.data?.map((rate) => (
          <div key={rate.id} className="space-y-2 rounded border p-4">
            <div className="font-medium">
              {rate.transaction_currency} → {rate.functional_currency}:{' '}
              {rate.rate} · {rate.status}
            </div>
            <p className="text-sm">
              Effective {rate.effective_date} · Source: {rate.source_reference}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setDetail(rate.id)}>
                Audit history
              </Button>
              {rate.status === 'DRAFT' &&
                rate.created_by === user?.id &&
                has('claims.fx.create') && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDraft({
                        transaction_currency: rate.transaction_currency,
                        functional_currency: rate.functional_currency,
                        rate: rate.rate,
                        effective_date: rate.effective_date,
                        source_reference: rate.source_reference,
                        justification: rate.justification,
                      });
                      setEdit(rate.id);
                    }}
                  >
                    Edit
                  </Button>
                )}
              {rate.status === 'DRAFT' &&
                rate.created_by === user?.id &&
                has('claims.fx.submit') && (
                  <Button
                    disabled={mutation.isPending}
                    onClick={() =>
                      mutation.mutate({ action: 'submit', id: rate.id })
                    }
                  >
                    Submit
                  </Button>
                )}
              {rate.status === 'SUBMITTED' &&
                rate.created_by !== user?.id &&
                rate.submitted_by !== user?.id &&
                has('claims.fx.approve') && (
                  <>
                    <Button
                      disabled={mutation.isPending}
                      onClick={() =>
                        mutation.mutate({ action: 'approve', id: rate.id })
                      }
                    >
                      Approve
                    </Button>
                    <Input
                      aria-label="Rejection reason"
                      placeholder="Rejection reason"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    />
                    <Button
                      variant="outline"
                      disabled={!reason.trim() || mutation.isPending}
                      onClick={() =>
                        mutation.mutate({
                          action: 'reject',
                          id: rate.id,
                          data: { reason },
                        })
                      }
                    >
                      Reject
                    </Button>
                  </>
                )}
            </div>
            {detail === rate.id && (
              <div>
                <h2 className="font-medium">Audit history</h2>
                {history.isLoading ? (
                  <p>Loading…</p>
                ) : (
                  history.data?.audit.map((entry) => (
                    <p key={entry.id} className="text-sm">
                      {entry.action} · {entry.actor_id} · {entry.created_at}
                    </p>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
