import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { DataTable, type Column } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { complaintsApi } from '../api';
import type { ComplaintRecord } from '../types';
import { complaintTone, formatComplaintDate } from '../utils';

export function ComplaintsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['complaints', 'list'],
    queryFn: complaintsApi.list,
  });

  const rows = useMemo(() => {
    const items = query.data ?? [];
    if (!search.trim()) return items;
    const term = search.trim().toLowerCase();
    return items.filter((item) =>
      [item.complaint_no, item.subject, item.category, item.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [query.data, search]);

  const columns: Column<ComplaintRecord>[] = [
    {
      key: 'complaint',
      header: 'Complaint',
      cell: (row) => (
        <div>
          <button
            className="font-medium text-slate-900 hover:text-blue-700"
            type="button"
            onClick={() => {
              navigate(`/complaints/${row.id}`);
            }}
          >
            {row.complaint_no}
          </button>
          <div className="text-sm text-slate-500">{row.subject}</div>
        </div>
      ),
    },
    { key: 'category', header: 'Category', cell: (row) => row.category },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <Badge variant="outline" className={complaintTone(row.status)}>
          {row.status}
        </Badge>
      ),
    },
    { key: 'priority', header: 'Priority', cell: (row) => row.priority },
    {
      key: 'due',
      header: 'Resolution Due',
      cell: (row) => formatComplaintDate(row.resolution_due_at),
    },
    {
      key: 'actions',
      header: '',
      cell: (row) => (
        <Button
          aria-label="Open complaint"
          size="icon"
          variant="ghost"
          onClick={() => {
            navigate(`/complaints/${row.id}`);
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
        eyebrow="Complaints"
        title="Complaint Workbench"
        description="Manage acknowledgements, assignments, resolution, escalation, appeals, and customer-visible comments."
      />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          className="pl-9"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search complaint, category, subject, status"
        />
      </div>
      {query.isLoading ? (
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
