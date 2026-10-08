import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { insurancePartnersApi } from './insurance-partners-api';
import { PartnerAmendmentsPanel } from '@/modules/shared/partners/PartnerAmendmentsPanel';

const OPERATIONS = [
  'QUOTE',
  'SUBMIT',
  'VIEW_QUOTATION',
  'VIEW_POLICY',
  'REQUEST_ENDORSEMENT',
  'REQUEST_RENEWAL',
  'REQUEST_CANCELLATION',
  'NOTIFY_CLAIM',
  'VIEW_CLAIM',
  'VIEW_PAYMENT',
  'VIEW_COMMISSION',
];

type ScopeDraft = {
  enabled: boolean;
  operations: string[];
  branches: string[] | null;
  commission: string;
};
type ScopeDrafts = Record<string, ScopeDraft>;

export function InsurancePartnersPage() {
  const client = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftOverrides, setDraftOverrides] = useState<
    Record<string, ScopeDrafts>
  >({});
  const relationshipsQuery = useQuery({
    queryKey: ['insurance-partners'],
    queryFn: insurancePartnersApi.list,
  });
  const productsQuery = useQuery({
    queryKey: ['insurance-partners', 'products'],
    queryFn: insurancePartnersApi.products,
  });
  const branchesQuery = useQuery({
    queryKey: ['insurance-partners', 'branches'],
    queryFn: insurancePartnersApi.branches,
  });
  const selected =
    relationshipsQuery.data?.find((item) => item.id === selectedId) ?? null;
  const scopesQuery = useQuery({
    queryKey: ['insurance-partners', selectedId, 'scopes'],
    queryFn: () => insurancePartnersApi.scopes(selectedId!),
    enabled: Boolean(selectedId),
  });
  const eventsQuery = useQuery({
    queryKey: ['insurance-partners', selectedId, 'events'],
    queryFn: () => insurancePartnersApi.events(selectedId!),
    enabled: Boolean(selectedId),
  });
  const scopesByProduct = useMemo(
    () => new Map((scopesQuery.data ?? []).map((s) => [s.product_id, s])),
    [scopesQuery.data],
  );

  const drafts = useMemo(() => {
    const initial: ScopeDrafts = {};
    for (const scope of scopesQuery.data ?? []) {
      initial[scope.product_id] = {
        enabled: scope.is_active,
        operations: scope.allowed_operations,
        branches: scope.branch_ids,
        commission: scope.commission_rate ?? '',
      };
    }
    return { ...initial, ...(selectedId ? draftOverrides[selectedId] : {}) };
  }, [draftOverrides, scopesQuery.data, selectedId]);

  const transitionMutation = useMutation({
    mutationFn: ({
      id,
      action,
      reason,
    }: {
      id: string;
      action: 'approve' | 'reject' | 'suspend' | 'reactivate' | 'terminate';
      reason?: string;
    }) => insurancePartnersApi.transition(id, action, reason),
    onSuccess: async () => {
      toast.success('Relationship updated');
      await client.invalidateQueries({ queryKey: ['insurance-partners'] });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not update relationship',
      ),
  });
  const scopesMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error('Select a relationship first');
      return insurancePartnersApi.replaceScopes(
        selectedId,
        Object.entries(drafts)
          .filter(([, draft]) => draft.enabled && draft.operations.length > 0)
          .map(([product_id, draft]) => ({
            product_id,
            allowed_operations: draft.operations,
            branch_ids: draft.branches,
            commission_rate:
              draft.commission === '' ? null : Number(draft.commission),
          })),
      );
    },
    onSuccess: async () => {
      toast.success('Product and branch grants saved');
      await client.invalidateQueries({
        queryKey: ['insurance-partners', selectedId],
      });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not save product grants',
      ),
  });

  const updateDraft = (productId: string, update: Partial<ScopeDraft>) => {
    if (!selectedId) return;
    setDraftOverrides((current) => ({
      ...current,
      [selectedId]: {
        ...(current[selectedId] ?? {}),
        [productId]: {
          ...(current[selectedId]?.[productId] ??
            drafts[productId] ?? {
              enabled: false,
              operations: [],
              branches: null,
              commission: '',
            }),
          ...update,
        },
      },
    }));
  };

  const requestReason = (action: 'reject' | 'suspend' | 'terminate') => {
    const reason = window.prompt(`Reason to ${action} this relationship`);
    if (reason && reason.trim().length >= 3) return reason.trim();
    if (reason !== null)
      toast.error('Enter a reason with at least 3 characters');
    return null;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insurance distribution"
        title="Partner relationships"
        description="Review appointments and configure each partner’s product, branch, commission, and transaction access."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appointments</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {relationshipsQuery.isLoading ? (
            <p className="text-sm text-slate-500">Loading relationships…</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="p-2">Partner</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Agreement end</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(relationshipsQuery.data ?? []).map((relationship) => (
                  <tr
                    key={relationship.id}
                    className={`border-b ${selectedId === relationship.id ? 'bg-slate-50' : ''}`}
                  >
                    <td className="p-2">
                      <Button
                        variant="link"
                        className="p-0"
                        onClick={() => setSelectedId(relationship.id)}
                      >
                        {relationship.intermediary_company?.name ??
                          relationship.intermediary_company_id}
                      </Button>
                    </td>
                    <td className="p-2">
                      {relationship.partner_type.replaceAll('_', ' ')}
                    </td>
                    <td className="p-2">
                      <Badge variant="outline">{relationship.status}</Badge>
                    </td>
                    <td className="p-2">
                      {relationship.end_date
                        ? new Date(relationship.end_date).toLocaleDateString()
                        : 'No end date'}
                    </td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-1">
                        {relationship.status === 'PENDING' ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() =>
                                transitionMutation.mutate({
                                  id: relationship.id,
                                  action: 'approve',
                                })
                              }
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const reason = requestReason('reject');
                                if (reason)
                                  transitionMutation.mutate({
                                    id: relationship.id,
                                    action: 'reject',
                                    reason,
                                  });
                              }}
                            >
                              Reject
                            </Button>
                          </>
                        ) : null}
                        {relationship.status === 'ACTIVE' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const reason = requestReason('suspend');
                              if (reason)
                                transitionMutation.mutate({
                                  id: relationship.id,
                                  action: 'suspend',
                                  reason,
                                });
                            }}
                          >
                            Suspend
                          </Button>
                        ) : null}
                        {relationship.status === 'SUSPENDED' ? (
                          <Button
                            size="sm"
                            onClick={() =>
                              transitionMutation.mutate({
                                id: relationship.id,
                                action: 'reactivate',
                              })
                            }
                          >
                            Reactivate
                          </Button>
                        ) : null}
                        {['ACTIVE', 'SUSPENDED'].includes(
                          relationship.status,
                        ) ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const reason = requestReason('terminate');
                              if (reason)
                                transitionMutation.mutate({
                                  id: relationship.id,
                                  action: 'terminate',
                                  reason,
                                });
                            }}
                          >
                            Terminate
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {relationshipsQuery.isError ? (
            <p className="mt-3 text-sm text-red-600">
              Could not load partner appointments.
            </p>
          ) : null}
          {!relationshipsQuery.isLoading && !relationshipsQuery.data?.length ? (
            <p className="py-5 text-sm text-slate-500">
              No partner appointments have been requested yet.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {selected ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">
              Product and branch grants ·{' '}
              {selected.intermediary_company?.name ??
                selected.intermediary_company_id}
            </CardTitle>
            <Button
              disabled={
                scopesMutation.isPending || selected.status !== 'ACTIVE'
              }
              onClick={() => scopesMutation.mutate()}
            >
              Save grants
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            <PartnerAmendmentsPanel
              relationshipId={selected.id}
              apiRoot="/insurance-partners"
            />
            {selected.status !== 'ACTIVE' ? (
              <p className="text-sm text-amber-700">
                Activate this relationship before configuring operational
                grants.
              </p>
            ) : null}
            {(productsQuery.data ?? []).map((product) => {
              const scope = drafts[product.id] ?? {
                enabled: false,
                operations: [],
                branches: null,
                commission: '',
              };
              const existing = scopesByProduct.get(product.id);
              return (
                <section key={product.id} className="rounded-lg border p-4">
                  <label className="flex items-center gap-2 font-medium">
                    <input
                      type="checkbox"
                      checked={scope.enabled}
                      disabled={selected.status !== 'ACTIVE'}
                      onChange={(e) =>
                        updateDraft(product.id, { enabled: e.target.checked })
                      }
                    />
                    {product.product_name}{' '}
                    <span className="text-xs text-slate-500">
                      {product.product_code}
                      {product.category?.name
                        ? ` · ${product.category.name}`
                        : ''}
                    </span>
                  </label>
                  {scope.enabled ? (
                    <div className="mt-3 space-y-3">
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {OPERATIONS.map((operation) => (
                          <label
                            key={operation}
                            className="flex items-center gap-2 text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={scope.operations.includes(operation)}
                              onChange={(e) =>
                                updateDraft(product.id, {
                                  operations: e.target.checked
                                    ? [...scope.operations, operation]
                                    : scope.operations.filter(
                                        (item) => item !== operation,
                                      ),
                                })
                              }
                            />
                            {operation.replaceAll('_', ' ').toLowerCase()}
                          </label>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium">
                          Commission rate
                        </span>
                        <Input
                          className="w-28"
                          type="number"
                          min="0"
                          max="1"
                          step="0.001"
                          value={scope.commission}
                          onChange={(e) =>
                            updateDraft(product.id, {
                              commission: e.target.value,
                            })
                          }
                          placeholder="0–1"
                        />
                        <span className="text-xs text-slate-500">
                          Enter a decimal rate, for example 0.15 for 15%.
                        </span>
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-medium">Branches</p>
                        <label className="mr-4 inline-flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={scope.branches === null}
                            onChange={(e) =>
                              updateDraft(product.id, {
                                branches: e.target.checked ? null : [],
                              })
                            }
                          />
                          All insurer branches
                        </label>
                        {scope.branches !== null ? (
                          <div className="mt-2 flex flex-wrap gap-3">
                            {(branchesQuery.data ?? []).map((branch) => (
                              <label
                                key={branch.id}
                                className="inline-flex items-center gap-2 text-xs"
                              >
                                <input
                                  type="checkbox"
                                  checked={
                                    scope.branches?.includes(branch.id) ?? false
                                  }
                                  onChange={(e) =>
                                    updateDraft(product.id, {
                                      branches: e.target.checked
                                        ? [...(scope.branches ?? []), branch.id]
                                        : (scope.branches ?? []).filter(
                                            (id) => id !== branch.id,
                                          ),
                                    })
                                  }
                                />
                                {branch.name}
                              </label>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : existing ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Existing grant will be removed when saved.
                    </p>
                  ) : null}
                </section>
              );
            })}
            {productsQuery.isLoading ? (
              <p className="text-sm text-slate-500">
                Loading insurer products…
              </p>
            ) : null}
            <div>
              <h3 className="mb-2 text-sm font-semibold">
                Recent relationship events
              </h3>
              <ul className="space-y-1 text-xs text-slate-600">
                {(eventsQuery.data ?? [])
                  .slice(-8)
                  .reverse()
                  .map((event) => (
                    <li key={event.id}>
                      {new Date(event.created_at).toLocaleString()} ·{' '}
                      {event.event_type}{' '}
                      {event.previous_status
                        ? `(${event.previous_status} → ${event.new_status})`
                        : ''}
                      {event.notes ? ` · ${event.notes}` : ''}
                    </li>
                  ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
