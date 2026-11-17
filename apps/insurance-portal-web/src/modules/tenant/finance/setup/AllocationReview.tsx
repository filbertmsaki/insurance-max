import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { FoundationScope } from '../foundation/api';
import { CONFIG_REVIEW, setupApi } from './api';

export function AllocationReview({
  scope,
  identity,
  permissions,
}: {
  scope: FoundationScope;
  identity: string[];
  permissions: string[];
}) {
  const [reason, setReason] = useState('');
  const [selected, setSelected] = useState('');
  const client = useQueryClient();
  const key = [
    'finance-allocation-previews',
    ...identity,
    scope.tenantId,
    scope.legalEntityId,
    scope.bookId,
  ];
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => setupApi.allocationPreviews(scope, signal),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const mutation = useMutation({
    mutationFn: (row: { id: string; subject_hash: string }) =>
      setupApi.reviewAllocationPreview(
        scope,
        row.id,
        row.subject_hash,
        reason.trim(),
      ),
    onSuccess: async () => {
      setReason('');
      setSelected('');
      await client.invalidateQueries({ queryKey: key });
    },
  });
  if (query.isError)
    return (
      <p role="alert">Allocation previews could not be loaded for this book.</p>
    );
  if (!query.data) return <p role="status">Loading allocation previews…</p>;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recurring allocation previews</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">
          Review the exact proposed lines. A review is inactive and does not
          authorize posting.
        </p>
        {!query.data.length && (
          <p>No allocation previews are available for this book.</p>
        )}
        {query.data.map((row) => (
          <article
            key={row.id}
            className="space-y-2 rounded border p-3 text-sm"
          >
            <p>
              <strong>{row.occurrence_date}</strong> · {row.payload.currency} ·{' '}
              {row.review_id ? 'Reviewed inactive' : 'Awaiting review'}
            </p>
            <p className="break-all">Evidence hash: {row.subject_hash}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th>Branch</th>
                    <th>Role</th>
                    <th>Debit minor units</th>
                    <th>Credit minor units</th>
                  </tr>
                </thead>
                <tbody>
                  {row.payload.lines.map((line, i) => (
                    <tr key={i}>
                      <td>{line.branch}</td>
                      <td>{line.role}</td>
                      <td>{line.debitMinor}</td>
                      <td>{line.creditMinor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!row.review_id && permissions.includes(CONFIG_REVIEW) && (
              <div className="space-y-2">
                <label className="block">
                  Review reason
                  <textarea
                    aria-label={`Review reason for ${row.occurrence_date}`}
                    className="w-full rounded border p-2"
                    value={selected === row.id ? reason : ''}
                    onChange={(e) => {
                      setSelected(row.id);
                      setReason(e.target.value);
                    }}
                  />
                </label>
                <Button
                  disabled={
                    mutation.isPending || selected !== row.id || !reason.trim()
                  }
                  onClick={() => mutation.mutate(row)}
                >
                  Review inactive preview
                </Button>
              </div>
            )}
          </article>
        ))}
        {mutation.isError && (
          <p role="alert">
            The review could not be saved. Refresh the preview and check your
            access.
          </p>
        )}
        {mutation.isSuccess && (
          <p role="status">The inactive review was recorded.</p>
        )}
      </CardContent>
    </Card>
  );
}
