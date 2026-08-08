import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, RefreshCcw, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { DataTable, type Column } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
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
import { Skeleton } from '@/components/ui/skeleton';
import { claimsApi } from '../api';
import type { ClaimRecord } from '../types';
import {
  claimCustomerName,
  claimTone,
  claimUserName,
  formatClaimDate,
  formatClaimMoney,
} from '../utils';

const STATUS_OPTIONS = [
  'all',
  'NOTIFIED',
  'OPEN',
  'IN_REVIEW',
  'APPROVED',
  'REJECTED',
  'CLOSED',
];

export function ClaimsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const claimsQuery = useQuery({
    queryKey: ['claims', 'list', status],
    queryFn: () =>
      claimsApi.list({
        limit: 100,
        status: status === 'all' ? undefined : status,
      }),
  });

  const rows = useMemo(() => {
    const items = claimsQuery.data?.data ?? [];
    if (!search.trim()) return items;
    const term = search.trim().toLowerCase();
    return items.filter((item) =>
      [
        item.claim_no,
        item.claim_notification_number,
        item.status,
        item.loss_nature,
        item.loss_type,
        item.policy?.policy_no,
        claimCustomerName(item.customer),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [claimsQuery.data, search]);

  const columns: Column<ClaimRecord>[] = [
    {
      key: 'claim',
      header: 'Claim',
      cell: (row) => (
        <div>
          <button
            className="font-medium text-slate-900 hover:text-blue-700"
            onClick={() => {
              navigate(`/claims/${row.id}`);
            }}
            type="button"
          >
            {row.claim_no}
          </button>
          <div className="text-sm text-slate-500">
            {row.policy?.policy_no ?? row.claim_notification_number ?? '-'}
          </div>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (row) => claimCustomerName(row.customer),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <div className="space-y-1">
          <Badge variant="outline" className={claimTone(row.status)}>
            {row.status}
          </Badge>
          {row.claim_stage && (
            <div className="text-xs text-slate-500">{row.claim_stage}</div>
          )}
        </div>
      ),
    },
    {
      key: 'loss',
      header: 'Loss',
      cell: (row) => (
        <div>
          <div>{row.loss_nature ?? row.loss_type ?? '-'}</div>
          <div className="text-sm text-slate-500">
            {formatClaimDate(row.loss_date)}
          </div>
        </div>
      ),
    },
    {
      key: 'reserve',
      header: 'Reserve',
      cell: (row) =>
        formatClaimMoney(row.outstanding_reserve, row.currency_code ?? 'TZS'),
    },
    {
      key: 'assigned',
      header: 'Assigned',
      cell: (row) => claimUserName(row.assigned_user),
    },
    {
      key: 'actions',
      header: '',
      cell: (row) => (
        <Button
          aria-label="Open claim"
          size="icon"
          variant="ghost"
          onClick={() => {
            navigate(`/claims/${row.id}`);
          }}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Claims"
        title="Claims Register"
        description="Track notified losses, reserves, assessments, payments, recoveries, and regulator submissions."
        action={
          <Button
            variant="outline"
            onClick={() => {
              void claimsQuery.refetch();
            }}
            disabled={claimsQuery.isFetching}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search claim, policy, customer, loss type"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((item) => (
              <SelectItem key={item} value={item}>
                {item === 'all' ? 'All statuses' : item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {claimsQuery.isLoading ? (
        <Skeleton className="h-[520px] w-full" />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          page={1}
          limit={rows.length || 1}
          total={rows.length}
          totalPages={1}
          onPageChange={() => undefined}
          onLimitChange={() => undefined}
          showColumnVisibility={false}
        />
      )}
    </div>
  );
}
