import { getApiErrorMessage } from '@/lib/api-error';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { apiClient } from '@/modules/shared/api/client';

export function BankSettlementReceipt({
  kind,
  id,
  refresh,
}: {
  kind: 'refunds' | 'commission-payments';
  id: string;
  refresh: () => void;
}) {
  const user = useAuthStore((s) => s.user),
    auth = useAuthStore((s) => s.authorizationContext);
  const [file, F] = useState<File>();
  const submit = useMutation({
    mutationFn: async () => {
      if (!file || file.size > 16384)
        throw Error('Select a bank observation file smaller than 16 KB.');
      const observation = JSON.parse(await file.text());
      if (
        !observation ||
        !['issuer', 'keyId', 'reference', 'settledAt', 'signature'].every(
          (k) =>
            typeof observation[k] === 'string' && observation[k].length > 0,
        )
      )
        throw Error(
          'Select the signed settlement observation supplied by the bank integration.',
        );
      return apiClient.post('/tenant/finance/' + kind + '/' + id + '/pay', {
        idempotency_key: 'bank-' + id,
        settlement_observation: observation,
      });
    },
    onSuccess: refresh,
  });
  if (
    !auth ||
    auth.userId !== user?.id ||
    auth.companyId !== user.companyId ||
    !auth.permissions.includes(
      kind === 'refunds' ? 'refunds:pay' : 'commissions:pay',
    )
  )
    return <p role="status">Awaiting verified bank settlement.</p>;
  return (
    <div className="space-y-2">
      <label className="grid gap-1 text-sm">
        Signed bank settlement observation
        <input
          type="file"
          accept=".json,application/json"
          onChange={(e) => F(e.target.files?.[0])}
        />
      </label>
      <Button
        disabled={!file || submit.isPending}
        onClick={() => submit.mutate()}
      >
        Record verified settlement
      </Button>
      {submit.isError && <p role="alert">{getApiErrorMessage(submit.error)}</p>}
    </div>
  );
}
