import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Send, XCircle, CheckCircle2, UserPlus } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useTiramisBusinessReadiness } from '@/modules/tenant/tiramis/hooks';
import { claimsApi } from '../api';
import {
  claimCustomerName,
  claimTone,
  claimUserName,
  formatClaimDate,
  formatClaimMoney,
} from '../utils';

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="mt-1 font-medium text-slate-900">{value || '-'}</div>
    </div>
  );
}

export function ClaimDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [assignee, setAssignee] = useState('');
  const [reason, setReason] = useState('');

  const claimQuery = useQuery({
    queryKey: ['claims', id],
    queryFn: () => claimsApi.get(id!),
    enabled: Boolean(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['claims'] });
    queryClient.invalidateQueries({ queryKey: ['claims', id] });
  };

  const assignMutation = useMutation({
    mutationFn: () => claimsApi.assign(id!, assignee),
    onSuccess: invalidate,
  });
  const closeMutation = useMutation({
    mutationFn: () =>
      claimsApi.close(id!, reason || 'Closed from claims workbench'),
    onSuccess: invalidate,
  });
  const rejectMutation = useMutation({
    mutationFn: () =>
      claimsApi.reject(id!, reason || 'Rejected from claims workbench'),
    onSuccess: invalidate,
  });
  const submitTiramisMutation = useMutation({
    mutationFn: () => claimsApi.submitNotification(id!),
    onSuccess: invalidate,
  });

  const claim = claimQuery.data;
  const tiramisReadinessQuery = useTiramisBusinessReadiness(
    id
      ? {
          requestType: 'CLAIM_NOTIFICATION',
          sourceModule: 'claims',
          sourceRecordId: id,
        }
      : undefined,
    {
      enabled: Boolean(id && claim),
    },
  );
  const tiramisReadiness = tiramisReadinessQuery.data?.validation;
  const tiramisErrors = tiramisReadiness?.errors ?? [];
  const tiramisWarnings = tiramisReadiness?.warnings ?? [];
  const tiramisBlocked = tiramisReadiness?.isValid === false;

  if (claimQuery.isLoading || !claim) {
    return <Skeleton className="h-[640px] w-full" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Claims"
        title={claim.claim_no}
        description={claim.description ?? claim.loss_nature ?? 'Claim workflow'}
        action={
          <Button asChild variant="outline">
            <Link to="/claims">Back</Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Claim Position</CardTitle>
              <Badge variant="outline" className={claimTone(claim.status)}>
                {claim.status}
              </Badge>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <Field
                label="Customer"
                value={claimCustomerName(claim.customer)}
              />
              <Field label="Policy" value={claim.policy?.policy_no ?? '-'} />
              <Field
                label="Assigned"
                value={claimUserName(claim.assigned_user)}
              />
              <Field
                label="Loss date"
                value={formatClaimDate(claim.loss_date)}
              />
              <Field label="Loss type" value={claim.loss_type ?? '-'} />
              <Field label="Location" value={claim.loss_location ?? '-'} />
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-5">
                <div className="text-xs uppercase text-slate-500">
                  Estimated
                </div>
                <div className="mt-2 text-xl font-semibold">
                  {formatClaimMoney(
                    claim.estimated_amount,
                    claim.currency_code ?? 'TZS',
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="text-xs uppercase text-slate-500">Approved</div>
                <div className="mt-2 text-xl font-semibold">
                  {formatClaimMoney(
                    claim.approved_amount,
                    claim.currency_code ?? 'TZS',
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="text-xs uppercase text-slate-500">Paid</div>
                <div className="mt-2 text-xl font-semibold">
                  {formatClaimMoney(
                    claim.paid_amount,
                    claim.currency_code ?? 'TZS',
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="text-xs uppercase text-slate-500">Reserve</div>
                <div className="mt-2 text-xl font-semibold">
                  {formatClaimMoney(
                    claim.outstanding_reserve,
                    claim.currency_code ?? 'TZS',
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow Evidence</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Field label="Stage" value={claim.claim_stage ?? '-'} />
              <Field label="Coverage" value={claim.coverage_status ?? '-'} />
              <Field
                label="Settlement"
                value={claim.settlement_status ?? '-'}
              />
              <Field label="Fraud" value={claim.fraud_status ?? '-'} />
              <Field label="Liability" value={claim.liability_status ?? '-'} />
              <Field label="TIRAMIS" value={claim.tiramis_status ?? '-'} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={assignee}
                onChange={(event) => setAssignee(event.target.value)}
                placeholder="Assigned user ID"
              />
              <Button
                className="w-full justify-start"
                variant="outline"
                disabled={!assignee || assignMutation.isPending}
                onClick={() => assignMutation.mutate()}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Assign
              </Button>
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Reason or decision note"
              />
              <Button
                className="w-full justify-start"
                variant="outline"
                disabled={
                  submitTiramisMutation.isPending ||
                  tiramisReadinessQuery.isLoading ||
                  tiramisBlocked
                }
                onClick={() => submitTiramisMutation.mutate()}
              >
                <Send className="mr-2 h-4 w-4" />
                Submit notification
              </Button>
              {tiramisReadinessQuery.isLoading ? (
                <p className="text-xs text-slate-500">
                  Checking TIRAMIS readiness...
                </p>
              ) : tiramisBlocked ? (
                <Alert variant="destructive">
                  <AlertTitle>TIRAMIS validation failed</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      {tiramisErrors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : tiramisWarnings.length > 0 ? (
                <Alert variant="warning">
                  <AlertTitle>TIRAMIS validation warnings</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      {tiramisWarnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : tiramisReadiness ? (
                <p className="text-xs text-emerald-700">
                  Backend validation passed for this claim notification.
                </p>
              ) : null}
              <Button
                className="w-full justify-start"
                variant="outline"
                disabled={closeMutation.isPending}
                onClick={() => closeMutation.mutate()}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Close
              </Button>
              <Button
                className="w-full justify-start"
                variant="destructive"
                disabled={rejectMutation.isPending}
                onClick={() => rejectMutation.mutate()}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Related Records</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <div>{claim.claimants?.length ?? 0} claimant(s)</div>
              <div>{claim.documents?.length ?? 0} document(s)</div>
              <div>{claim.reserves?.length ?? 0} reserve movement(s)</div>
              <div>{claim.assessments?.length ?? 0} assessment(s)</div>
              <div>{claim.payments?.length ?? 0} payment instruction(s)</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
