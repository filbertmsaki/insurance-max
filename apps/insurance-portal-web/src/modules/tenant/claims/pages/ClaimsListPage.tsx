import { useNavigate, useParams } from 'react-router-dom';
import { Eye, Pencil, Plus, Search } from 'lucide-react';
import { ClaimsPermissions } from '@insurance-max/contracts';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
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
import { ClaimStatusBadge } from '../components/ClaimBadges';
import {
  CLAIM_STATUSES,
  CLAIM_STATUS_META,
  getClaimQueueMeta,
  type ClaimQueueMeta,
} from '../constants';
import { useClaimsList } from '../hooks';
import { claimsPaths } from '../paths';
import type { ClaimListItem } from '../types';
import { claimCustomerName, formatClaimDate, formatClaimMoney } from '../utils';

const EDITABLE = new Set(['DRAFT', 'NOTIFICATION_FAILED']);

function ClaimsList({ queue }: { queue: ClaimQueueMeta | null }) {
  const navigate = useNavigate();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canCreate = hasPermission(ClaimsPermissions.CREATE);
  const canEdit = hasPermission(ClaimsPermissions.UPDATE);
  const list = useClaimsList(queue?.queue);
  const statuses = queue?.statuses ?? CLAIM_STATUSES;

  const columns: Column<ClaimListItem>[] = [
    {
      key: 'claim_no',
      header: 'Claim',
      cell: (row) => (
        <div className="space-y-0.5">
          <span className="block font-medium text-slate-900">
            {row.claim_no}
          </span>
          <span className="block text-xs text-slate-500">
            {row.claim_reference_number
              ? `TIRA ${row.claim_reference_number}`
              : row.claim_notification_number}
          </span>
        </div>
      ),
    },
    {
      key: 'policy',
      header: 'Policy',
      hideOnMobile: true,
      cell: (row) => (
        <div className="space-y-0.5">
          <span className="block">{row.policy?.policy_no ?? '-'}</span>
          <span className="block text-xs text-slate-500">
            {row.cover_note_reference_number ?? ''}
          </span>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (row) => claimCustomerName(row.customer),
    },
    {
      key: 'loss',
      header: 'Loss',
      hideOnMobile: true,
      cell: (row) => (
        <div className="space-y-0.5">
          <span className="block">
            {row.loss_nature ?? row.loss_type ?? '-'}
          </span>
          <span className="block text-xs text-slate-500">
            {formatClaimDate(row.loss_date)}
          </span>
        </div>
      ),
    },
    {
      key: 'estimated_amount',
      header: 'Estimated',
      className: 'text-right',
      hideOnMobile: true,
      cell: (row) => (
        <span className="tabular-nums">
          {formatClaimMoney(row.estimated_amount, row.currency_code)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <ClaimStatusBadge status={row.status} />,
    },
    {
      key: 'branch',
      header: 'Branch',
      hideOnMobile: true,
      cell: (row) => row.branch?.name ?? '-',
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          {canEdit && EDITABLE.has(row.status) ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Edit ${row.claim_no}`}
              onClick={() => navigate(claimsPaths.edit(row.id))}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            aria-label={`View ${row.claim_no}`}
            onClick={() => navigate(claimsPaths.detail(row.id))}
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
        eyebrow="Claims"
        title={queue?.title ?? 'All claims'}
        description={
          queue?.description ??
          'Every claim case, from notification to settlement or rejection.'
        }
        action={
          canCreate ? (
            <Button onClick={() => navigate(claimsPaths.create)}>
              <Plus className="mr-2 h-4 w-4" />
              New claim
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="relative min-w-64 max-w-sm flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            aria-label="Search claims"
            placeholder="Claim, TIRA ref, policy, customer..."
            value={list.search}
            onChange={(event) => list.setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={list.filters.status || 'all'}
          onValueChange={(value) => list.setFilter('status', value)}
        >
          <SelectTrigger className="w-56" aria-label="Status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statuses.map((status) => (
              <SelectItem key={status} value={status}>
                {CLAIM_STATUS_META[status].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          From
          <Input
            type="date"
            className="w-40"
            value={list.filters.from}
            onChange={(event) => list.setFilter('from', event.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          To
          <Input
            type="date"
            className="w-40"
            value={list.filters.to}
            onChange={(event) => list.setFilter('to', event.target.value)}
          />
        </label>
      </div>

      <DataTable
        columns={columns}
        data={list.query.data?.data ?? []}
        loading={list.query.isLoading}
        error={list.query.error ? 'Unable to load claims' : undefined}
        onRetry={() => void list.query.refetch()}
        page={list.page}
        limit={list.limit}
        total={list.query.data?.pagination.total ?? 0}
        totalPages={list.query.data?.pagination.totalPages ?? 1}
        onPageChange={list.setPage}
        onLimitChange={list.setLimit}
        emptyMessage={
          queue
            ? `No claims in ${queue.label.toLowerCase()}`
            : 'No claims found'
        }
      />
    </div>
  );
}

export function ClaimsListPage() {
  return <ClaimsList queue={null} />;
}

/** One page for every stage menu; `:queue` selects the filtered view. */
export function ClaimQueuePage() {
  const { queue } = useParams<{ queue: string }>();
  const meta = getClaimQueueMeta(queue);

  if (!meta) {
    return (
      <p className="py-12 text-center text-sm text-slate-500">
        Unknown claim queue.
      </p>
    );
  }

  return <ClaimsList key={meta.queue} queue={meta} />;
}
