import { lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { ErrorState, TableSkeleton } from '@/components/shared/ContentStates';
import { KeyValueGrid, SectionCard } from '@/components/shared/DetailSections';
import { formatDateTime } from '@/components/shared/detailFormat';
import { nonMotorApi } from '../api';
import { UnderwriteRecordGate } from '../components/UnderwriteRecordGate';
import { underwriteKeys } from '../hooks';
import type { RiskDetailsView, RiskFieldDefinition } from '../types';
import { formatRiskValue, groupRiskFields } from './riskFields';
import { quotationDocumentsKey } from './useNonMotorDocuments';

const QuotationDetailPage = lazy(() =>
  import('@/modules/tenant/quotations/pages/QuotationDetailPage').then(
    (module) => ({ default: module.QuotationDetailPage }),
  ),
);
const PolicyDetailPage = lazy(() =>
  import('@/modules/tenant/policies/pages/PolicyDetailPage').then((module) => ({
    default: module.PolicyDetailPage,
  })),
);

function RiskDetailsPanel({
  details,
  loading,
  error,
  onRetry,
}: {
  details: RiskDetailsView | null | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <SectionCard title="Risk details">
        <ErrorState onRetry={onRetry} />
      </SectionCard>
    );
  }
  if (loading) {
    return (
      <SectionCard title="Risk details">
        <TableSkeleton rows={2} columns={3} />
      </SectionCard>
    );
  }

  // What was captured is shown against the schema it was captured with.
  const fields: RiskFieldDefinition[] = details?.schema_snapshot?.length
    ? details.schema_snapshot
    : (details?.fields ?? []);
  const general = [
    { label: 'Risk location', value: details?.risk_location || '—' },
    {
      label: 'Limit of liability',
      value:
        details?.limit_of_liability == null
          ? '—'
          : details.limit_of_liability.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            }),
    },
  ];

  return (
    <SectionCard
      title="Risk details"
      description={
        details?.updated_at
          ? `Last updated ${formatDateTime(details.updated_at)}`
          : 'No class-specific risk details were captured.'
      }
    >
      <div className="space-y-5">
        <KeyValueGrid items={general} />
        {groupRiskFields(fields).map((group) => (
          <div key={group.section} className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-800">
              {group.section}
            </h3>
            <KeyValueGrid
              items={group.fields.map((field) => ({
                label: field.label,
                value: formatRiskValue(
                  field,
                  details?.risk_data?.[field.field_key],
                ),
              }))}
            />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function QuotationDocumentsPanel({ quotationId }: { quotationId: string }) {
  const documents = useQuery({
    queryKey: quotationDocumentsKey(quotationId),
    queryFn: () => nonMotorApi.getQuotationDocuments(quotationId),
  });
  const items = documents.data ?? [];

  return (
    <SectionCard title="Documents">
      {documents.isLoading ? (
        <TableSkeleton rows={1} columns={3} />
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">No documents attached.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {items.map((document) => (
            <li
              key={document.id}
              className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="truncate">
                  {document.title || document.file_name}
                </span>
              </span>
              <span className="shrink-0 text-xs text-slate-500">
                {document.status.replace(/_/g, ' ').toLowerCase()} ·{' '}
                {formatDateTime(document.uploaded_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

/** Non-Motor quotation: risk details and documents, then the shared screen. */
export function NonMotorQuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const details = useQuery({
    queryKey: [...underwriteKeys.all, 'non-motor', 'risk-details', id ?? ''],
    queryFn: () => nonMotorApi.getRiskDetails(id!),
    enabled: Boolean(id),
  });

  return (
    <UnderwriteRecordGate kind="quotation">
      <div className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <RiskDetailsPanel
              details={details.data}
              loading={details.isLoading}
              error={details.error}
              onRetry={() => void details.refetch()}
            />
          </div>
          <QuotationDocumentsPanel quotationId={id!} />
        </div>
        <Suspense fallback={<TableSkeleton />}>
          <QuotationDetailPage />
        </Suspense>
      </div>
    </UnderwriteRecordGate>
  );
}

/** Non-Motor policy: the risk as quoted, then the shared policy screen. */
export function NonMotorPolicyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const details = useQuery({
    queryKey: [...underwriteKeys.all, 'non-motor', 'policy-risk', id ?? ''],
    queryFn: () => nonMotorApi.getPolicyRiskDetails(id!),
    enabled: Boolean(id),
  });

  return (
    <UnderwriteRecordGate kind="policy">
      <div className="space-y-5">
        <RiskDetailsPanel
          details={details.data}
          loading={details.isLoading}
          error={details.error}
          onRetry={() => void details.refetch()}
        />
        <Suspense fallback={<TableSkeleton />}>
          <PolicyDetailPage />
        </Suspense>
      </div>
    </UnderwriteRecordGate>
  );
}
