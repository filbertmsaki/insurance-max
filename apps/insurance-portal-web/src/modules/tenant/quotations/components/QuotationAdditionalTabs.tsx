import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { UnderwriteLineSlug } from '@insurance-max/contracts';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/components/shared/detailFormat';
import {
  downloadPdf,
  documentFilename,
} from '@/modules/shared/documents/download-pdf';
import { CoverNotesSection } from '@/modules/tenant/cover-notes/components/CoverNotesSection';
import { underwriteApi } from '@/modules/tenant/underwrite/api';
import { underwritePaths } from '@/modules/tenant/underwrite/paths';
import { motorInsurancePaths } from '@/modules/tenant/motor-insurance/paths';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { getApiErrorMessage } from '@/lib/api-error';
import { SectionCard } from './QuotationDetailLayout';
import { QuotationHistoryPreview } from './QuotationPreviewSections';
import type { QuotationPreviewRecord, QuotationWorkflowView } from '../types';

export function QuotationApprovalTab({
  preview,
  workflow,
}: {
  preview: QuotationPreviewRecord;
  workflow?: QuotationWorkflowView;
}) {
  const approval = workflow?.approval;
  const facts = [
    ['Approval required', preview.overview.requires_approval ? 'Yes' : 'No'],
    [
      'Status',
      (approval?.status ?? preview.overview.approval_status).replace(/_/g, ' '),
    ],
    [
      'Submitted',
      approval?.submittedAt ? formatDate(approval.submittedAt) : '-',
    ],
    ['Decision', approval?.decidedAt ? formatDate(approval.decidedAt) : '-'],
    ['Comments', approval?.comments || '-'],
    ['Reason', approval?.reason || '-'],
  ];
  return (
    <>
      <SectionCard
        title="Approval"
        description="Available approval actions appear above the quotation tabs."
      >
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd className="mt-1 break-words text-sm">{value}</dd>
            </div>
          ))}
        </dl>
      </SectionCard>
      <QuotationHistoryPreview
        title="Approval history"
        history={preview.history.filter((item) =>
          /approv|reject|changes.requested|premium.changed/i.test(item.action),
        )}
      />
    </>
  );
}

export function QuotationDocumentsTab({
  preview,
}: {
  preview: QuotationPreviewRecord;
}) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <SectionCard title="Quotation documents">
        <Button
          variant="outline"
          disabled={downloading}
          onClick={async () => {
            setDownloading(true);
            setError(null);
            try {
              await downloadPdf(
                `/tenant/quotations/${preview.overview.quotation_id}/document/download`,
                documentFilename(preview.overview.quotation_no),
              );
            } catch (cause) {
              setError(getApiErrorMessage(cause));
            } finally {
              setDownloading(false);
            }
          }}
        >
          {downloading ? 'Downloading...' : 'Download quotation PDF'}
        </Button>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </SectionCard>
      <div className="min-w-0 p-4 sm:p-6">
        <CoverNotesSection
          quotationId={preview.overview.quotation_id}
          tiraAccepted={preview.overview.tira_status === 'SUCCESS'}
        />
      </div>
    </>
  );
}

export function QuotationPolicyTab({
  quotationId,
  line,
  issuanceStatus,
}: {
  quotationId: string;
  line: UnderwriteLineSlug;
  issuanceStatus?: string;
}) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canView =
    hasPermission('policies:read') &&
    hasPermission(`underwrite.${line}.policies.view`);
  const query = useQuery({
    queryKey: ['quotation-issued-policies', line, quotationId, issuanceStatus],
    queryFn: ({ signal }) =>
      underwriteApi.getPolicies(
        line,
        { quotation_id: quotationId, limit: 100 },
        signal,
      ),
    enabled: canView,
    // A final callback updates quotation status before the issuance transaction
    // finishes. Keep this visible tab current until that policy becomes available.
    refetchInterval: (query) =>
      issuanceStatus === 'SUCCESS' &&
      query.state.status !== 'error' &&
      !query.state.data?.data.length
        ? 5000
        : false,
  });
  return (
    <SectionCard title="Issued policy">
      {!canView ? (
        <p className="text-sm text-slate-500">
          You do not have permission to view policies.
        </p>
      ) : query.isPending ? (
        <p role="status">Loading policy...</p>
      ) : query.isError ? (
        <div role="alert">
          <p>Unable to load the issued policy.</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      ) : query.data?.data.length ? (
        <ul className="space-y-3">
          {query.data.data.map((policy) => (
            <li key={policy.id}>
              <Link
                className="text-sm font-medium text-primary underline"
                to={
                  line === 'motor' || line === 'fleet'
                    ? motorInsurancePaths.policyDetail(policy.id)
                    : underwritePaths.policyDetail(line, policy.id)
                }
              >
                {policy.policy_no}
              </Link>
              <p className="mt-1 text-xs text-slate-500">
                {policy.policy_status}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">
          No policy has been issued for this quotation yet.
        </p>
      )}
    </SectionCard>
  );
}
