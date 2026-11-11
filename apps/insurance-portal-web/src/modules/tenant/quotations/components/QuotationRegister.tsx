import type { ReactNode } from 'react';
import { useMemo } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Download, Pencil, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  UnderwriteAction,
  UnderwriteLine,
  underwritePermission,
} from '@insurance-max/contracts';
import {
  ListPage,
  humanizeStatus,
  paymentStateOf,
  registerColumns,
  statusTone,
  tiraStateOf,
  type Chip,
  type FilterDef,
  type ListQuery,
  type RecordKind,
  type RowAction,
} from '@/components/list-page';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import type { PaginatedWithSummary } from '@/modules/shared/api/pagination';
import {
  downloadPdf,
  documentFilename,
} from '@/modules/shared/documents/download-pdf';
import { formatMoney } from '@/modules/shared/formatting/number-format';
import { underwriteApi } from '@/modules/tenant/underwrite/api';
import { getUnderwriteLineMeta } from '@/modules/tenant/underwrite/lines';
import type { QuotationListItem, QuotationListParams } from '../types';
import { canEditQuotation } from '../utils/quotation-editability';

/*
 * Quotation register on the standard list page, shared by the Motor
 * Insurance and Non-Motor quotation lists.
 */

const QUOTATION_SUMMARY_CHIPS: Chip[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'expiring', label: 'Expiring soon' },
  { id: 'tira_failed', label: 'TIRA failed' },
  { id: 'drafts', label: 'Drafts' },
];

const STATUS_OPTIONS = [
  'DRAFT',
  'PENDING_REQUIREMENTS',
  'READY_FOR_SUBMISSION',
  'SUBMITTED_TO_TIRA',
  'TIRA_PROCESSING',
  'COMPLETED',
  'FAILED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
].map((value) => ({ value, label: humanizeStatus(value) }));

/** Grouped TIRA states, filtered on the server as `tira_state`. */
const TIRA_STATE_OPTIONS = [
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Pending' },
  { value: 'not_submitted', label: 'Not submitted' },
];

const FILTERS: FilterDef[] = [
  {
    kind: 'select',
    key: 'status',
    label: 'Status',
    allLabel: 'All statuses',
    options: STATUS_OPTIONS,
  },
  {
    kind: 'select',
    key: 'tira_state',
    label: 'TIRA status',
    allLabel: 'Any TIRA status',
    options: TIRA_STATE_OPTIONS,
  },
  {
    kind: 'date-range',
    fromKey: 'date_from',
    toKey: 'date_to',
    label: 'Date issued',
  },
];

function kindOf(row: QuotationListItem): RecordKind {
  if (row.quotation_flow === 'MOTOR_FLEET') return 'fleet';
  if (row.quotation_flow === 'NON_MOTOR') return 'non_motor';
  return 'single';
}

function lineOf(row: QuotationListItem, nonMotorLine?: UnderwriteLine) {
  if (row.quotation_flow === 'MOTOR_FLEET') return UnderwriteLine.FLEET;
  if (row.quotation_flow === 'NON_MOTOR') return nonMotorLine ?? null;
  return UnderwriteLine.MOTOR;
}

/** List query → quotation API params (ISO dates, server sort keys). */
function quotationListParams(query: ListQuery): QuotationListParams & {
  type?: string;
} {
  return {
    page: query.page,
    limit: query.limit,
    search: query.search,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    view: query.view,
    type: query.type,
    include_summary: true,
    ...query.filters,
  } as QuotationListParams & { type?: string };
}

export interface QuotationRegisterProps {
  title: string;
  description: string;
  breadcrumb: Array<{ label: string; href?: string }>;
  queryKey: QueryKey;
  stateKey: string;
  fetcher: (
    params: QuotationListParams & { type?: string },
    signal: AbortSignal,
  ) => Promise<PaginatedWithSummary<QuotationListItem>>;
  typeChips?: Chip[];
  detailHref: (id: string) => string;
  editHref: (id: string) => string;
  /** Line used for the Non-Motor register's rows (Motor rows use their flow). */
  nonMotorLine?: UnderwriteLine;
  /** The line's quotation wizard exists, so Edit can be offered. */
  canEditLine?: (line: UnderwriteLine) => boolean;
  primaryAction?: { label: string; onClick: () => void };
  headerExtras?: ReactNode;
}

export function QuotationRegister({
  title,
  description,
  breadcrumb,
  queryKey,
  stateKey,
  fetcher,
  typeChips,
  detailHref,
  editHref,
  nonMotorLine,
  canEditLine = () => true,
  primaryAction,
  headerExtras,
}: QuotationRegisterProps) {
  const navigate = useNavigate();
  const hasPermission = useAuthStore((state) => state.hasPermission);

  const register = useMemo(
    () =>
      registerColumns<QuotationListItem>({
        recordHeader: 'Quotation no.',
        record: (row) => row.quotation_no,
        kind: kindOf,
        recordSortKey: 'quotation_no',
        customer: (row) => ({
          name: row.customer_name || 'No customer',
          secondary: row.customer_phone || row.customer_id_number,
        }),
        customerSortKey: 'customer_name',
        issued: (row) => row.created_at,
        issuedSortKey: 'created_at',
        cover: (row) => ({
          start: row.cover_note_start_date,
          end: row.cover_note_end_date,
        }),
        coverSortKey: 'cover_note_start_date',
        status: (row) => ({
          label: row.display_label || humanizeStatus(row.display_status),
          tone: statusTone(row.display_status),
        }),
        statusSortKey: 'quotation_status',
        tira: (row) => ({
          state: tiraStateOf(row.tira_status),
          errorCode: row.tira_error_code,
          errorReason: row.tira_error_reason,
        }),
        amountHeader: 'Premium',
        amount: (row) => ({
          text: formatMoney(
            row.total_premium_including_tax,
            row.currency_code || 'TZS',
          ),
          payment: paymentStateOf(row.payment_status),
        }),
        amountSortKey: 'total_premium_including_tax',
      }),
    [],
  );

  const can = (
    line: UnderwriteLine | null,
    action: (typeof UnderwriteAction)[keyof typeof UnderwriteAction],
    permission: string,
  ) =>
    Boolean(line) &&
    hasPermission(underwritePermission(line!, action)) &&
    hasPermission(permission);

  const rowActions: RowAction<QuotationListItem>[] = [
    {
      label: 'Retry TIRA',
      icon: RotateCw,
      hidden: (row) =>
        tiraStateOf(row.tira_status) !== 'failed' ||
        !can(
          lineOf(row, nonMotorLine),
          UnderwriteAction.TIRA_RETRY,
          'quotations:retry-tiramis',
        ),
      onSelect: async (row, { updateRow }) => {
        const line = lineOf(row, nonMotorLine);
        const slug = line ? getUnderwriteLineMeta(line).slug : null;
        if (!slug) return;
        try {
          await underwriteApi.retryQuotationTira(slug, row.id);
          updateRow(row.id, {
            tira_status: 'SUBMITTING',
            tira_error_code: null,
            tira_error_reason: null,
          } as Partial<QuotationListItem>);
          toast.success(`TIRA submission retried for ${row.quotation_no}`);
        } catch (error) {
          toast.error(getApiErrorMessage(error));
        }
      },
    },
    {
      label: 'Download PDF',
      icon: Download,
      onSelect: (row) =>
        void downloadPdf(
          `/tenant/quotations/${row.id}/document/download`,
          documentFilename(row.quotation_no),
        ),
    },
    {
      label: 'Edit quotation',
      icon: Pencil,
      hidden: (row) => {
        const line = lineOf(row, nonMotorLine);
        return (
          !line ||
          !canEditLine(line) ||
          Boolean(row.source_policy_transaction_id) ||
          !canEditQuotation(row) ||
          !can(line, UnderwriteAction.EDIT, 'quotations:update')
        );
      },
      onSelect: (row) => navigate(editHref(row.id)),
    },
  ];

  return (
    <ListPage<QuotationListItem>
      entity="quotation"
      noun={{ one: 'quotation', many: 'quotations' }}
      title={title}
      description={description}
      breadcrumb={breadcrumb}
      primaryAction={primaryAction}
      headerExtras={headerExtras}
      queryKey={queryKey}
      stateKey={stateKey}
      fetchRows={async (query, signal) => {
        const page = await fetcher(quotationListParams(query), signal);
        return {
          rows: page.data,
          total: page.pagination.total,
          summary: page.summary,
        };
      }}
      summaryChips={QUOTATION_SUMMARY_CHIPS}
      typeChips={typeChips}
      filters={FILTERS}
      columns={register.columns}
      getAttention={register.getAttention}
      mobileRow={register.mobileRow}
      rowActions={rowActions}
      rowId={(row) => row.id}
      getRowHref={(row) => detailHref(row.id)}
      searchPlaceholder="Search quotation no., customer, phone, reg. or chassis no."
      defaultSort={{ key: 'created_at', order: 'DESC' }}
    />
  );
}
