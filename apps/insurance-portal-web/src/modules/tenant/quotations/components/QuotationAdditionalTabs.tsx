import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { UnderwriteLineSlug } from '@insurance-max/contracts';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/components/shared/detailFormat';
import {
  downloadPdf,
  fetchPdfBlob,
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

/**
 * Quotation document actions. Preview, print and open all use the same
 * server-rendered PDF as the download, so what users see is what they send.
 */
function QuotationDocumentActions({
  quotationId,
  quotationNo,
}: {
  quotationId: string;
  quotationNo: string;
}) {
  const [busy, setBusy] = useState<
    'preview' | 'download' | 'print' | 'open' | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const base = `/tenant/quotations/${quotationId}/document`;

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const run = async (
    action: NonNullable<typeof busy>,
    task: () => Promise<void>,
  ) => {
    setBusy(action);
    setError(null);
    try {
      await task();
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  const ensurePreviewUrl = async () => {
    if (previewUrl) return previewUrl;
    const url = URL.createObjectURL(await fetchPdfBlob(`${base}/preview`));
    setPreviewUrl(url);
    return url;
  };

  return (
    <SectionCard title="Quotation document">
      <p className="mb-4 text-sm text-muted-foreground">
        Official A4 quotation with policyholder, risk, coverage, premium and
        terms. Preview, print and download all use the same document.
      </p>
      <div
        className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
        role="group"
        aria-label="Quotation document actions"
      >
        <Button
          variant="outline"
          disabled={busy !== null}
          aria-expanded={!!previewUrl}
          onClick={() =>
            previewUrl
              ? setPreviewUrl(null)
              : run('preview', async () => void (await ensurePreviewUrl()))
          }
        >
          {busy === 'preview'
            ? 'Loading preview...'
            : previewUrl
              ? 'Hide preview'
              : 'Preview quotation'}
        </Button>
        <Button
          variant="outline"
          disabled={busy !== null}
          onClick={() =>
            run('download', () =>
              downloadPdf(`${base}/download`, documentFilename(quotationNo)),
            )
          }
        >
          {busy === 'download' ? 'Downloading...' : 'Download quotation PDF'}
        </Button>
        <Button
          variant="outline"
          disabled={busy !== null}
          onClick={() =>
            run('print', async () => {
              const url = await ensurePreviewUrl();
              const frame = frameRef.current;
              if (!frame) return;
              // Print from a hidden frame so the PDF viewer's print dialog opens.
              frame.onload = () => frame.contentWindow?.print();
              if (frame.src === url) frame.contentWindow?.print();
              else frame.src = url;
            })
          }
        >
          {busy === 'print' ? 'Preparing...' : 'Print'}
        </Button>
        <Button
          variant="outline"
          disabled={busy !== null}
          onClick={() =>
            run('open', async () => {
              // Mobile browsers rarely render PDFs inline; open in a new tab.
              window.open(await ensurePreviewUrl(), '_blank', 'noopener');
            })
          }
        >
          Open in new tab
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {previewUrl && (
        <div className="mt-4 overflow-hidden rounded-md border bg-muted">
          <iframe
            title={`Quotation ${quotationNo} preview`}
            src={previewUrl}
            className="block h-[70vh] min-h-[420px] w-full"
          />
        </div>
      )}
      <iframe
        ref={frameRef}
        title="Quotation print frame"
        aria-hidden="true"
        tabIndex={-1}
        className="hidden"
      />
    </SectionCard>
  );
}

export function QuotationDocumentsTab({
  preview,
}: {
  preview: QuotationPreviewRecord;
}) {
  return (
    <>
      <QuotationDocumentActions
        quotationId={preview.overview.quotation_id}
        quotationNo={preview.overview.quotation_no}
      />
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
