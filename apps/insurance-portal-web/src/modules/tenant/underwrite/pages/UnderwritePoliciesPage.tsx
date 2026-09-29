import { useNavigate } from 'react-router-dom';
import { Eye, Search } from 'lucide-react';
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
import { formatDate, formatMoney } from '@/components/shared/detailFormat';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';
import { PolicyStatusBadge } from '@/modules/tenant/policies/components/PolicyStatusBadge';
import type { PolicyRecord } from '@/modules/tenant/policies/types';
import { useUnderwriteLineParam, useUnderwritePolicies } from '../hooks';
import type { UnderwriteLineMeta } from '../lines';
import { underwritePaths } from '../paths';

const POLICY_STATUS_OPTIONS = [
  'COVER_NOTE_ISSUED',
  'ACTIVE',
  'ENDORSED',
  'CANCELLED',
  'EXPIRED',
  'LAPSED',
] as const;

function PoliciesList({ line }: { line: UnderwriteLineMeta }) {
  const navigate = useNavigate();
  const {
    query,
    page,
    limit,
    search,
    policyStatus,
    setSearch,
    setFilter,
    setPage,
    setLimit,
  } = useUnderwritePolicies(line.slug);

  const columns: Column<PolicyRecord>[] = [
    {
      key: 'policy_no',
      header: 'Policy No.',
      cell: (row) => (
        <span className="font-medium text-slate-900">{row.policy_no}</span>
      ),
    },
    {
      key: 'cover_note_no',
      header: 'Cover Note',
      hideOnMobile: true,
      cell: (row) => row.cover_note_no || 'N/A',
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (row) =>
        row.customer ? getCustomerDisplayName(row.customer) : row.customer_id,
    },
    {
      key: 'product',
      header: 'Product',
      hideOnMobile: true,
      cell: (row) => row.product?.product_name ?? row.product_id,
    },
    {
      key: 'period',
      header: 'Cover Period',
      hideOnMobile: true,
      cell: (row) =>
        `${formatDate(row.start_date)} – ${formatDate(row.end_date)}`,
    },
    {
      key: 'premium',
      header: 'Premium',
      className: 'text-right',
      cell: (row) => (
        <span className="tabular-nums">
          {formatMoney(Number(row.total_premium), row.currency)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <PolicyStatusBadge status={row.policy_status} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (row) => (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`View ${row.policy_no}`}
          onClick={() =>
            navigate(underwritePaths.policyDetail(line.slug, row.id))
          }
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={`Underwrite · ${line.label}`}
        title={`${line.label} policies`}
        description={line.description}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-64 max-w-sm flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search policies..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={policyStatus}
          onValueChange={(value) => setFilter('policy_status', value)}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {POLICY_STATUS_OPTIONS.map((option) => (
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
        error={query.error ? 'Unable to load policies' : undefined}
        onRetry={() => void query.refetch()}
        page={page}
        limit={limit}
        total={query.data?.pagination.total ?? 0}
        totalPages={query.data?.pagination.totalPages ?? 1}
        onPageChange={setPage}
        onLimitChange={setLimit}
        emptyMessage={`No ${line.label.toLowerCase()} policies found`}
      />
    </div>
  );
}

export function UnderwritePoliciesPage() {
  const line = useUnderwriteLineParam();
  return line ? <PoliciesList key={line.slug} line={line} /> : null;
}
