import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/modules/shared/api/client';
import { ClaimErrorAlert } from '../../components/ClaimErrorAlert';

type Snapshot = {
  id: string;
  event_type: string;
  event_id: string;
  transaction_currency: string;
  functional_currency: string;
  rate: string;
  source_type: string;
  source_reference: string | null;
  effective_date: string;
  original_amount: string;
  converted_amount: string;
  version: number;
};

export function ClaimFxHistoryTab({ claimId }: { claimId: string }) {
  const history = useQuery({
    queryKey: ['claim-fx-history', claimId],
    queryFn: () =>
      apiClient
        .get<Snapshot[]>(`/tenant/claims-fx/claims/${claimId}/snapshots`)
        .then((r) => r.data),
  });
  if (history.isLoading) return <p>Loading FX history…</p>;
  if (history.isError) return <ClaimErrorAlert error={history.error} />;
  if (!history.data?.length)
    return (
      <p>
        No governed FX snapshots exist for this claim. Historical rate
        provenance is unverified.
      </p>
    );
  return (
    <div className="space-y-3">
      {!history.data.some(
        (item) => item.event_type === 'CLAIM_REGISTRATION',
      ) && (
        <p>
          Registration rate provenance is unverified; later snapshots do not
          verify historical rates.
        </p>
      )}
      {history.data.map((item) => (
        <div className="rounded border p-4" key={item.id}>
          <p className="font-medium">
            {item.event_type} · version {item.version}
          </p>
          <p>
            {item.original_amount} {item.transaction_currency} × {item.rate} ={' '}
            {item.converted_amount} {item.functional_currency}
          </p>
          <p className="text-sm">
            {item.source_type} {item.source_reference ?? ''} · effective{' '}
            {item.effective_date}
          </p>
        </div>
      ))}
    </div>
  );
}
