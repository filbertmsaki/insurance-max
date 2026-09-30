import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye, Play, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { StatusBadge } from '@/components/shared/StatusBadge';
import {
  ActionMenu,
  type ActionMenuItem,
} from '@/components/shared/ActionMenu';
import { DetailPageHeader } from '@/components/shared/DetailPageHeader';
import {
  SectionCard,
  KeyValueGrid,
  EmptyState,
} from '@/components/shared/DetailSections';
import { PremiumBreakdown } from '@/components/shared/PremiumBreakdown';
import { ActivityTimeline } from '@/components/shared/ActivityTimeline';
import {
  displayValue,
  formatDate,
  formatDateTime,
  formatMoney,
} from '@/components/shared/detailFormat';
import { PolicyStatusBadge } from '../components/PolicyStatusBadge';
import {
  useDeletePolicy,
  useCancellationEligibility,
  useEndorsementEligibility,
  usePendingPolicyTransaction,
  usePolicyCancellations,
  usePolicyCurrentVersion,
  usePolicyDetail,
  usePolicyEndorsements,
  usePolicyRenewals,
  useCreateRenewal,
  usePolicyVersions,
  useRetryPolicyEndorsementTiramis,
  useRenewalEligibility,
  useSubmitPolicyEndorsementToTiramis,
} from '../hooks';
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
import type {
  PolicyCancellationRecord,
  PolicyEndorsementRecord,
  PolicyRenewalRecord,
} from '../types';
import { usePolicyTransactionScope } from '../transaction-scope';

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

const RETRYABLE_SUBMISSION_STATUSES = new Set(['FAILED', 'RETRYABLE']);
const ENDORSED_POLICY_STATUSES = new Set(['ENDORSED', 'ACTIVE_ENDORSED']);

function canIssueEndorsement(endorsement: PolicyEndorsementRecord) {
  return (
    endorsement.stage === 'COMPLETED' &&
    endorsement.submission_status === 'READY'
  );
}

function isEndorsedPolicyStatus(status: string | null | undefined) {
  const normalized = String(status ?? '')
    .trim()
    .toUpperCase()
    .replace(/[.\s-]+/g, '_');

  return ENDORSED_POLICY_STATUSES.has(normalized);
}

type PolicyFlow = 'MOTOR_SINGLE' | 'MOTOR_FLEET' | 'NON_MOTOR';

/**
 * Policies don't carry a quotation_flow-style discriminator directly, so this
 * derives the same three-way split from data the policy already has: business
 * line from the category, and fleet-vs-single from how many vehicles are
 * actually on the policy today (not a stale is_fleet flag from quote time —
 * this stays correct even after an endorsement changes the vehicle count).
 */
function derivePolicyFlow(
  businessLine: string | undefined,
  vehicleCount: number,
): PolicyFlow {
  if (businessLine !== 'MOTOR') return 'NON_MOTOR';
  return vehicleCount > 1 ? 'MOTOR_FLEET' : 'MOTOR_SINGLE';
}

const POLICY_DETAIL_TAB_LABELS: Record<string, string> = {
  overview: 'Overview',
  vehicle: 'Vehicle',
  vehicles: 'Vehicles',
  'risk-details': 'Risk Details',
  nonmotor: 'Non-Motor Detail',
  premium: 'Premium',
  endorsements: 'Endorsements',
  renewals: 'Renewals',
  cancellations: 'Cancellations',
  tiramis: 'TIRA',
  history: 'History',
  contract: 'Contract',
};

function getPolicyDetailTabs(flow: PolicyFlow): string[] {
  const tabs = ['overview'];
  if (flow === 'MOTOR_FLEET') {
    tabs.push('vehicles');
  } else if (flow === 'MOTOR_SINGLE') {
    tabs.push('vehicle');
  } else {
    tabs.push('risk-details', 'nonmotor');
  }
  tabs.push(
    'premium',
    'endorsements',
    'renewals',
    'cancellations',
    'tiramis',
    'history',
    'contract',
  );
  return tabs;
}

/**
 * Fleet vehicle detail lives only in the policy_snapshot JSON (the same
 * source the old "Motor Details" tab read from) — the /risks endpoint's
 * motor_vehicle relation isn't joined server-side, so per-vehicle premium
 * can't be shown here without a backend change (see the View Page Blueprint).
 */
function PolicyVehiclesTable({
  entries,
}: {
  entries: Record<string, unknown>[];
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, unknown> | null>(
    null,
  );

  const vehicles = entries
    .map((entry) => asObject(entry.motor))
    .filter((motor): motor is Record<string, unknown> => Boolean(motor));

  if (vehicles.length === 0) {
    return <EmptyState text="This policy does not contain any motor assets." />;
  }

  const query = search.trim().toLowerCase();
  const filtered = query
    ? vehicles.filter((motor) =>
        [motor.registrationNumber, motor.make, motor.model]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query),
      )
    : vehicles;

  const tableColumns: Column<Record<string, unknown>>[] = [
    {
      key: 'registration',
      header: 'Reg. No.',
      cell: (motor) => displayValue(motor.registrationNumber as string | null),
    },
    {
      key: 'vehicle',
      header: 'Vehicle',
      cell: (motor) =>
        `${displayValue(motor.make as string | null)} ${displayValue(motor.model as string | null)}`,
    },
    {
      key: 'chassis',
      header: 'Chassis',
      cell: (motor) => displayValue(motor.chassisNumber as string | null),
    },
    {
      key: 'usage',
      header: 'Usage',
      cell: (motor) => displayValue(motor.motorUsage as string | null),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (motor) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelected(motor)}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search registration, make, model..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="pl-9"
        />
      </div>

      <DataTable
        columns={tableColumns}
        data={filtered}
        page={1}
        limit={filtered.length || 1}
        total={filtered.length}
        totalPages={1}
        onPageChange={() => undefined}
        onLimitChange={() => undefined}
        showColumnVisibility={false}
      />

      <Dialog
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selected
                ? displayValue(selected.registrationNumber as string | null)
                : 'Vehicle'}
            </DialogTitle>
          </DialogHeader>
          {selected ? (
            <KeyValueGrid
              items={[
                {
                  label: 'Registration',
                  value: displayValue(
                    selected.registrationNumber as string | null,
                  ),
                },
                {
                  label: 'Chassis',
                  value: displayValue(selected.chassisNumber as string | null),
                },
                {
                  label: 'Engine',
                  value: displayValue(selected.engineNumber as string | null),
                },
                {
                  label: 'Make',
                  value: displayValue(selected.make as string | null),
                },
                {
                  label: 'Model',
                  value: displayValue(selected.model as string | null),
                },
                {
                  label: 'Body Type',
                  value: displayValue(selected.bodyType as string | null),
                },
                {
                  label: 'Manufacture Year',
                  value: displayValue(
                    selected.yearOfManufacture as string | number | null,
                  ),
                },
                {
                  label: 'Usage',
                  value: displayValue(selected.motorUsage as string | null),
                },
                {
                  label: 'Owner',
                  value: displayValue(selected.ownerName as string | null),
                },
              ]}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PolicyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { paths } = usePolicyTransactionScope();
  const { hasPermission } = useAuthStore();
  const canCreate = hasPermission('non-motor:create');
  const canCreateEndorsement = hasPermission('endorsements:create');
  const canCreateCancellation = hasPermission('cancellations:create');
  const canCreateRenewal = hasPermission('renewals:create');
  const canViewRenewals = hasPermission('renewals:read');
  const canViewCancellations = hasPermission('cancellations:read');
  const canViewEndorsements = hasPermission('endorsements:create');
  const canViewPendingTransaction = hasPermission('policy-transactions:read');
  const canSubmitEndorsement = hasPermission('endorsements:submit-tiramis');
  const canRetryEndorsement = hasPermission('endorsements:retry-tiramis');
  const { data: policy, isLoading } = usePolicyDetail(id);
  const deleteMutation = useDeletePolicy();
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
  const { data: renewals = [], isLoading: renewalsLoading } = usePolicyRenewals(
    policy?.id,
    canViewRenewals,
  );
  const { data: cancellations = [], isLoading: cancellationsLoading } =
    usePolicyCancellations(policy?.id, canViewCancellations);
  const { data: pendingTransaction } = usePendingPolicyTransaction(
    policy?.pending_transaction_id,
    canViewPendingTransaction,
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
  const contractEntries = Array.isArray(
    currentVersion?.policy_snapshot?.['entries'],
  )
    ? (currentVersion?.policy_snapshot?.['entries'] as Record<
        string,
        unknown
      >[])
    : [];
  const endorsementBlockedReason = !eligibility?.eligible
    ? (eligibility?.blockers?.[0]?.message ??
      'This policy is not currently eligible for a new endorsement.')
    : null;
  const cancellationBlockedReason = ['CANCELLED', 'EXPIRED', 'LAPSED'].includes(
    policy?.policy_status ?? '',
  )
    ? 'This policy is already cancelled, expired, or lapsed.'
    : !cancellationEligibility?.eligible
      ? (cancellationEligibility?.blockers?.[0]?.message ??
        'This policy is not currently eligible for cancellation.')
      : null;
  const canStartRenewal =
    canCreateRenewal && renewalEligibility?.eligible === true;
  const shouldShowHeaderSecondaryActions = !isEndorsedPolicyStatus(
    policy?.policy_status,
  );

  const pendingRenewalMatch =
    pendingTransaction?.transaction_type === 'RENEWAL'
      ? renewals.find(
          (renewal) => renewal.policy_transaction_id === pendingTransaction.id,
        )
      : undefined;
  const pendingTransactionLabel =
    pendingTransaction?.transaction_type === 'ENDORSEMENT'
      ? 'Continue Pending Endorsement'
      : pendingTransaction?.transaction_type === 'CANCELLATION'
        ? 'View Pending Cancellation'
        : pendingTransaction?.transaction_type === 'RENEWAL'
          ? 'View Pending Renewal'
          : null;
  const pendingTransactionHref =
    policy && pendingTransaction?.transaction_type === 'ENDORSEMENT'
      ? paths.policyEndorsementEdit(policy.id, pendingTransaction.id)
      : policy && pendingTransaction?.transaction_type === 'CANCELLATION'
        ? paths.policyCancellationDetail(policy.id, pendingTransaction.id)
        : policy && pendingRenewalMatch
          ? paths.policyRenewalDetail(policy.id, pendingRenewalMatch.id)
          : null;

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
        cell: (row) => formatDate(row.effective_date),
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
          formatMoney(
            Number(row.net_premium_difference ?? 0),
            row.currency_code,
          ),
      },
      {
        key: 'tiramis_request_id',
        header: 'Request ID',
        cell: (row) => displayValue(row.tiramis_request_id),
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

  const renewalColumns: Column<PolicyRenewalRecord>[] = useMemo(
    () => [
      {
        key: 'renewal_no',
        header: 'Renewal No.',
        cell: (row) => row.renewal_no,
      },
      {
        key: 'renewal_period',
        header: 'Renewal Period',
        cell: (row) =>
          `${formatDate(row.renewal_start_date)} – ${formatDate(row.renewal_end_date)}`,
      },
      {
        key: 'renewal_status',
        header: 'Status',
        cell: (row) => <StatusBadge status={row.renewal_status} />,
      },
      {
        key: 'offer_expires_at',
        header: 'Offer Expires',
        cell: (row) => formatDate(row.offer_expires_at),
      },
      {
        key: 'actions',
        header: '',
        cell: (row) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              navigate(paths.policyRenewalDetail(policy!.id, row.id))
            }
          >
            View
          </Button>
        ),
      },
    ],
    [navigate, paths, policy],
  );

  const cancellationColumns: Column<PolicyCancellationRecord>[] = useMemo(
    () => [
      {
        key: 'transaction_no',
        header: 'Cancellation No.',
        cell: (row) => row.transaction_no,
      },
      {
        key: 'effective_date',
        header: 'Effective Date',
        cell: (row) => formatDate(row.effective_date),
      },
      {
        key: 'stage',
        header: 'Stage',
        cell: (row) => <StatusBadge status={row.stage} />,
      },
      {
        key: 'reason',
        header: 'Reason',
        cell: (row) => displayValue(row.reason),
      },
      {
        key: 'actions',
        header: '',
        cell: (row) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              navigate(paths.policyCancellationDetail(policy!.id, row.id))
            }
          >
            View
          </Button>
        ),
      },
    ],
    [navigate, paths, policy],
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
        <Button variant="link" onClick={() => navigate(paths.policies)}>
          Back to Policies
        </Button>
      </div>
    );
  }

  const vehicleCount = (policy.risks ?? []).filter(
    (risk) => risk.motor_vehicle_id,
  ).length;
  const policyFlow = derivePolicyFlow(
    policy.category?.business_line,
    vehicleCount,
  );
  const tabs = getPolicyDetailTabs(policyFlow);

  const primaryAction: ActionMenuItem | null = canCreateEndorsement
    ? {
        label: 'Create Endorsement',
        disabled: !!endorsementBlockedReason,
        title: endorsementBlockedReason ?? undefined,
        onClick: () => navigate(paths.policyEndorsementCreate(policy.id)),
      }
    : canStartRenewal
      ? {
          label: 'Renew Policy',
          disabled: createRenewalMutation.isPending,
          onClick: () =>
            createRenewalMutation.mutate(undefined, {
              onSuccess: (renewal: { id: string }) =>
                navigate(paths.policyRenewalDetail(policy.id, renewal.id)),
            }),
        }
      : null;

  const secondaryActions: ActionMenuItem[] = [
    ...(canStartRenewal && primaryAction?.label !== 'Renew Policy'
      ? [
          {
            label: 'Renew Policy',
            disabled: createRenewalMutation.isPending,
            onClick: () =>
              createRenewalMutation.mutate(undefined, {
                onSuccess: (renewal: { id: string }) =>
                  navigate(paths.policyRenewalDetail(policy.id, renewal.id)),
              }),
          },
        ]
      : []),
    ...(canCreateCancellation
      ? [
          {
            label: 'Cancel Policy',
            destructive: true,
            disabled: !!cancellationBlockedReason,
            title: cancellationBlockedReason ?? undefined,
            onClick: () => navigate(paths.policyCancellationCreate(policy.id)),
          },
        ]
      : []),
    ...(!policy.issued_by_system
      ? [
          {
            label: 'Edit',
            separatorBefore: true,
            onClick: () => navigate(underwritingPaths.policyEdit(policy.id)),
          },
          {
            label: 'Delete',
            destructive: true,
            onClick: () => setDeleteOpen(true),
          },
        ]
      : []),
  ];
  // Endorsed policies keep a trimmed header menu, but can still be
  // cancelled (the backend treats ENDORSED as cancellable).
  const headerSecondaryActions = shouldShowHeaderSecondaryActions
    ? secondaryActions
    : secondaryActions.filter((action) => action.label === 'Cancel Policy');

  return (
    <div className="space-y-6">
      <DetailPageHeader
        onBack={() => navigate(paths.policies)}
        title={policy.policy_no}
        badges={<PolicyStatusBadge status={policy.policy_status} />}
        subtitle={policy.customer?.company_name ?? policy.customer_id}
        kpis={[
          { label: 'Effective', value: formatDate(policy.start_date) },
          { label: 'Expires', value: formatDate(policy.end_date) },
          {
            label: 'Total Premium',
            value: formatMoney(Number(policy.total_premium), policy.currency),
          },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {primaryAction ? (
              <Button
                type="button"
                size="sm"
                disabled={primaryAction.disabled}
                title={primaryAction.title}
                onClick={primaryAction.onClick}
              >
                {primaryAction.label}
              </Button>
            ) : null}
            <ActionMenu
              items={headerSecondaryActions}
              contentClassName="w-56"
            />
          </div>
        }
      />

      {policy.pending_transaction_id &&
        (canCreateEndorsement || canCreateCancellation || canCreateRenewal) && (
          <Alert>
            <AlertTitle>Policy transaction in progress</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                This policy already has an active endorsement, cancellation, or
                renewal being processed. New endorsements, cancellations, and
                renewals are disabled until it completes or is cancelled.
              </p>
              {pendingTransactionHref ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => navigate(pendingTransactionHref)}
                >
                  {pendingTransactionLabel}
                </Button>
              ) : canViewPendingTransaction ? (
                <p className="text-xs text-slate-500">
                  Loading the pending transaction...
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  Check the Endorsements, Cancellations, or Renewals tab below
                  to find and complete it.
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

      <Tabs defaultValue={tabs[0]} className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          {tabs.map((tabId) => (
            <TabsTrigger key={tabId} value={tabId}>
              {POLICY_DETAIL_TAB_LABELS[tabId] ?? tabId}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <SectionCard title="Policy Details">
            <KeyValueGrid
              items={[
                {
                  label: 'Customer',
                  value: displayValue(
                    policy.customer?.company_name ?? policy.customer_id,
                  ),
                },
                {
                  label: 'Quotation',
                  value: policy.quotation_id ? (
                    <button
                      type="button"
                      className="cursor-pointer text-sky-700 hover:underline"
                      onClick={() =>
                        navigate(paths.quotationDetail(policy.quotation_id!))
                      }
                    >
                      View Quotation
                    </button>
                  ) : (
                    'N/A'
                  ),
                },
                {
                  label: 'Category',
                  value: displayValue(policy.category?.name),
                },
                {
                  label: 'Product',
                  value: displayValue(policy.product?.product_name),
                },
                { label: 'Channel', value: displayValue(policy.channel_type) },
                {
                  label: 'Branch',
                  value: displayValue(policy.branch?.name),
                },
                {
                  label: 'Intermediary',
                  value: displayValue(policy.intermediary_company?.name),
                },
                {
                  label: 'Sum Insured',
                  value: formatMoney(
                    Number(policy.sum_insured),
                    policy.currency,
                  ),
                },
                {
                  label: 'Issuance Source',
                  value: policy.issued_by_system
                    ? 'TIRAMIS final success'
                    : 'Legacy/manual record',
                },
                {
                  label: 'Cover Note',
                  value: displayValue(policy.cover_note_no),
                },
                {
                  label: 'Regulatory Sync',
                  value: displayValue(policy.regulatory_sync_status),
                },
              ]}
            />
          </SectionCard>
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

          <SectionCard title="Version History">
            <div className="space-y-3">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="rounded-lg border border-slate-200 p-4"
                >
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
                  <div className="mt-3 space-y-1.5">
                    <Row
                      label="Effective"
                      value={`${formatDate(version.effective_from)} – ${formatDate(version.effective_to)}`}
                    />
                    <Row
                      label="Cover Note"
                      value={displayValue(version.regulatory_reference)}
                    />
                  </div>
                </div>
              ))}
              {versions.length === 0 && (
                <EmptyState text="No policy versions are available." />
              )}
            </div>
          </SectionCard>
        </TabsContent>

        {policyFlow === 'MOTOR_SINGLE' && (
          <TabsContent value="vehicle" className="space-y-6">
            {(() => {
              const entryWithMotor = contractEntries.find((entry) =>
                Boolean(asObject(entry.motor)),
              );
              const motor = entryWithMotor
                ? asObject(entryWithMotor.motor)
                : null;
              const risk = (policy.risks ?? [])[0];

              return (
                <>
                  {motor ? (
                    <SectionCard title="Vehicle">
                      <KeyValueGrid
                        items={[
                          {
                            label: 'Registration',
                            value: displayValue(motor.registrationNumber),
                          },
                          {
                            label: 'Chassis',
                            value: displayValue(motor.chassisNumber),
                          },
                          {
                            label: 'Engine',
                            value: displayValue(motor.engineNumber),
                          },
                          { label: 'Make', value: displayValue(motor.make) },
                          { label: 'Model', value: displayValue(motor.model) },
                          {
                            label: 'Body Type',
                            value: displayValue(motor.bodyType),
                          },
                          {
                            label: 'Manufacture Year',
                            value: displayValue(motor.yearOfManufacture),
                          },
                          {
                            label: 'Usage',
                            value: displayValue(motor.motorUsage),
                          },
                          {
                            label: 'Owner',
                            value: displayValue(motor.ownerName),
                          },
                        ]}
                      />
                    </SectionCard>
                  ) : (
                    <EmptyState text="This policy does not contain a motor asset." />
                  )}
                  {risk ? (
                    <SectionCard title="Risk">
                      <KeyValueGrid
                        items={[
                          {
                            label: 'Risk',
                            value: displayValue(risk.risk?.risk_name),
                          },
                          {
                            label: 'Sum Insured',
                            value: formatMoney(
                              Number(risk.sum_insured),
                              policy.currency,
                            ),
                          },
                          {
                            label: 'Premium',
                            value: formatMoney(
                              Number(risk.total_premium),
                              policy.currency,
                            ),
                          },
                        ]}
                      />
                    </SectionCard>
                  ) : null}
                </>
              );
            })()}
          </TabsContent>
        )}

        {policyFlow === 'MOTOR_FLEET' && (
          <TabsContent value="vehicles" className="space-y-4">
            <PolicyVehiclesTable entries={contractEntries} />
          </TabsContent>
        )}

        {policyFlow === 'NON_MOTOR' && (
          <TabsContent value="risk-details" className="space-y-4">
            {(policy.risks ?? []).map((risk) => (
              <SectionCard
                key={risk.id}
                title={displayValue(risk.risk?.risk_name)}
              >
                <KeyValueGrid
                  items={[
                    {
                      label: 'Sum Insured',
                      value: formatMoney(
                        Number(risk.sum_insured),
                        policy.currency,
                      ),
                    },
                    {
                      label: 'Premium',
                      value: formatMoney(
                        Number(risk.total_premium),
                        policy.currency,
                      ),
                    },
                  ]}
                />
              </SectionCard>
            ))}
            {(policy.risks ?? []).length === 0 && (
              <EmptyState text="No policy risks yet." />
            )}
          </TabsContent>
        )}

        <TabsContent value="premium" className="space-y-6">
          <PremiumBreakdown
            currency={policy.currency}
            sumInsured={Number(policy.sum_insured)}
            rows={[
              {
                label: 'Base Premium',
                value: Number(policy.basic_premium),
              },
              {
                label: 'Discount',
                value: Number(policy.total_discount),
                negative: true,
              },
              { label: 'Charges', value: Number(policy.total_charges) },
              {
                label: 'Commission',
                value: Number(policy.total_commission),
              },
              { label: 'Tax', value: Number(policy.total_tax) },
            ]}
            total={{
              label: 'Total Premium',
              value: Number(policy.total_premium),
            }}
          />
          <SectionCard title="Premium Line Items">
            {(policy.premium_breakdowns ?? []).length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(policy.premium_breakdowns ?? []).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{displayValue(item.item_name)}</TableCell>
                      <TableCell className="text-right">
                        {formatMoney(Number(item.amount), policy.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState text="No breakdown items." />
            )}
          </SectionCard>
        </TabsContent>

        {policyFlow === 'NON_MOTOR' && (
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
        )}
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
        <TabsContent value="renewals" className="space-y-4">
          {canCreateRenewal &&
            renewalEligibility &&
            !renewalEligibility.eligible && (
              <Card>
                <CardContent className="pt-6">
                  <p className="font-medium">Renewal unavailable</p>
                  {renewalEligibility.blockers.map((blocker) => (
                    <p
                      key={blocker.code}
                      className="mt-1 text-sm text-slate-500"
                    >
                      {blocker.message}
                    </p>
                  ))}
                </CardContent>
              </Card>
            )}
          <DataTable
            columns={renewalColumns}
            data={renewals}
            loading={renewalsLoading}
            page={1}
            limit={renewals.length || 1}
            total={renewals.length}
            totalPages={1}
            onPageChange={() => undefined}
            onLimitChange={() => undefined}
            emptyMessage="No renewals have been started for this policy yet"
          />
        </TabsContent>
        <TabsContent value="cancellations" className="space-y-4">
          {canCreateCancellation && cancellationBlockedReason && (
            <Card>
              <CardContent className="pt-6">
                <p className="font-medium">Cancellation unavailable</p>
                <p className="mt-1 text-sm text-slate-500">
                  {cancellationBlockedReason}
                </p>
              </CardContent>
            </Card>
          )}
          <DataTable
            columns={cancellationColumns}
            data={cancellations}
            loading={cancellationsLoading}
            page={1}
            limit={cancellations.length || 1}
            total={cancellations.length}
            totalPages={1}
            onPageChange={() => undefined}
            onLimitChange={() => undefined}
            emptyMessage="No cancellations have been started for this policy yet"
          />
        </TabsContent>
        <TabsContent value="tiramis" className="space-y-4">
          <SectionCard title="TIRA">
            <KeyValueGrid
              items={[
                {
                  label: 'Status',
                  value: displayValue(
                    policy.tira_status ?? policy.tiramis_status,
                  ),
                },
                {
                  label: 'Cover Note',
                  value: displayValue(policy.cover_note_no),
                },
                {
                  label: 'Last Synced',
                  value: formatDateTime(policy.tiramis_last_synced_at),
                },
                {
                  label: 'Last Error',
                  value: displayValue(policy.tiramis_last_error_message),
                },
              ]}
            />
            <details className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                Integration Details
              </summary>
              <div className="mt-4">
                <KeyValueGrid
                  items={[
                    {
                      label: 'Request ID',
                      value: displayValue(policy.tiramis_request_id),
                    },
                    {
                      label: 'Transaction ID',
                      value: displayValue(policy.tiramis_transaction_id),
                    },
                    {
                      label: 'Service Type',
                      value: displayValue(policy.tiramis_service_type),
                    },
                    {
                      label: 'Root Element',
                      value: displayValue(policy.tiramis_root_element),
                    },
                    {
                      label: 'Acknowledgement Status Code',
                      value: displayValue(
                        policy.tiramis_acknowledgement_status_code,
                      ),
                    },
                    {
                      label: 'Acknowledgement Description',
                      value: displayValue(
                        policy.tiramis_acknowledgement_status_desc,
                      ),
                    },
                    {
                      label: 'Final Response ID',
                      value: displayValue(policy.tiramis_final_response_id),
                    },
                    {
                      label: 'Final Response Status Code',
                      value: displayValue(
                        policy.tiramis_final_response_status_code,
                      ),
                    },
                    {
                      label: 'Final Response Description',
                      value: displayValue(
                        policy.tiramis_final_response_status_desc,
                      ),
                    },
                  ]}
                />
              </div>
            </details>
          </SectionCard>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <ActivityTimeline
            emptyText="No history yet."
            renderStatus={(status) => <StatusBadge status={status} />}
            entries={(policy.status_history ?? []).map((entry) => ({
              id: entry.id,
              dateTime: entry.created_at,
              action: 'Status changed',
              previousStatus: entry.old_status,
              newStatus: entry.new_status,
              performedBy: entry.changer
                ? `${entry.changer.first_name} ${entry.changer.last_name}`
                : undefined,
              remarks: entry.reason,
            }))}
          />
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

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Policy"
        description="This will soft-delete the policy."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() =>
          deleteMutation.mutate(policy.id, {
            onSuccess: () => navigate(paths.policies),
          })
        }
      />
    </div>
  );
}
