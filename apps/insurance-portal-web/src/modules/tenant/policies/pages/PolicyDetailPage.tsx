import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Pencil, Play, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PolicyStatusBadge } from '../components/PolicyStatusBadge';
import {
  useDeletePolicy,
  useCancellationEligibility,
  useEndorsementEligibility,
  usePolicyCurrentVersion,
  usePolicyDetail,
  usePolicyEndorsements,
  useCreateRenewal,
  usePolicyVersions,
  useRetryPolicyEndorsementTiramis,
  useRenewalEligibility,
  useSubmitPolicyEndorsementToTiramis,
} from '../hooks';
import { useSubmitPolicyToTiramis } from '@/modules/tenant/tiramis/hooks';
import { TiramisSubmissionDialog } from '@/modules/tenant/tiramis/components/TiramisSubmissionDialog';
import { buildPolicyTiramisPayload } from '@/modules/tenant/tiramis/utils';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import {
  useCreateNonMotorPolicyDetail,
  useNonMotorPolicyDetails,
  useNonMotorPolicyRisks,
  useSubjectMatterOptions,
} from '@/modules/tenant/non-motor/hooks';
import { PolicyNonMotorDetailForm } from '@/modules/tenant/non-motor/components/PolicyNonMotorDetailForm';
import type { NonMotorPolicyDetailRecord } from '@/modules/tenant/non-motor/types';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';
import type { PolicyEndorsementRecord } from '../types';

function Row({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="min-w-36 text-sm text-slate-500">{label}</span>
      <span className="text-sm text-slate-900">{value ?? ' - '}</span>
    </div>
  );
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function arrayCount(value: unknown): string {
  return Array.isArray(value) ? String(value.length) : '0';
}

const RETRYABLE_SUBMISSION_STATUSES = new Set([
  'FAILED',
  'RETRYABLE',
]);

function canIssueEndorsement(endorsement: PolicyEndorsementRecord) {
  return (
    endorsement.stage === 'COMPLETED' &&
    endorsement.submission_status === 'READY'
  );
}

export function PolicyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();
  const canCreate = hasPermission('non-motor:create');
  const canCreateEndorsement = hasPermission('endorsements:create');
  const canCreateCancellation = hasPermission('cancellations:create');
  const canCreateRenewal = hasPermission('renewals:create');
  const canViewEndorsements = hasPermission('endorsements:create');
  const canSubmitEndorsement = hasPermission('endorsements:submit-tiramis');
  const canRetryEndorsement = hasPermission('endorsements:retry-tiramis');
  const { data: policy, isLoading } = usePolicyDetail(id);
  const deleteMutation = useDeletePolicy();
  const submitMutation = useSubmitPolicyToTiramis(policy);
  const { data: endorsements = [], isLoading: endorsementsLoading } =
    usePolicyEndorsements(policy?.id, canViewEndorsements);
  const { data: eligibility } = useEndorsementEligibility(
    policy?.id,
    undefined,
    canCreateEndorsement,
  );
  const { data: cancellationEligibility } = useCancellationEligibility(
    policy?.id,
    undefined,
    canCreateCancellation,
  );
  const { data: renewalEligibility } = useRenewalEligibility(
    policy?.id,
    canCreateRenewal,
  );
  const createRenewalMutation = useCreateRenewal(policy?.id);
  const submitEndorsementMutation = useSubmitPolicyEndorsementToTiramis(
    policy?.id,
  );
  const retryEndorsementMutation = useRetryPolicyEndorsementTiramis(policy?.id);
  const { data: nonMotorDetails = [] } = useNonMotorPolicyDetails(policy?.id);
  const { data: policyRisks = [] } = useNonMotorPolicyRisks(policy?.id);
  const { data: subjectMatterOptions = [] } = useSubjectMatterOptions();
  const createNonMotorMutation = useCreateNonMotorPolicyDetail();
  const { data: currentVersion, isLoading: currentVersionLoading } =
    usePolicyCurrentVersion(policy?.id);
  const { data: versions = [] } = usePolicyVersions(policy?.id);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [nonMotorOpen, setNonMotorOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const tiramisSubmissionPayload = useMemo(
    () => (policy ? buildPolicyTiramisPayload(policy) : null),
    [policy],
  );
  const contractEntries = Array.isArray(
    currentVersion?.policy_snapshot?.['entries'],
  )
    ? (currentVersion?.policy_snapshot?.['entries'] as Record<
        string,
        unknown
      >[])
    : [];
  const canStartCancellation =
    canCreateCancellation &&
    cancellationEligibility?.eligible &&
    !['CANCELLED', 'EXPIRED', 'LAPSED'].includes(policy?.policy_status ?? '') &&
    !policy?.pending_transaction_id;
  const canStartRenewal =
    canCreateRenewal && renewalEligibility?.eligible && !policy?.pending_transaction_id;

  const nonMotorColumns: Column<NonMotorPolicyDetailRecord>[] = useMemo(
    () => [
      {
        key: 'subject_matter',
        header: 'Subject Matter',
        cell: (row) =>
          row.subject_matter?.subject_code ?? row.subject_matter_id,
      },
      {
        key: 'risk',
        header: 'Policy Risk',
        cell: (row) => row.policy_risk?.risk?.risk_name ?? row.policy_risk_id,
      },
      {
        key: 'insured_value',
        header: 'Insured Value',
        cell: (row) => row.insured_value ?? ' - ',
      },
      {
        key: 'limit',
        header: 'Limit',
        cell: (row) => row.limit_of_liability ?? ' - ',
      },
      {
        key: 'created_at',
        header: 'Created',
        cell: (row) => new Date(row.created_at).toLocaleString(),
      },
    ],
    [],
  );

  const endorsementColumns: Column<PolicyEndorsementRecord>[] = useMemo(
    () => [
      {
        key: 'transaction_no',
        header: 'Endorsement No.',
        cell: (row) => row.transaction_no,
      },
      {
        key: 'effective_date',
        header: 'Effective Date',
        cell: (row) => row.effective_date,
      },
      {
        key: 'stage',
        header: 'Stage',
        cell: (row) => <StatusBadge status={row.stage} />,
      },
      {
        key: 'submission_status',
        header: 'TIRAMIS',
        cell: (row) => <StatusBadge status={row.submission_status} />,
      },
      {
        key: 'premium',
        header: 'Premium Change',
        cell: (row) =>
          `${row.currency_code} ${row.net_premium_difference ?? '0'}`,
      },
      {
        key: 'tiramis_request_id',
        header: 'Request ID',
        cell: (row) => row.tiramis_request_id ?? ' - ',
      },
      {
        key: 'actions',
        header: 'Actions',
        cell: (row) => {
          const ready = canIssueEndorsement(row);
          const retryable = RETRYABLE_SUBMISSION_STATUSES.has(
            row.submission_status,
          );
          const canRetry =
            row.stage === 'COMPLETED' && retryable && canRetryEndorsement;
          const canSubmit = ready && !retryable && canSubmitEndorsement;

          if (!canRetry && !canSubmit) {
            return (
              <span className="text-xs text-slate-500">
                {row.submission_status === 'PROCESSING'
                  ? 'Processing'
                  : row.submission_status === 'ACCEPTED'
                    ? 'Accepted'
                    : 'Not available'}
              </span>
            );
          }

          return (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                submitEndorsementMutation.isPending ||
                retryEndorsementMutation.isPending
              }
              onClick={() => {
                if (canRetry) {
                  retryEndorsementMutation.mutate(row.id);
                  return;
                }
                submitEndorsementMutation.mutate(row.id);
              }}
            >
              <Play className="mr-1.5 h-3.5 w-3.5" />
              {canRetry ? 'Retry Issuance' : 'Issue Endorsement'}
            </Button>
          );
        },
      },
    ],
    [
      canRetryEndorsement,
      canSubmitEndorsement,
      retryEndorsementMutation,
      submitEndorsementMutation,
    ],
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="text-center py-24 text-slate-500">
        <p className="font-medium">Policy not found</p>
        <Button
          variant="link"
          onClick={() => navigate(underwritingPaths.policies)}
        >
          Back to Policies
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(underwritingPaths.policies)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">
                {policy.policy_no}
              </h1>
              <PolicyStatusBadge status={policy.policy_status} />
            </div>
            <p className="text-sm text-slate-500">
              {policy.customer?.company_name ?? policy.customer_id}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canCreateEndorsement && eligibility?.eligible && (
            <Button
              onClick={() =>
                navigate(underwritingPaths.policyEndorsementCreate(policy.id))
              }
            >
              Create Endorsement
            </Button>
          )}
          {canStartCancellation && (
            <Button
              variant="destructive"
              onClick={() =>
                navigate(underwritingPaths.policyCancellationCreate(policy.id))
              }
            >
              <Ban className="mr-1.5 h-3.5 w-3.5" />
              Cancel Policy
            </Button>
          )}
          {canStartRenewal && (
            <Button
              variant="outline"
              disabled={createRenewalMutation.isPending}
              onClick={() =>
                createRenewalMutation.mutate(undefined, {
                  onSuccess: (renewal: { id: string }) =>
                    navigate(
                      underwritingPaths.policyRenewalDetail(
                        policy.id,
                        renewal.id,
                      ),
                    ),
                })
              }
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Renew Policy
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSubmitOpen(true)}
            disabled={submitMutation.isPending}
          >
            <Play className="mr-1.5 h-3.5 w-3.5" />
            Submit to TIRAMIS
          </Button>
          {!policy.issued_by_system && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(underwritingPaths.policyEdit(policy.id))}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contract">Contract Version</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="risks">Risks</TabsTrigger>
          <TabsTrigger value="breakdown">Premium Breakdown</TabsTrigger>
          <TabsTrigger value="motor">Motor Details</TabsTrigger>
          <TabsTrigger value="nonmotor">Non-Motor Details</TabsTrigger>
          <TabsTrigger value="endorsements">Endorsements</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="tiramis">TIRAMIS</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Policy Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Row
                label="Customer"
                value={policy.customer?.company_name ?? policy.customer_id}
              />
              <Row label="Quotation" value={policy.quotation_id} />
              <Row
                label="Category"
                value={policy.category?.name ?? policy.category_id}
              />
              <Row
                label="Product"
                value={policy.product?.product_name ?? policy.product_id}
              />
              <Row label="Channel" value={policy.channel_type} />
              <Row
                label="Dates"
                value={`${policy.start_date} to ${policy.end_date}`}
              />
              <Row
                label="Sum Insured"
                value={`${policy.currency} ${policy.sum_insured}`}
              />
              <Row
                label="Premium"
                value={`${policy.currency} ${policy.total_premium}`}
              />
              <Row
                label="Issuance Source"
                value={
                  policy.issued_by_system
                    ? 'TIRAMIS final success'
                    : 'Legacy/manual record'
                }
              />
              <Row label="Source Quotation" value={policy.quotation_id} />
              <Row label="Cover Note" value={policy.cover_note_no} />
              <Row
                label="Regulatory Sync"
                value={policy.regulatory_sync_status}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contract" className="space-y-4">
          {currentVersionLoading ? (
            <Skeleton className="h-52 w-full" />
          ) : !currentVersion ? (
            <Card>
              <CardContent className="pt-6 text-sm text-slate-500">
                Current policy version is not available.
              </CardContent>
            </Card>
          ) : (
            <>
              {(() => {
                const snapshot = currentVersion.policy_snapshot;
                const source = asObject(snapshot?.source);
                const product = asObject(snapshot?.product);
                const regulatory = asObject(snapshot?.regulatory);
                const totals = asObject(snapshot?.totals);

                return (
                  <>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                          Current Contract Version
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Row
                          label="Version"
                          value={currentVersion.version_number}
                        />
                        <Row
                          label="Version Type"
                          value={currentVersion.version_type}
                        />
                        <Row label="Status" value={currentVersion.status} />
                        <Row
                          label="Current"
                          value={currentVersion.is_current ? 'Yes' : 'No'}
                        />
                        <Row
                          label="Effective Period"
                          value={`${currentVersion.effective_from} to ${currentVersion.effective_to}`}
                        />
                        <Row
                          label="Snapshot Schema"
                          value={String(snapshot?.schemaVersion ?? 1)}
                        />
                        <Row
                          label="Snapshot Hash"
                          value={currentVersion.policy_snapshot_hash}
                        />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                          Issuance Source
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Row
                          label="Quotation"
                          value={String(
                            source?.quotationNo ?? policy.quotation_id ?? '-',
                          )}
                        />
                        <Row
                          label="Quotation Revision"
                          value={String(
                            source?.workflowRevision ??
                              policy.source_quotation_revision ??
                              '-',
                          )}
                        />
                        <Row
                          label="Product Version"
                          value={String(
                            product?.productVersionId ??
                              policy.product_version_id ??
                              '-',
                          )}
                        />
                        <Row
                          label="Policy Holders"
                          value={arrayCount(snapshot?.policyHolders)}
                        />
                        <Row
                          label="Insured Entries"
                          value={arrayCount(snapshot?.entries)}
                        />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                          Regulatory Record
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Row
                          label="Cover Note"
                          value={String(
                            regulatory?.currentCoverNoteReference ??
                              currentVersion.regulatory_reference ??
                              policy.cover_note_no ??
                              '-',
                          )}
                        />
                        <Row
                          label="TIRAMIS Request"
                          value={String(
                            regulatory?.requestId ??
                              policy.tiramis_request_id ??
                              '-',
                          )}
                        />
                        <Row
                          label="TIRAMIS Transaction"
                          value={String(
                            regulatory?.tiramisTransactionId ??
                              policy.tiramis_transaction_id ??
                              '-',
                          )}
                        />
                        <Row
                          label="Total Sum Insured"
                          value={`${policy.currency} ${String(
                            totals?.sumInsured ?? policy.sum_insured,
                          )}`}
                        />
                        <Row
                          label="Total Premium"
                          value={`${policy.currency} ${String(
                            totals?.totalPremium ?? policy.total_premium,
                          )}`}
                        />
                      </CardContent>
                    </Card>
                  </>
                );
              })()}
            </>
          )}
        </TabsContent>

        <TabsContent value="versions" className="space-y-4">
          {versions.map((version) => (
            <Card key={version.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">
                      Policy Version {version.version_number}
                    </p>
                    <p className="text-sm text-slate-500">
                      {version.version_type}
                    </p>
                  </div>
                  {version.is_current && <Badge>Current</Badge>}
                </div>
                <div className="mt-4 space-y-2">
                  <Row label="Effective From" value={version.effective_from} />
                  <Row label="Effective To" value={version.effective_to} />
                  <Row
                    label="Cover Note"
                    value={version.regulatory_reference ?? '-'}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
          {versions.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-sm text-slate-500">
                No policy versions are available.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="risks" className="space-y-4">
          {(policy.risks ?? []).map((risk) => (
            <Card key={risk.id}>
              <CardContent className="space-y-2 pt-6">
                <Row
                  label="Risk"
                  value={risk.risk?.risk_name ?? risk.risk_id}
                />
                <Row label="Sum Insured" value={risk.sum_insured} />
                <Row label="Premium" value={risk.total_premium} />
                <Row
                  label="Vehicle"
                  value={
                    risk.motor_vehicle?.registration_no ?? risk.motor_vehicle_id
                  }
                />
              </CardContent>
            </Card>
          ))}
          {(policy.risks ?? []).length === 0 && (
            <p className="text-sm text-slate-500">No policy risks yet.</p>
          )}
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-4">
          {(policy.premium_breakdowns ?? []).map((item) => (
            <Card key={item.id}>
              <CardContent className="space-y-2 pt-6">
                <Row label="Item" value={item.item_name} />
                <Row label="Code" value={item.item_code} />
                <Row label="Amount" value={item.amount} />
              </CardContent>
            </Card>
          ))}
          {(policy.premium_breakdowns ?? []).length === 0 && (
            <p className="text-sm text-slate-500">No breakdown items.</p>
          )}
        </TabsContent>

        <TabsContent value="motor" className="space-y-4">
          {contractEntries
            .filter((entry) => Boolean(asObject(entry.motor)))
            .map((entry) => {
              const motor = asObject(entry.motor);

              if (!motor) {
                return null;
              }

              return (
                <Card key={String(entry.entryId)}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      {String(
                        motor.registrationNumber ?? `Motor ${entry.entryNumber}`,
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Row
                      label="Registration"
                      value={String(motor.registrationNumber ?? '-')}
                    />
                    <Row
                      label="Chassis"
                      value={String(motor.chassisNumber ?? '-')}
                    />
                    <Row
                      label="Engine"
                      value={String(motor.engineNumber ?? '-')}
                    />
                    <Row label="Make" value={String(motor.make ?? '-')} />
                    <Row label="Model" value={String(motor.model ?? '-')} />
                    <Row
                      label="Body Type"
                      value={String(motor.bodyType ?? '-')}
                    />
                    <Row
                      label="Manufacture Year"
                      value={String(motor.yearOfManufacture ?? '-')}
                    />
                    <Row label="Usage" value={String(motor.motorUsage ?? '-')} />
                    <Row label="Owner" value={String(motor.ownerName ?? '-')} />
                  </CardContent>
                </Card>
              );
            })}

          {contractEntries.filter((entry) => Boolean(asObject(entry.motor)))
            .length === 0 && (
            <Card>
              <CardContent className="pt-6 text-sm text-slate-500">
                This policy does not contain a motor asset.
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="nonmotor" className="space-y-4">
          {canCreate && (
            <div className="flex justify-end">
              <Button onClick={() => setNonMotorOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Non-Motor Detail
              </Button>
            </div>
          )}
          <DataTable
            columns={nonMotorColumns}
            data={nonMotorDetails}
            loading={false}
            page={1}
            limit={nonMotorDetails.length || 1}
            total={nonMotorDetails.length}
            totalPages={1}
            onPageChange={() => undefined}
            onLimitChange={() => undefined}
          />
        </TabsContent>
        <TabsContent value="endorsements" className="space-y-4">
          {canCreateEndorsement && eligibility && !eligibility.eligible && (
            <Card>
              <CardContent className="pt-6">
                <p className="font-medium">Endorsement unavailable</p>
                {eligibility.blockers.map((blocker) => (
                  <p key={blocker.code} className="mt-1 text-sm text-slate-500">
                    {blocker.message}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}
          <DataTable
            columns={endorsementColumns}
            data={endorsements}
            loading={endorsementsLoading}
            page={1}
            limit={endorsements.length || 1}
            total={endorsements.length}
            totalPages={1}
            onPageChange={() => undefined}
            onLimitChange={() => undefined}
          />
        </TabsContent>
        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardContent className="pt-6 text-sm text-slate-500">
              Billing data can be connected here later.
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="tiramis" className="space-y-4">
          <Card>
            <CardContent className="pt-6 text-sm text-slate-500">
              TIRAMIS submissions are stored on the policy record and can be
              expanded later.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {(policy.status_history ?? []).map((entry) => (
            <Card key={entry.id}>
              <CardContent className="space-y-2 pt-6">
                <Row label="From" value={entry.old_status} />
                <Row label="To" value={entry.new_status} />
                <Row label="Reason" value={entry.reason} />
                <Row label="Changed At" value={entry.created_at} />
              </CardContent>
            </Card>
          ))}
          {(policy.status_history ?? []).length === 0 && (
            <p className="text-sm text-slate-500">No history yet.</p>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardContent className="pt-6 text-sm text-slate-500">
              Document management can be connected here later.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={nonMotorOpen} onOpenChange={setNonMotorOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Non-Motor Detail</DialogTitle>
          </DialogHeader>
          {canCreate && (
            <PolicyNonMotorDetailForm
              policy={policy}
              risks={policyRisks}
              subjectMatters={subjectMatterOptions}
              isPending={createNonMotorMutation.isPending}
              submitLabel="Create Detail"
              onSubmit={(values) => {
                createNonMotorMutation.mutate(values, {
                  onSuccess: () => setNonMotorOpen(false),
                });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <TiramisSubmissionDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        title="Submit Policy to TIRAMIS"
        description="Choose the branch and sale point for this submission. If a unique or default sale point exists, it will be used automatically."
        initialBranchId={policy.branch_id}
        isPending={submitMutation.isPending}
        readiness={
          tiramisSubmissionPayload
            ? {
                requestType: tiramisSubmissionPayload.requestType,
                sourceModule:
                  tiramisSubmissionPayload.source_module || 'policies',
                sourceRecordId:
                  tiramisSubmissionPayload.source_record_id || policy.id,
                payload: tiramisSubmissionPayload.payload,
              }
            : undefined
        }
        onSubmit={(selection) => {
          submitMutation.mutate(selection, {
            onSuccess: (result) => {
              setSubmitOpen(false);
              navigate(
                underwritingPaths.submissionDetail(result.submission.id),
              );
            },
          });
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Policy"
        description="This will soft-delete the policy."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() =>
          deleteMutation.mutate(policy.id, {
            onSuccess: () => navigate(underwritingPaths.policies),
          })
        }
      />
    </div>
  );
}
