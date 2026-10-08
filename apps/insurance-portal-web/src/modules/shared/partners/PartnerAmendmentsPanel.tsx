import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/modules/shared/api/client';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';

type Amendment = {
  id: string;
  proposed_by_company_id: string;
  proposed_terms: Record<string, string | number | null>;
  note: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
  response_reason: string | null;
  created_at: string;
};

export function PartnerAmendmentsPanel({
  relationshipId,
  apiRoot,
}: {
  relationshipId: string;
  apiRoot: '/insurance-partners' | '/partner-relationships';
}) {
  const companyId = useAuthStore((state) => state.company?.id);
  const client = useQueryClient();
  const [commissionRate, setCommissionRate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [agreementReference, setAgreementReference] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [note, setNote] = useState('');
  const path = `${apiRoot}/${relationshipId}/amendments`;
  const query = useQuery({
    queryKey: ['partner-amendments', relationshipId],
    queryFn: () =>
      apiClient.get<Amendment[]>(path).then((response) => response.data),
  });
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({
        queryKey: ['partner-amendments', relationshipId],
      }),
      client.invalidateQueries({ queryKey: ['insurance-partners'] }),
      client.invalidateQueries({ queryKey: ['intermediary', 'relationships'] }),
    ]);
  };
  const mutation = useMutation({
    mutationFn: async ({
      action,
      amendmentId,
    }: {
      action: 'propose' | 'accept' | 'reject' | 'withdraw';
      amendmentId?: string;
    }) => {
      if (action === 'propose') {
        const proposed_terms: Record<string, string | number | null> = {};
        if (commissionRate.trim())
          proposed_terms.commission_rate = Number(commissionRate);
        if (startDate) proposed_terms.start_date = startDate;
        if (endDate) proposed_terms.end_date = endDate;
        if (agreementReference.trim())
          proposed_terms.agreement_reference = agreementReference.trim();
        if (documentUrl.trim())
          proposed_terms.agreement_document_url = documentUrl.trim();
        return apiClient.post(path, {
          ...proposed_terms,
          note: note.trim() || undefined,
        });
      }
      const url = `${path}/${amendmentId}/${action}`;
      return action === 'withdraw'
        ? apiClient.patch(url, {})
        : apiClient.patch(url, { reason: note.trim() || undefined });
    },
    onSuccess: async (_result, variables) => {
      const successMessage = {
        accept: 'Agreement amendment accepted',
        reject: 'Agreement amendment rejected',
        withdraw: 'Agreement amendment withdrawn',
      } as const;
      toast.success(
        variables.action === 'propose'
          ? 'Agreement amendment proposed'
          : successMessage[variables.action],
      );
      if (variables.action === 'propose') {
        setCommissionRate('');
        setStartDate('');
        setEndDate('');
        setAgreementReference('');
        setDocumentUrl('');
        setNote('');
      }
      await refresh();
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : 'Agreement change could not be saved',
      ),
  });

  return (
    <div className="space-y-3 rounded-md border p-3">
      <h4 className="text-sm font-semibold">Agreement changes</h4>
      {query.isLoading ? (
        <p className="text-xs text-slate-500">Loading agreement history…</p>
      ) : null}
      {query.isError ? (
        <p className="text-xs text-red-600">
          Could not load agreement history.
        </p>
      ) : null}
      {(query.data ?? []).map((amendment) => {
        const proposedByMe = amendment.proposed_by_company_id === companyId;
        return (
          <div
            key={amendment.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-xs"
          >
            <div className="min-w-56 flex-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{amendment.status}</Badge>
                <span>
                  {proposedByMe
                    ? 'Proposed by your organization'
                    : 'Proposed by partner'}
                </span>
                <span className="text-slate-500">
                  {new Date(amendment.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="mt-1 text-slate-600">
                {Object.entries(amendment.proposed_terms)
                  .map(
                    ([key, value]) =>
                      `${key.replaceAll('_', ' ')}: ${value ?? 'cleared'}`,
                  )
                  .join(' · ')}
              </div>
              {amendment.note || amendment.response_reason ? (
                <div className="mt-1 text-slate-500">
                  {amendment.note ?? amendment.response_reason}
                </div>
              ) : null}
            </div>
            {amendment.status === 'PENDING' ? (
              <div className="flex gap-1">
                {proposedByMe ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={mutation.isPending}
                    onClick={() =>
                      mutation.mutate({
                        action: 'withdraw',
                        amendmentId: amendment.id,
                      })
                    }
                  >
                    Withdraw
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      disabled={mutation.isPending}
                      onClick={() =>
                        mutation.mutate({
                          action: 'accept',
                          amendmentId: amendment.id,
                        })
                      }
                    >
                      Accept terms
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={mutation.isPending}
                      onClick={() =>
                        mutation.mutate({
                          action: 'reject',
                          amendmentId: amendment.id,
                        })
                      }
                    >
                      Reject
                    </Button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          aria-label="Proposed commission rate"
          type="number"
          min="0"
          max="1"
          step="0.001"
          value={commissionRate}
          onChange={(event) => setCommissionRate(event.target.value)}
          placeholder="Commission rate (0–1)"
        />
        <Input
          aria-label="Proposed agreement reference"
          value={agreementReference}
          onChange={(event) => setAgreementReference(event.target.value)}
          placeholder="Agreement reference"
        />
        <Input
          aria-label="Proposed agreement start date"
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
        />
        <Input
          aria-label="Proposed agreement end date"
          type="date"
          value={endDate}
          onChange={(event) => setEndDate(event.target.value)}
        />
        <Input
          aria-label="Agreement document link"
          type="url"
          value={documentUrl}
          onChange={(event) => setDocumentUrl(event.target.value)}
          placeholder="Agreement document URL"
        />
        <Textarea
          aria-label="Amendment note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Reason or note"
          rows={2}
        />
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={
          mutation.isPending ||
          (!commissionRate &&
            !startDate &&
            !endDate &&
            !agreementReference.trim() &&
            !documentUrl.trim())
        }
        onClick={() => mutation.mutate({ action: 'propose' })}
      >
        Propose agreement change
      </Button>
    </div>
  );
}
