import { getApiErrorMessage } from '@/lib/api-error';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/modules/shared/api/client';
import type { FoundationScope } from '../foundation/api';

import { setupApi } from './api';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
type Request = {
  candidateId: string;
  hash: string;
  expired: boolean;
  maker: boolean;
  snapshot: {
    sourceId: string;
    eventType: string;
    description?: string;
    bankReference?: string;
    programCode?: string;
    adjustmentPeriodId?: string;
    adjustmentPeriodCode?: string;
    catchUpDate?: string;
    recoveryReason?: string;
    rateId?: string;
    originalJournalId?: string;
    evidence?: { id: string; documentId: string; hash: string };
    reference: string;
    currency: string;
    amount: string;
    transactionDate: string;
  };
  supplement?: {
    reason: string;
    evidence: { id: string; documentId: string; hash: string };
  };
  decisions: number;
  requiredCheckers: string;
  lines: {
    account: string;
    role: string;
    debit: string;
    credit: string;
    dimensions?: Record<string, string>;
  }[];
};
export function OperatingPostings({
  scope,
  canApprove,
  onDecision,
}: {
  scope: FoundationScope;
  canApprove: boolean;
  onDecision?: () => void;
}) {
  const selection = {
    legalEntityId: scope.legalEntityId,
    bookId: scope.bookId,
  };
  const [reason, setReason] = useState('');
  const identity = useAuthStore((s) => s.authorizationContext);
  const evidence = useMutation({
    mutationFn: async (e: NonNullable<Request['snapshot']['evidence']>) => {
      const file = await setupApi.evidence(scope, {
        ...e,
        purpose: 'Journal supporting document',
      });
      const url = URL.createObjectURL(file.data),
        a = document.createElement('a');
      a.href = url;
      a.download = 'journal-evidence-' + e.id;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  });
  const requests = useQuery({
    queryKey: [
      'finance-operating-postings',
      scope.tenantId,
      scope.bookId,
      identity?.userId,
      identity?.sessionId,
      identity?.authorizationVersion,
    ],
    queryFn: async () =>
      (
        await apiClient.get<Request[]>(
          '/tenant/finance/foundation/operating-postings',
          { params: selection },
        )
      ).data,
  });
  const decision = useMutation({
    mutationFn: ({
      item,
      action,
    }: {
      item: Request;
      action: 'approve' | 'renew' | 'reject';
    }) =>
      apiClient.post(
        '/tenant/finance/foundation/operating-postings/' +
          item.candidateId +
          '/' +
          action,
        { scope: selection, subjectHash: item.hash, reason: reason.trim() },
      ),
    onSuccess: async () => {
      await requests.refetch();
      onDecision?.();
    },
  });
  return (
    <section className="space-y-3 rounded border p-4">
      <h2 className="font-semibold">Journals awaiting approval</h2>
      {requests.isLoading ? (
        <p role="status">Loading accounting requests…</p>
      ) : requests.isError ? (
        <p role="alert">Accounting requests could not be loaded.</p>
      ) : requests.data?.length ? (
        <>
          <label>
            Decision reason{' '}
            <input
              className="rounded border p-2"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={2000}
            />
          </label>
          {requests.data.map((item) => (
            <article className="rounded border p-3" key={item.candidateId}>
              <p>
                {['INVOICE_ISSUED', 'RECEIPT_POSTED'].includes(
                  item.snapshot.eventType,
                ) ? (
                  <a
                    className="underline"
                    href={
                      '/apps/finance/' +
                      (item.snapshot.eventType === 'INVOICE_ISSUED'
                        ? 'invoices'
                        : 'receipts') +
                      '/' +
                      item.snapshot.sourceId
                    }
                  >
                    {item.snapshot.reference}{' '}
                  </a>
                ) : (
                  <strong>{item.snapshot.reference}</strong>
                )}{' '}
                · {item.snapshot.transactionDate} · {item.snapshot.currency}{' '}
                {item.snapshot.amount}
              </p>
              {item.snapshot.bankReference && (
                <p>Bank settlement {item.snapshot.bankReference}</p>
              )}
              {item.snapshot.description && <p>{item.snapshot.description}</p>}
              {item.snapshot.programCode && (
                <p>Program {item.snapshot.programCode}</p>
              )}
              {item.snapshot.adjustmentPeriodId && (
                <p>
                  Adjustment period{' '}
                  {item.snapshot.adjustmentPeriodCode ??
                    item.snapshot.adjustmentPeriodId}
                </p>
              )}
              {item.snapshot.catchUpDate && (
                <p>
                  Missed instalment due {item.snapshot.catchUpDate} ·{' '}
                  {item.snapshot.recoveryReason}
                </p>
              )}
              {item.snapshot.originalJournalId && (
                <p>Original journal {item.snapshot.originalJournalId}</p>
              )}
              {item.snapshot.rateId && (
                <p>Closing rate record {item.snapshot.rateId}</p>
              )}
              {item.snapshot.evidence && (
                <Button
                  variant="outline"
                  onClick={() => evidence.mutate(item.snapshot.evidence!)}
                >
                  Download supporting document
                </Button>
              )}
              {item.supplement && (
                <p>
                  Resubmission · {item.supplement.reason}{' '}
                  <Button
                    variant="outline"
                    onClick={() => evidence.mutate(item.supplement!.evidence)}
                  >
                    Download resubmission evidence
                  </Button>
                </p>
              )}
              <table className="my-2 w-full text-left">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Role</th>
                    <th>Debit</th>
                    <th>Credit</th>
                    <th>Dimensions</th>
                  </tr>
                </thead>
                <tbody>
                  {item.lines.map((line, i) => (
                    <tr key={i}>
                      <td>{line.account}</td>
                      <td>{line.role}</td>
                      <td>{line.debit}</td>
                      <td>{line.credit}</td>
                      <td>
                        {Object.entries(line.dimensions ?? {})
                          .filter(([k]) =>
                            [
                              'BRANCH',
                              'COST_CENTRE',
                              'DEPARTMENT',
                              'PRODUCT',
                            ].includes(k),
                          )
                          .map(([k, v]) => k + ' ' + v)
                          .join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                {item.expired
                  ? 'Approval expired. The preparer can renew this request.'
                  : item.decisions +
                    ' of ' +
                    item.requiredCheckers +
                    ' approvals recorded.'}
              </p>
              {item.expired && item.maker ? (
                <Button
                  disabled={!reason.trim() || decision.isPending}
                  onClick={() => decision.mutate({ item, action: 'renew' })}
                >
                  Renew approval request
                </Button>
              ) : !item.expired && !item.maker && canApprove ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={!reason.trim() || decision.isPending}
                    onClick={() => decision.mutate({ item, action: 'reject' })}
                  >
                    Reject journal
                  </Button>
                  <Button
                    disabled={!reason.trim() || decision.isPending}
                    onClick={() => decision.mutate({ item, action: 'approve' })}
                  >
                    Approve journal
                  </Button>
                </div>
              ) : null}
            </article>
          ))}
        </>
      ) : (
        <p>No journals await approval.</p>
      )}
      {evidence.isError && (
        <p role="alert">The supporting document could not be downloaded.</p>
      )}
      {decision.isError && (
        <p role="alert">{getApiErrorMessage(decision.error)}</p>
      )}
      {decision.isSuccess && (
        <p role="status">
          {decision.data.data?.journalId
            ? 'Journal posted.'
            : decision.variables.action === 'renew'
              ? 'Approval request renewed.'
              : decision.variables.action === 'reject'
                ? 'Request rejected.'
                : 'Approval recorded.'}
        </p>
      )}
    </section>
  );
}
