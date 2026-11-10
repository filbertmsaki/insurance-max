import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { resolvePolicyFlow } from '../utils/policyFlow';
import { Download, Play, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/shared/StatusBadge';
import {
  ActionMenu,
  type ActionMenuItem,
} from '@/components/shared/ActionMenu';
import { DataTable, type Column } from '@/components/data-table';
import {
  displayValue,
  formatDate,
  formatMoney,
} from '@/components/shared/detailFormat';
import { RecordSummaryHeader } from '@/components/record-summary/RecordSummaryHeader';
import {
  downloadPdf,
  documentFilename,
} from '@/modules/shared/documents/download-pdf';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import {
  useCreateNonMotorPolicyDetail,
  useNonMotorPolicyDetails,
  useNonMotorPolicyRisks,
  useSubjectMatterOptions,
} from '@/modules/tenant/non-motor/hooks';
import { PolicyNonMotorDetailForm } from '@/modules/tenant/non-motor/components/PolicyNonMotorDetailForm';
import { coverNotesApi } from '@/modules/tenant/cover-notes/api';
import { useSyncQuotationTira } from '@/modules/tenant/quotations/hooks';
import { SectionCard } from '@/modules/tenant/quotations/components/QuotationDetailLayout';
import { useIsPhone } from '@/modules/tenant/quotations/utils/useIsPhone';
import { sharedUnderwritePaths } from '@/modules/tenant/underwrite/paths';
import {
  useCancellationEligibility,
  useEndorsementEligibility,
  usePendingPolicyTransaction,
  usePolicyCancellations,
  usePolicyCurrentVersion,
  usePolicyDetail,
  usePolicyEndorsementsTable,
  usePolicyRenewals,
  useCreateRenewal,
  usePolicyVersions,
  useRetryPolicyEndorsementTiramis,
  useRenewalEligibility,
  useSubmitPolicyEndorsementToTiramis,
} from '../hooks';
import type {
  PolicyCancellationRecord,
  PolicyEndorsementRecord,
  PolicyRenewalRecord,
} from '../types';
import { usePolicyTransactionScope } from '../transaction-scope';
import { usePageTitle } from '@/modules/shared/meta/page-title';
import { PolicyDetailsTab } from '../components/PolicyDetailSections';
import {
  PolicyClaimsTab,
  PolicyDocumentsTab,
  PolicyHistoryTab,
  PolicyPaymentsTab,
  PolicyTiraTab,
} from '../components/PolicyRelatedTabs';
import { usePolicyInvoices } from '../components/usePolicyInvoices';
import { policyKind, type PolicyKind } from '../utils/policyDisplay';
import { policySummary } from '../utils/policySummary';

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

const TABS = [
  { id: 'details', label: 'Policy details', short: 'Details' },
  { id: 'endorsements', label: 'Endorsements', short: 'Endorsements' },
  { id: 'renewals', label: 'Renewals', short: 'Renewals' },
  { id: 'claims', label: 'Claims', short: 'Claims' },
  { id: 'documents', label: 'Documents', short: 'Documents' },
  { id: 'payments', label: 'Payments', short: 'Payments' },
  { id: 'tira', label: 'TIRA', short: 'TIRA MIS' },
  { id: 'history', label: 'History', short: 'History' },
] as const;

const DETAIL_KIND: Record<string, PolicyKind> = {
  MOTOR_SINGLE: 'single',
  MOTOR_FLEET: 'fleet',
  NON_MOTOR: 'non_motor',
};

export function PolicyDetailPage({
  storedBusinessLine,
  insuredItems,
  belowHeader,
}: {
  /**
   * The policy's stored line (MOTOR | FLEET | NON_MOTOR). When given it decides
   * Single vs Fleet, so a fleet reduced to one vehicle stays a fleet. Without
   * it the page falls back to counting vehicles (legacy behaviour).
   */
  storedBusinessLine?: string | null;
  /** Host content for the Vehicles / Insured items section. */
  insuredItems?: ReactNode;
  /** Host content between the summary header and the tabs. */
  belowHeader?: ReactNode;
} = {}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isPhone = useIsPhone();
  const { paths } = usePolicyTransactionScope();
  const { hasPermission } = useAuthStore();
  const canCreate = hasPermission('non-motor:create');
  const canCreateEndorsement = hasPermission('endorsements:create');
  const canCreateCancellation = hasPermission('cancellations:create');
  const canCreateRenewal = hasPermission('renewals:create');
  const canViewRenewals = hasPermission('renewals:read');
  const canViewCancellations =
    hasPermission('cancellations:read') ||
    hasPermission('cancellations:approve');
  const canViewEndorsements =
    hasPermission('endorsements:create') ||
    hasPermission('policy-transactions:read') ||
    hasPermission('endorsements:approve');
  const canViewPendingTransaction = hasPermission('policy-transactions:read');
  const canSubmitEndorsement = hasPermission('endorsements:submit-tiramis');
  const canRetryEndorsement = hasPermission('endorsements:retry-tiramis');
  const canReadCoverNotes = hasPermission('cover-notes:read');
  const canSync = hasPermission('tiramis.sync');
  const { data: policy, isLoading } = usePolicyDetail(id);
  usePageTitle(policy?.policy_no && `Policy ${policy.policy_no}`);
  const { tableProps: endorsementsTableProps } = usePolicyEndorsementsTable(
    policy?.id,
    canViewEndorsements,
  );
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
  const syncMutation = useSyncQuotationTira(policy?.quotation_id ?? undefined);
  const { data: nonMotorDetails = [] } = useNonMotorPolicyDetails(policy?.id);
  const { data: policyRisks = [] } = useNonMotorPolicyRisks(policy?.id);
  const { data: subjectMatterOptions = [] } = useSubjectMatterOptions();
  const createNonMotorMutation = useCreateNonMotorPolicyDetail();
  const { data: currentVersion } = usePolicyCurrentVersion(policy?.id);
  const { data: versions = [] } = usePolicyVersions(policy?.id);
  const coverNotesQuery = useQuery({
    queryKey: ['cover-notes', 'policy', policy?.id],
    queryFn: () => coverNotesApi.list({ policy_id: policy!.id }),
    enabled: canReadCoverNotes && Boolean(policy?.id),
    staleTime: 30_000,
  });
  const { invoices } = usePolicyInvoices(policy?.id ?? '');
  const [nonMotorOpen, setNonMotorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

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
        header: 'TIRA',
        hideOnMobile: true,
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
        key: 'actions',
        header: '',
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
                    : ''}
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
              onClick={() =>
                canRetry
                  ? retryEndorsementMutation.mutate(row.id)
                  : submitEndorsementMutation.mutate(row.id)
              }
            >
              <Play className="mr-1.5 h-3.5 w-3.5" />
              {canRetry ? 'Retry issuance' : 'Issue endorsement'}
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
        hideOnMobile: true,
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
        hideOnMobile: true,
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
      <div className="py-24 text-center text-slate-500">
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
  const kind =
    DETAIL_KIND[
      resolvePolicyFlow({
        storedLine: storedBusinessLine,
        categoryBusinessLine: policy.category?.business_line,
        vehicleCount,
      })
    ] ?? policyKind(storedBusinessLine);

  const endorsementBlockedReason = !eligibility?.eligible
    ? (eligibility?.blockers?.[0]?.message ??
      'This policy is not currently eligible for a new endorsement.')
    : null;
  const cancellationBlockedReason = ['CANCELLED', 'EXPIRED', 'LAPSED'].includes(
    policy.policy_status ?? '',
  )
    ? 'This policy is already cancelled, expired, or lapsed.'
    : !cancellationEligibility?.eligible
      ? (cancellationEligibility?.blockers?.[0]?.message ??
        'This policy is not currently eligible for cancellation.')
      : null;
  const canStartRenewal =
    canCreateRenewal && renewalEligibility?.eligible === true;
  // Endorse is shown only when the policy's status allows it.
  const canEndorse = canCreateEndorsement && !endorsementBlockedReason;
  const tiraSuccess = ['SUCCESS', 'ENDORSED', 'SYNCED'].includes(
    String(policy.tira_status || policy.tiramis_status || '').toUpperCase(),
  );
  const canSyncPolicy = canSync && Boolean(policy.quotation_id);

  const startRenewal = () =>
    createRenewalMutation.mutate(undefined, {
      onSuccess: (renewal: { id: string }) =>
        navigate(paths.policyRenewalDetail(policy.id, renewal.id)),
    });
  const downloadSchedule = () =>
    void downloadPdf(
      `/tenant/policies/${policy.id}/schedule/download`,
      documentFilename(`Policy_${policy.policy_no}`),
    );

  const pendingRenewalMatch =
    pendingTransaction?.transaction_type === 'RENEWAL'
      ? renewals.find(
          (renewal) => renewal.policy_transaction_id === pendingTransaction.id,
        )
      : undefined;
  const pendingTransactionLabel =
    pendingTransaction?.transaction_type === 'ENDORSEMENT'
      ? 'Continue pending endorsement'
      : pendingTransaction?.transaction_type === 'CANCELLATION'
        ? 'View pending cancellation'
        : pendingTransaction?.transaction_type === 'RENEWAL'
          ? 'View pending renewal'
          : null;
  const pendingTransactionHref =
    pendingTransaction?.transaction_type === 'ENDORSEMENT'
      ? paths.policyEndorsementEdit(policy.id, pendingTransaction.id)
      : pendingTransaction?.transaction_type === 'CANCELLATION'
        ? paths.policyCancellationDetail(policy.id, pendingTransaction.id)
        : pendingRenewalMatch
          ? paths.policyRenewalDetail(policy.id, pendingRenewalMatch.id)
          : null;

  const secondaryActions: ActionMenuItem[] = [
    ...(canCreateCancellation && !cancellationBlockedReason
      ? [
          {
            label: 'Cancel policy',
            destructive: true,
            onClick: () => navigate(paths.policyCancellationCreate(policy.id)),
          },
        ]
      : []),
    ...(!policy.issued_by_system &&
    !isEndorsedPolicyStatus(policy.policy_status)
      ? [
          {
            label: 'Edit',
            separatorBefore: true,
            onClick: () =>
              navigate(sharedUnderwritePaths.policyEdit(policy.id)),
          },
        ]
      : []),
  ];

  const actions = (
    <div className="flex items-center gap-2 [&_button]:h-[34px] [&_button]:min-h-0 [&_button]:text-[13px] [&_svg]:h-[15px] [&_svg]:w-[15px]">
      {canSyncPolicy && tiraSuccess ? (
        <Button
          size="sm"
          variant="outline"
          disabled={syncMutation.isPending}
          onClick={() => syncMutation.mutate()}
        >
          <RefreshCcw className="mr-2" />
          Sync
        </Button>
      ) : null}
      {canEndorse ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate(paths.policyEndorsementCreate(policy.id))}
        >
          Endorse
        </Button>
      ) : null}
      {canStartRenewal ? (
        <Button
          size="sm"
          variant="outline"
          disabled={createRenewalMutation.isPending}
          onClick={startRenewal}
        >
          Renew
        </Button>
      ) : null}
      <Button size="sm" onClick={downloadSchedule}>
        <Download className="mr-2" />
        Download
      </Button>
      <ActionMenu
        className="h-[34px] w-[34px] shrink-0 rounded-md border border-slate-200"
        items={secondaryActions}
        contentClassName="w-56"
      />
    </div>
  );

  const menuItems: ActionMenuItem[] = [
    ...(canSyncPolicy && tiraSuccess
      ? [
          {
            label: 'Sync with TIRA',
            onClick: () => syncMutation.mutate(),
            disabled: syncMutation.isPending,
          },
        ]
      : []),
    ...(canEndorse
      ? [
          {
            label: 'Endorse policy',
            onClick: () => navigate(paths.policyEndorsementCreate(policy.id)),
          },
        ]
      : []),
    ...(canStartRenewal
      ? [
          {
            label: 'Renew policy',
            onClick: startRenewal,
            disabled: createRenewalMutation.isPending,
          },
        ]
      : []),
    { label: 'Download policy schedule', onClick: downloadSchedule },
    ...secondaryActions,
  ];

  const retry =
    canSyncPolicy && !tiraSuccess
      ? {
          label: 'Retry sync',
          onClick: () => syncMutation.mutate(),
          pending: syncMutation.isPending,
        }
      : null;

  const summary = policySummary({
    policy,
    kind,
    version: currentVersion,
    coverNotes: canReadCoverNotes ? (coverNotesQuery.data ?? []) : undefined,
    invoices,
    quotationHref: policy.quotation_id
      ? paths.quotationDetail(policy.quotation_id)
      : undefined,
    renew: canStartRenewal
      ? { onClick: startRenewal, pending: createRenewalMutation.isPending }
      : null,
  });

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1440px] space-y-4 md:space-y-3">
      <RecordSummaryHeader
        summary={summary}
        onBack={() => navigate(paths.policies)}
        actions={actions}
        menuItems={menuItems}
        retry={retry}
        onViewVehicles={() => setActiveTab('details')}
      />

      {policy.pending_transaction_id &&
        (canCreateEndorsement || canCreateCancellation || canCreateRenewal) && (
          <Alert>
            <AlertTitle>Policy transaction in progress</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                This policy already has an endorsement, cancellation or renewal
                in progress. New ones are disabled until it completes or is
                cancelled.
              </p>
              {pendingTransactionHref && pendingTransactionLabel ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => navigate(pendingTransactionHref)}
                >
                  {pendingTransactionLabel}
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        )}

      {belowHeader}

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="min-w-0 space-y-0 rounded-md border border-slate-200 bg-white"
      >
        <div className="max-w-full overflow-x-auto px-2 max-md:sticky max-md:top-14 max-md:z-10 max-md:rounded-t-md max-md:border-b max-md:border-[#E6E8EF] max-md:bg-white sm:px-4">
          <TabsList
            aria-label="Policy information"
            className="w-max min-w-full flex-nowrap gap-0"
          >
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="min-h-11 px-3 sm:px-4 md:h-[38px] md:min-h-0 md:py-0 md:text-[13px]"
              >
                {isPhone ? tab.short : tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="details" className="mt-0 min-w-0">
          <PolicyDetailsTab
            policy={policy}
            kind={kind}
            version={currentVersion}
            versionsCount={versions.length}
            coverNotes={coverNotesQuery.data}
            endorsements={endorsementsTableProps.data}
            quotationHref={
              policy.quotation_id
                ? paths.quotationDetail(policy.quotation_id)
                : undefined
            }
            insuredItems={insuredItems}
            nonMotorDetails={kind === 'non_motor' ? nonMotorDetails : []}
            onAddNonMotorDetail={
              canCreate && kind === 'non_motor'
                ? () => setNonMotorOpen(true)
                : undefined
            }
            onOpenEndorsements={() => setActiveTab('endorsements')}
            onOpenHistory={() => setActiveTab('history')}
          />
        </TabsContent>

        <TabsContent value="endorsements" className="mt-0 min-w-0">
          {canCreateEndorsement && endorsementBlockedReason && (
            <p className="mx-4 mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 sm:mx-6">
              <span className="font-semibold">
                New endorsement unavailable.
              </span>{' '}
              {endorsementBlockedReason}
            </p>
          )}
          <SectionCard title="Endorsements">
            <DataTable
              {...endorsementsTableProps}
              columns={endorsementColumns}
              rowKey={(row) => row.id}
              searchPlaceholder="Search endorsement number or reason"
              showColumnVisibility={false}
            />
          </SectionCard>
          <SectionCard title="Cancellations">
            {canViewCancellations ? (
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
                showColumnVisibility={false}
                emptyMessage="No cancellations have been started for this policy."
              />
            ) : (
              <p className="text-sm text-slate-500">
                You do not have permission to view cancellations.
              </p>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="renewals" className="mt-0 min-w-0">
          {canCreateRenewal &&
            renewalEligibility &&
            !renewalEligibility.eligible && (
              <p className="mx-4 mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 sm:mx-6">
                <span className="font-semibold">Renewal unavailable.</span>{' '}
                {renewalEligibility.blockers.map((b) => b.message).join(' ')}
              </p>
            )}
          <SectionCard title="Renewals">
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
              showColumnVisibility={false}
              emptyMessage="No renewals have been started for this policy yet."
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="claims" className="mt-0 min-w-0">
          {activeTab === 'claims' && <PolicyClaimsTab policyId={policy.id} />}
        </TabsContent>

        <TabsContent value="documents" className="mt-0 min-w-0">
          <PolicyDocumentsTab policy={policy} />
        </TabsContent>

        <TabsContent value="payments" className="mt-0 min-w-0">
          {activeTab === 'payments' && <PolicyPaymentsTab policy={policy} />}
        </TabsContent>

        <TabsContent value="tira" className="mt-0 min-w-0 p-3 sm:p-4">
          <PolicyTiraTab policy={policy} retry={retry} />
        </TabsContent>

        <TabsContent value="history" className="mt-0 min-w-0 p-3 sm:p-4">
          <PolicyHistoryTab policy={policy} versions={versions} />
        </TabsContent>
      </Tabs>

      <Dialog open={nonMotorOpen} onOpenChange={setNonMotorOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
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
    </div>
  );
}
