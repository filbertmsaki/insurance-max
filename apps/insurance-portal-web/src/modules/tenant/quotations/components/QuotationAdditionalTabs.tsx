import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import type { UnderwriteLineSlug } from '@insurance-max/contracts';
import { CoverNotesSection } from '@/modules/tenant/cover-notes/components/CoverNotesSection';
import { KeyValueGrid, SectionCard } from './QuotationDetailLayout';
import { QuotationHistoryPreview } from './QuotationPreviewSections';
import { useQuotationPolicies } from './useQuotationPolicies';
import {
  financePaths,
  useQuotationFinanceRecords,
} from './useQuotationFinanceRecords';
import {
  formatDateTime,
  formatMoney,
  humanizeCode,
} from '../utils/quotationFormat';
import type { QuotationPreviewRecord, QuotationWorkflowView } from '../types';
import { APPROVAL_HISTORY } from '../utils/quotationApproval';
import { PdfDocumentActions } from '@/modules/shared/documents/PdfDocumentActions';

export function QuotationApprovalTab({
  preview,
  workflow,
}: {
  preview: QuotationPreviewRecord;
  workflow?: QuotationWorkflowView;
}) {
  const approval = workflow?.approval;
  return (
    <>
      <SectionCard
        title="Approval"
        description="Available approval actions appear above the quotation tabs."
      >
        <KeyValueGrid
          items={[
            {
              label: 'Approval required',
              value: preview.overview.requires_approval ? 'Yes' : 'No',
            },
            {
              label: 'Status',
              value: humanizeCode(
                approval?.status ?? preview.overview.approval_status,
              ),
            },
            {
              label: 'Submitted',
              value: formatDateTime(approval?.submittedAt),
            },
            { label: 'Decision', value: formatDateTime(approval?.decidedAt) },
            {
              label: 'Approved by',
              value: preview.overview.approved_by?.name ?? null,
            },
            { label: 'Comments', value: approval?.comments || null },
            { label: 'Reason', value: approval?.reason || null },
          ]}
        />
      </SectionCard>
      <QuotationHistoryPreview
        title="Approval history"
        history={preview.history.filter((item) =>
          APPROVAL_HISTORY.test(item.action),
        )}
        showFilters={false}
      />
    </>
  );
}

function DocumentRow({
  title,
  meta,
  children,
}: {
  title: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <FileText
          className="mt-0.5 h-5 w-5 shrink-0 text-slate-400"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-slate-900 [overflow-wrap:anywhere]">
            {title}
          </p>
          {meta && <p className="mt-0.5 text-[13px] text-slate-500">{meta}</p>}
        </div>
      </div>
      {children}
    </li>
  );
}

export function QuotationDocumentsTab({
  preview,
  line,
}: {
  preview: QuotationPreviewRecord;
  line: UnderwriteLineSlug;
}) {
  const { policies, policyHref } = useQuotationPolicies(
    preview.overview.quotation_id,
    line,
    preview.overview.tira_status,
  );
  const { invoices, receipt } = useQuotationFinanceRecords(preview);
  const currency =
    preview.payment?.currency ?? preview.premium_summary.currency;

  return (
    <SectionCard
      title="Documents"
      description="Cover notes are listed under Policy & Cover Notes."
    >
      <ul className="divide-y divide-slate-100">
        <DocumentRow
          title={`Quotation · ${preview.overview.quotation_no}`}
          meta="Quotation PDF"
        >
          <PdfDocumentActions
            base={`/tenant/quotations/${preview.overview.quotation_id}/document`}
            number={preview.overview.quotation_no}
            noun="quotation"
            filePrefix="Quotation"
          />
        </DocumentRow>
        {policies?.map((policy) => (
          <DocumentRow
            key={`schedule-${policy.id}`}
            title={`Policy schedule · ${policy.policy_no}`}
            meta={
              <Link
                className="text-blue-700 hover:underline"
                to={policyHref(policy.id)}
              >
                Open policy
              </Link>
            }
          >
            <PdfDocumentActions
              base={`/tenant/policies/${policy.id}/schedule`}
              number={policy.policy_no}
              noun="policy schedule"
              filePrefix="Policy"
            />
          </DocumentRow>
        ))}
        {invoices.map((invoice) => (
          <DocumentRow
            key={`invoice-${invoice.id}`}
            title={`Invoice · ${invoice.invoice_no}`}
            meta={
              <>
                {humanizeCode(invoice.status)} ·{' '}
                {formatMoney(
                  Number(invoice.total_amount),
                  invoice.currency ?? invoice.currency_code ?? currency,
                )}{' '}
                ·{' '}
                <Link
                  className="text-blue-700 hover:underline"
                  to={financePaths.invoice(invoice.id)}
                >
                  Open invoice
                </Link>
              </>
            }
          >
            <PdfDocumentActions
              base={`/tenant/finance/invoices/${invoice.id}/document`}
              number={invoice.invoice_no}
              noun="tax invoice"
              filePrefix="Invoice"
            />
          </DocumentRow>
        ))}
        {receipt && (
          <DocumentRow
            title={`Receipt · ${receipt.receipt_no}`}
            meta={
              <>
                {humanizeCode(receipt.status)} ·{' '}
                {formatMoney(
                  Number(receipt.amount),
                  receipt.currency ?? receipt.currency_code ?? currency,
                )}{' '}
                ·{' '}
                <Link
                  className="text-blue-700 hover:underline"
                  to={financePaths.receipt(receipt.id)}
                >
                  Open receipt
                </Link>
              </>
            }
          >
            <PdfDocumentActions
              base={`/tenant/finance/receipts/${receipt.id}/document`}
              number={receipt.receipt_no}
              noun="receipt"
              filePrefix="Receipt"
            />
          </DocumentRow>
        )}
      </ul>
    </SectionCard>
  );
}

/**
 * Cover notes for the quotation. The issued policy number and its link sit in
 * the summary header, so they are not repeated here.
 */
export function QuotationPolicyTab({
  quotationId,
  issuanceStatus,
}: {
  quotationId: string;
  issuanceStatus?: string;
}) {
  return (
    <div className="min-w-0 p-4 sm:p-6">
      <CoverNotesSection
        quotationId={quotationId}
        tiraAccepted={issuanceStatus === 'SUCCESS'}
        hideHeader
      />
    </div>
  );
}
