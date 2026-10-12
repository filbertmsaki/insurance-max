import { useNavigate } from 'react-router-dom';
import { Eye, Pencil, Plus, Search } from 'lucide-react';
import {
  UnderwriteAction,
  underwritePermission,
} from '@insurance-max/contracts';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { formatMoney } from '@/modules/shared/formatting/number-format';
import { QuotationStatusBadge } from '@/modules/tenant/quotations/components/QuotationStatusBadge';
import { TiraStatusBadge } from '@/modules/tenant/quotations/components/TiraStatusBadge';
import type { QuotationListItem } from '@/modules/tenant/quotations/types';
import { formatCoverPeriod } from '@/modules/tenant/quotations/utils/coverPeriod';
import { useUnderwriteLineParam, useUnderwriteQuotations } from '../hooks';
import type { UnderwriteLineMeta } from '../lines';
import { underwritePaths } from '../paths';
import { canEditQuotation } from '@/modules/tenant/quotations/utils/quotation-editability';

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
] as const;

function lineColumns(line: UnderwriteLineMeta): Column<QuotationListItem>[] {
  if (line.line === 'MOTOR') {
    return [
      {
        key: 'vehicle_registration_number',
        header: 'Reg No.',
        hideOnMobile: true,
        cell: (row) => row.vehicle_registration_number || 'N/A',
      },
    ];
  }
  if (line.line === 'FLEET') {
    return [
      {
        key: 'fleet_id',
        header: 'Fleet ID',
        hideOnMobile: true,
        cell: (row) => row.fleet_id || 'N/A',
      },
    ];
  }
  return [];
}

function QuotationsList({ line }: { line: UnderwriteLineMeta }) {
  const navigate = useNavigate();
  const {
    query,
    page,
    limit,
    search,
    status,
    setSearch,
    setFilter,
    setPage,
    setLimit,
  } = useUnderwriteQuotations(line.slug);
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canCreate =
    line.hasWizard &&
    hasPermission(underwritePermission(line.line, UnderwriteAction.CREATE)) &&
    hasPermission('quotations:create');
  const canEdit =
    line.hasWizard &&
    hasPermission(underwritePermission(line.line, UnderwriteAction.EDIT)) &&
    hasPermission('quotations:update');

  const columns: Column<QuotationListItem>[] = [
    {
      key: 'quotation_no',
      header: 'Quotation No.',
      cell: (row) => (
        <div className="space-y-1">
          <span className="block font-medium text-slate-900">
            {row.quotation_no}
          </span>
          {row.source_policy_transaction_id ? (
            <Badge variant="secondary" className="text-[11px]">
              Policy transaction
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: 'customer_name',
      header: 'Customer',
      cell: (row) => row.customer_name || 'N/A',
    },
    ...lineColumns(line),
    {
      key: 'product_name',
      header: 'Product',
      hideOnMobile: true,
      cell: (row) => row.product_name || row.product_code,
    },
    {
      key: 'cover_period',
      header: 'Cover Period',
      hideOnMobile: true,
      cell: (row) =>
        formatCoverPeriod(row.cover_note_start_date, row.cover_note_end_date),
    },
    {
      key: 'total_premium_including_tax',
      header: 'Premium',
      className: 'text-right',
      cell: (row) => (
        <span className="tabular-nums">
          {formatMoney(
            Number.isFinite(row.total_premium_including_tax)
              ? row.total_premium_including_tax
              : 0,
            row.currency_code,
          )}
        </span>
      ),
    },
    {
      key: 'quotation_status',
      header: 'Status',
      cell: (row) => <QuotationStatusBadge status={row.display_status} />,
    },
    {
      key: 'tira_status',
      header: 'TIRA',
      hideOnMobile: true,
      cell: (row) => <TiraStatusBadge status={row.tira_status} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          {canEdit &&
            !row.source_policy_transaction_id &&
            canEditQuotation(row) && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Edit ${row.quotation_no}`}
                onClick={() =>
                  navigate(underwritePaths.quotationEdit(line.slug, row.id))
                }
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          <Button
            variant="ghost"
            size="icon"
            aria-label={`View ${row.quotation_no}`}
            onClick={() =>
              navigate(underwritePaths.quotationDetail(line.slug, row.id))
            }
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={`Underwrite · ${line.label}`}
        title={`${line.label} quotations`}
        description={line.description}
        action={
          canCreate ? (
            <Button
              onClick={() =>
                navigate(underwritePaths.quotationCreate(line.slug))
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              New quotation
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-64 max-w-sm flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search quotations..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => setFilter('status', value)}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={query.data?.data ?? []}
        loading={query.isLoading}
        error={query.error ? 'Unable to load quotations' : undefined}
        onRetry={() => void query.refetch()}
        page={page}
        limit={limit}
        total={query.data?.pagination.total ?? 0}
        totalPages={query.data?.pagination.totalPages ?? 1}
        onPageChange={setPage}
        onLimitChange={setLimit}
        emptyMessage={`No ${line.label.toLowerCase()} quotations found`}
      />
    </div>
  );
}

export function UnderwriteQuotationsPage() {
  const line = useUnderwriteLineParam();
  return line ? <QuotationsList key={line.slug} line={line} /> : null;
}
