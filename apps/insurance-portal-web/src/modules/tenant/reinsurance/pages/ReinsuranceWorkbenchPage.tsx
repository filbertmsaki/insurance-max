import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, RefreshCcw } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { reinsuranceApi } from '../api';
import { tiramisApi } from '@/modules/tenant/tiramis/api';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import type { ReinsuranceRecord } from '../types';
import {
  formatReinsuranceDate,
  formatReinsuranceMoney,
  reinsuranceTone,
} from '../utils';

type View =
  | 'treaties'
  | 'cessions'
  | 'settlements'
  | 'offers'
  | 'recoveries'
  | 'capacity';

function recordLabel(record: ReinsuranceRecord) {
  return (
    record.treaty_no ??
    record.treaty_name ??
    record.offer_no ??
    record.recovery_no ??
    record.cession_no ??
    record.settlement_no ??
    record.id
  );
}

function getDeclarationId(record: ReinsuranceRecord): string | null {
  const declaration = record.declaration;

  if (declaration && typeof declaration === 'object' && 'id' in declaration) {
    return String(declaration.id);
  }

  return typeof record.declaration_id === 'string'
    ? record.declaration_id
    : null;
}

export function ReinsuranceWorkbenchPage() {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const [view, setView] = useState<View>('treaties');
  const [offerShares, setOfferShares] = useState<Record<string, string>>({});
  const [recoveryAmounts, setRecoveryAmounts] = useState<
    Record<string, string>
  >({});
  const [capacityInput, setCapacityInput] = useState({
    treaty_id: '',
    treaty_section_id: '',
    exposure_amount: '',
    class_of_business: '',
    territory: '',
  });

  const treatiesQuery = useQuery({
    queryKey: ['reinsurance', 'treaties'],
    queryFn: reinsuranceApi.treaties,
  });
  const offersQuery = useQuery({
    queryKey: ['reinsurance', 'offers'],
    queryFn: reinsuranceApi.facultativeOffers,
  });
  const cessionsQuery = useQuery({
    queryKey: ['reinsurance', 'cessions'],
    queryFn: reinsuranceApi.cessions,
  });
  const settlementsQuery = useQuery({
    queryKey: ['reinsurance', 'settlements'],
    queryFn: reinsuranceApi.settlements,
  });
  const recoveriesQuery = useQuery({
    queryKey: ['reinsurance', 'recoveries'],
    queryFn: reinsuranceApi.recoveries,
  });

  const recoveryMutation = useMutation({
    mutationFn: ({
      id,
      amount,
      action,
    }: {
      id: string;
      amount: number;
      action: 'admit' | 'receipt';
    }) =>
      action === 'admit'
        ? reinsuranceApi.admitRecovery(id, amount)
        : reinsuranceApi.recordRecoveryReceipt(id, amount),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['reinsurance', 'recoveries'],
      }),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ action, id }: { action: string; id: string }) => {
      const actions: Record<string, (id: string) => Promise<unknown>> = {
        submitTreaty: reinsuranceApi.submitTreaty,
        approveTreaty: reinsuranceApi.approveTreaty,
        activateTreaty: reinsuranceApi.activateTreaty,
        submitCession: reinsuranceApi.submitCession,
        approveCession: reinsuranceApi.approveCession,
        applyCession: reinsuranceApi.applyCession,
        createDeclaration: reinsuranceApi.createDeclaration,
        submitDeclaration: reinsuranceApi.submitDeclarationToTiramis,
        submitSettlement: reinsuranceApi.submitSettlement,
        approveSettlement: reinsuranceApi.approveSettlement,
        paySettlement: reinsuranceApi.paySettlement,
      };

      if (action === 'submitDeclaration') {
        const readiness = await tiramisApi.validateBusiness({
          requestType: 'REINSURANCE',
          sourceModule: 'reinsurance',
          sourceRecordId: id,
        });

        if (readiness.validation?.isValid === false) {
          throw new Error(readiness.validation.errors.join('; '));
        }
      }

      return actions[action](id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reinsurance'] });
    },
  });

  const offerMutation = useMutation({
    mutationFn: ({
      id,
      action,
      share,
    }: {
      id: string;
      action: 'respond' | 'accept';
      share: number;
    }) =>
      action === 'respond'
        ? reinsuranceApi.respondToOffer(id, share)
        : reinsuranceApi.acceptOffer(id, share),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['reinsurance'] }),
  });

  const treatyInvitationMutation = useMutation({
    mutationFn: ({
      treatyId,
      participantId,
      decision,
    }: {
      treatyId: string;
      participantId: string;
      decision: 'ACCEPT' | 'DECLINE';
    }) =>
      reinsuranceApi.respondToTreatyInvitation(
        treatyId,
        participantId,
        decision,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['reinsurance', 'treaties'] }),
  });

  const capacityMutation = useMutation({
    mutationFn: () =>
      reinsuranceApi.evaluateCapacity({
        treaty_id: capacityInput.treaty_id,
        treaty_section_id: capacityInput.treaty_section_id || null,
        exposure_amount: Number(capacityInput.exposure_amount),
        class_of_business: capacityInput.class_of_business || null,
        territory: capacityInput.territory || null,
      }),
  });

  const rows = useMemo(() => {
    if (view === 'cessions') return cessionsQuery.data ?? [];
    if (view === 'settlements') return settlementsQuery.data ?? [];
    if (view === 'offers') return offersQuery.data ?? [];
    if (view === 'recoveries') return recoveriesQuery.data ?? [];
    return treatiesQuery.data ?? [];
  }, [
    cessionsQuery.data,
    offersQuery.data,
    recoveriesQuery.data,
    settlementsQuery.data,
    treatiesQuery.data,
    view,
  ]);

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: ['reinsurance'] });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reinsurance"
        title="Reinsurance Workbench"
        description="Operate treaty capacity, policy cessions, declarations, facultative follow-up, and settlement workflow."
        action={
          <Button variant="outline" onClick={reload}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="w-[260px]">
        <Select value={view} onValueChange={(value) => setView(value as View)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="treaties">Treaties</SelectItem>
            <SelectItem value="cessions">Cessions</SelectItem>
            <SelectItem value="settlements">Settlements</SelectItem>
            <SelectItem value="offers">Facultative offers</SelectItem>
            <SelectItem value="recoveries">Claim recoveries</SelectItem>
            <SelectItem value="capacity">Capacity evaluator</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {view === 'capacity' ? (
        <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Capacity Input</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                ['treaty_id', 'Treaty ID'],
                ['treaty_section_id', 'Section ID'],
                ['exposure_amount', 'Exposure amount'],
                ['class_of_business', 'Class of business'],
                ['territory', 'Territory'],
              ].map(([key, label]) => (
                <Input
                  key={key}
                  value={capacityInput[key as keyof typeof capacityInput]}
                  onChange={(event) =>
                    setCapacityInput((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  placeholder={label}
                />
              ))}
              <Button
                className="w-full justify-start"
                disabled={
                  !capacityInput.treaty_id || !capacityInput.exposure_amount
                }
                onClick={() => capacityMutation.mutate()}
              >
                <Activity className="mr-2 h-4 w-4" />
                Evaluate
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Result</CardTitle>
            </CardHeader>
            <CardContent>
              {capacityMutation.data ? (
                <pre className="overflow-auto rounded bg-slate-950 p-4 text-sm text-slate-50">
                  {JSON.stringify(capacityMutation.data, null, 2)}
                </pre>
              ) : (
                <div className="text-sm text-slate-500">
                  Run an evaluation to see treaty capacity and blocking reasons.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base capitalize">{view}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    {view === 'offers'
                      ? 'Risk / deadline'
                      : view === 'recoveries'
                        ? 'Claim / cession'
                        : 'Effective'}
                  </TableHead>
                  <TableHead>
                    {view === 'offers'
                      ? 'Offered / quoted share'
                      : view === 'recoveries'
                        ? 'Expected / admitted / received'
                        : 'Amount'}
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="font-medium text-slate-900">
                        {recordLabel(record)}
                      </div>
                      <div className="text-sm text-slate-500">{record.id}</div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={reinsuranceTone(record.status)}
                      >
                        {record.status ?? 'UNKNOWN'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {view === 'offers'
                        ? `${record.placement?.risk_description ?? record.placement?.placement_no ?? ''} · ${formatReinsuranceDate(record.placement?.submission_deadline)}`
                        : view === 'recoveries'
                          ? `${record.claim_id ?? 'Claim'} · ${record.cession_id ?? 'Cession'}`
                          : `${formatReinsuranceDate(record.effective_from)} - ${formatReinsuranceDate(record.effective_to)}`}
                    </TableCell>
                    <TableCell>
                      {view === 'offers' ? (
                        <div className="space-y-1">
                          <div>
                            {record.offered_share_percent ?? 0}% offered ·{' '}
                            {record.quoted_share_percent ?? 0}% quoted
                          </div>
                          <div className="text-xs text-slate-500">
                            {formatReinsuranceMoney(
                              record.placement?.amount_to_place,
                              record.placement?.currency ?? 'TZS',
                            )}
                          </div>
                        </div>
                      ) : view === 'recoveries' ? (
                        <div className="space-y-1 text-xs">
                          <div>
                            Expected:{' '}
                            {formatReinsuranceMoney(
                              record.expected_recovery,
                              record.currency ?? record.currency_code ?? 'TZS',
                            )}
                          </div>
                          <div>
                            Admitted:{' '}
                            {formatReinsuranceMoney(
                              record.admitted_recovery,
                              record.currency ?? record.currency_code ?? 'TZS',
                            )}
                          </div>
                          <div>
                            Received:{' '}
                            {formatReinsuranceMoney(
                              record.received_recovery,
                              record.currency ?? record.currency_code ?? 'TZS',
                            )}
                          </div>
                        </div>
                      ) : (
                        formatReinsuranceMoney(
                          record.ceded_premium ??
                            record.settlement_amount ??
                            record.ceded_sum_insured,
                          record.currency_code ?? 'TZS',
                        )
                      )}
                    </TableCell>
                    <TableCell className="space-x-1">
                      {view === 'treaties' && (
                        <>
                          {(record.participants ?? [])
                            .filter(
                              (participant) => participant.status === 'INVITED',
                            )
                            .map((participant) => (
                              <div
                                key={participant.id}
                                className="inline-flex items-center gap-1"
                              >
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={treatyInvitationMutation.isPending}
                                  onClick={() =>
                                    treatyInvitationMutation.mutate({
                                      treatyId: record.id,
                                      participantId: participant.id,
                                      decision: 'ACCEPT',
                                    })
                                  }
                                >
                                  Accept invite
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={treatyInvitationMutation.isPending}
                                  onClick={() =>
                                    treatyInvitationMutation.mutate({
                                      treatyId: record.id,
                                      participantId: participant.id,
                                      decision: 'DECLINE',
                                    })
                                  }
                                >
                                  Decline
                                </Button>
                              </div>
                            ))}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              actionMutation.mutate({
                                action: 'submitTreaty',
                                id: record.id,
                              })
                            }
                          >
                            Submit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              actionMutation.mutate({
                                action: 'approveTreaty',
                                id: record.id,
                              })
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              actionMutation.mutate({
                                action: 'activateTreaty',
                                id: record.id,
                              })
                            }
                          >
                            Activate
                          </Button>
                        </>
                      )}
                      {view === 'cessions' && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              actionMutation.mutate({
                                action: 'submitCession',
                                id: record.id,
                              })
                            }
                          >
                            Submit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              actionMutation.mutate({
                                action: 'approveCession',
                                id: record.id,
                              })
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              actionMutation.mutate({
                                action: 'applyCession',
                                id: record.id,
                              })
                            }
                          >
                            Apply
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              actionMutation.mutate({
                                action: 'createDeclaration',
                                id: record.id,
                              })
                            }
                          >
                            Declare
                          </Button>
                          {getDeclarationId(record) ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={actionMutation.isPending}
                              onClick={() =>
                                actionMutation.mutate({
                                  action: 'submitDeclaration',
                                  id: getDeclarationId(record)!,
                                })
                              }
                            >
                              TIRAMIS
                            </Button>
                          ) : null}
                        </>
                      )}
                      {view === 'settlements' && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              actionMutation.mutate({
                                action: 'submitSettlement',
                                id: record.id,
                              })
                            }
                          >
                            Submit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              actionMutation.mutate({
                                action: 'approveSettlement',
                                id: record.id,
                              })
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              actionMutation.mutate({
                                action: 'paySettlement',
                                id: record.id,
                              })
                            }
                          >
                            Pay
                          </Button>
                        </>
                      )}
                      {view === 'recoveries' && (
                        <div className="flex min-w-[300px] flex-wrap items-center gap-2">
                          <Input
                            aria-label={`Recovery amount for ${record.recovery_no ?? record.id}`}
                            className="w-28"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={recoveryAmounts[record.id] ?? ''}
                            onChange={(event) =>
                              setRecoveryAmounts((current) => ({
                                ...current,
                                [record.id]: event.target.value,
                              }))
                            }
                            placeholder="Amount"
                          />
                          {hasPermission('reinsurance:recovery-approve') &&
                          Number(record.admitted_recovery ?? 0) === 0 ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                recoveryMutation.isPending ||
                                !recoveryAmounts[record.id]
                              }
                              onClick={() =>
                                recoveryMutation.mutate({
                                  id: record.id,
                                  amount: Number(recoveryAmounts[record.id]),
                                  action: 'admit',
                                })
                              }
                            >
                              Admit share
                            </Button>
                          ) : null}
                          {hasPermission('reinsurance:recovery-create') &&
                          Number(record.admitted_recovery ?? 0) >
                            Number(record.received_recovery ?? 0) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                recoveryMutation.isPending ||
                                !recoveryAmounts[record.id]
                              }
                              onClick={() =>
                                recoveryMutation.mutate({
                                  id: record.id,
                                  amount: Number(recoveryAmounts[record.id]),
                                  action: 'receipt',
                                })
                              }
                            >
                              Record receipt
                            </Button>
                          ) : null}
                        </div>
                      )}
                      {view === 'offers' &&
                      ['INVITED', 'QUOTED'].includes(String(record.status)) ? (
                        <div className="flex items-center gap-2">
                          <Input
                            aria-label={`Share percent for ${record.offer_no ?? 'offer'}`}
                            className="w-24"
                            type="number"
                            min="0"
                            max="100"
                            value={
                              offerShares[record.id] ??
                              String(
                                record.status === 'INVITED'
                                  ? (record.offered_share_percent ?? 0)
                                  : (record.quoted_share_percent ?? 0),
                              )
                            }
                            onChange={(event) =>
                              setOfferShares((current) => ({
                                ...current,
                                [record.id]: event.target.value,
                              }))
                            }
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={offerMutation.isPending}
                            onClick={() =>
                              offerMutation.mutate({
                                id: record.id,
                                action:
                                  record.status === 'INVITED'
                                    ? 'respond'
                                    : 'accept',
                                share: Number(
                                  offerShares[record.id] ??
                                    (record.status === 'INVITED'
                                      ? record.offered_share_percent
                                      : record.quoted_share_percent) ??
                                    0,
                                ),
                              })
                            }
                          >
                            {record.status === 'INVITED' ? 'Respond' : 'Accept'}
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
