import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/modules/shared/api/client';
import { getApiErrorMessage } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import { Field } from '../journals/GlFields';
import { choices, currentRows, type Info, type Register } from './ap-model';
export function PaymentSchedule({
  registry,
  scope,
  date,
  identity,
  prepare,
}: {
  registry: Register;
  scope: { bookId?: string; legalEntityId?: string };
  date: string;
  identity: string;
  prepare: boolean;
}) {
  const [discounts, D] = useState(false),
    [selection, select] = useState<
      Record<string, { itemId: string; bankId: string; requestKey: string }>
    >({});
  const qc = useQueryClient(),
    key = ['ap-schedule', identity, scope.bookId, date, discounts];
  const due = useQuery({
    queryKey: key,
    enabled: !!date,
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<Info[]>('/tenant/finance/payables/schedule', {
          params: { ...scope, payOn: date, discounts },
          signal,
        })
      ).data,
  });
  const schedule = useMutation({
    mutationFn: () =>
      apiClient.post('/tenant/finance/payables/schedule', {
        scope,
        payOn: date,
        takeDiscount: discounts,
        selections: Object.values(selection),
      }),
    onSuccess: async () => {
      select({});
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['ap-schedule', identity] }),
        qc.invalidateQueries({ queryKey: ['accounts-payable', identity] }),
      ]);
    },
  });
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Open bills eligible for payment</h2>
      <label>
        <input
          type="checkbox"
          checked={discounts}
          onChange={(e) => {
            D(e.target.checked);
            select({});
          }}
        />{' '}
        Include bills eligible for early payment discounts
      </label>
      {due.isError && <p role="alert">{getApiErrorMessage(due.error)}</p>}
      {due.data?.length === 0 && (
        <p>No unreserved bills are due for this selection.</p>
      )}
      {due.data?.map((r) => (
        <div
          className="flex flex-wrap items-center gap-3 border-b py-2"
          key={r.id}
        >
          <label>
            <input
              type="checkbox"
              disabled={!prepare}
              checked={!!selection[r.id]}
              onChange={(e) => {
                const next = { ...selection };
                if (e.target.checked) {
                  const banks = currentRows(registry.records, 'BANK').filter(
                    (b) => b.party === r.party && b.currency === r.currency,
                  );
                  next[r.id] = {
                    itemId: r.id,
                    bankId: banks.length === 1 ? banks[0].id : '',
                    requestKey: crypto.randomUUID(),
                  };
                } else delete next[r.id];
                select(next);
              }}
            />{' '}
            {r.reference} · {r.currency} {r.available} · Due {r.dueDate}
          </label>
          {selection[r.id] && (
            <Field
              label="Pay to account"
              value={selection[r.id].bankId}
              options={choices(
                currentRows(registry.records, 'BANK').filter(
                  (b) => b.party === r.party && b.currency === r.currency,
                ),
              )}
              change={(bankId) =>
                select({ ...selection, [r.id]: { ...selection[r.id], bankId } })
              }
            />
          )}
        </div>
      ))}
      {prepare && (
        <Button
          disabled={
            schedule.isPending ||
            !Object.keys(selection).length ||
            Object.values(selection).some((x) => !x.bankId)
          }
          onClick={() => schedule.mutate()}
        >
          Prepare selected payment requests
        </Button>
      )}
      {schedule.isSuccess && (
        <p role="status">
          Payment requests are ready for independent approval.
        </p>
      )}
      {schedule.isError && (
        <p role="alert">{getApiErrorMessage(schedule.error)}</p>
      )}
    </section>
  );
}
