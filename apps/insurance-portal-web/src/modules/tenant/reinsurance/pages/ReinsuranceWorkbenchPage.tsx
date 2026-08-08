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
import type { ReinsuranceRecord } from '../types';
import {
  formatReinsuranceDate,
  formatReinsuranceMoney,
  reinsuranceTone,
} from '../utils';

type View = 'treaties' | 'cessions' | 'settlements' | 'capacity';

function recordLabel(record: ReinsuranceRecord) {
  return (
    record.treaty_no ??
    record.treaty_name ??
    record.cession_no ??
    record.settlement_no ??
    record.id
  );
}

export function ReinsuranceWorkbenchPage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>('treaties');
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
  const cessionsQuery = useQuery({
    queryKey: ['reinsurance', 'cessions'],
    queryFn: reinsuranceApi.cessions,
  });
  const settlementsQuery = useQuery({
    queryKey: ['reinsurance', 'settlements'],
    queryFn: reinsuranceApi.settlements,
  });

  const actionMutation = useMutation({
    mutationFn: ({ action, id }: { action: string; id: string }) => {
      const actions: Record<string, (id: string) => Promise<unknown>> = {
        submitTreaty: reinsuranceApi.submitTreaty,
        approveTreaty: reinsuranceApi.approveTreaty,
        activateTreaty: reinsuranceApi.activateTreaty,
        submitCession: reinsuranceApi.submitCession,
        approveCession: reinsuranceApi.approveCession,
        applyCession: reinsuranceApi.applyCession,
        createDeclaration: reinsuranceApi.createDeclaration,
        submitSettlement: reinsuranceApi.submitSettlement,
        approveSettlement: reinsuranceApi.approveSettlement,
        paySettlement: reinsuranceApi.paySettlement,
      };
      return actions[action](id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reinsurance'] });
    },
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
    return treatiesQuery.data ?? [];
  }, [cessionsQuery.data, settlementsQuery.data, treatiesQuery.data, view]);

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
                  <TableHead>Effective</TableHead>
                  <TableHead>Amount</TableHead>
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
                      {formatReinsuranceDate(record.effective_from)} -{' '}
                      {formatReinsuranceDate(record.effective_to)}
                    </TableCell>
                    <TableCell>
                      {formatReinsuranceMoney(
                        record.ceded_premium ??
                          record.settlement_amount ??
                          record.ceded_sum_insured,
                        record.currency_code ?? 'TZS',
                      )}
                    </TableCell>
                    <TableCell className="space-x-1">
                      {view === 'treaties' && (
                        <>
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
