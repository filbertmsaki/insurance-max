import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useDeleteSubjectMatter, useSubjectMattersList } from '../hooks';
import { SubjectMatterStatusBadge } from '../components/SubjectMatterStatusBadge';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';
import type { SubjectMatterRecord } from '../types';

export function SubjectMattersPage() {
  const navigate = useNavigate();
  const { data, isLoading, page, limit, search, setSearch, setPage, setLimit } =
    useSubjectMattersList();
  const deleteMutation = useDeleteSubjectMatter();
  const [deleteItem, setDeleteItem] = useState<SubjectMatterRecord | null>(
    null,
  );

  const subjectMatters = data?.data ?? [];
  const total = data?.pagination.total ?? 0;
  const totalPages = data?.pagination.totalPages ?? 0;

  const columns: Column<SubjectMatterRecord>[] = [
    {
      key: 'subject_code',
      header: 'Subject Matter',
      cell: (row) => (
        <div>
          <p className="font-medium text-slate-900">
            {row.subject_code ?? row.id}
          </p>
          <p className="text-xs text-slate-400">
            {row.subject_type ?? 'Unspecified type'}
          </p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (row) => (
        <span className="text-sm text-slate-600">
          {row.customer
            ? getCustomerDisplayName(row.customer)
            : row.customer_id}
        </span>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      cell: (row) => (
        <span className="text-sm text-slate-600">
          {row.currency} {row.value}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <SubjectMatterStatusBadge status={row.status} />,
    },
    {
      key: 'created_at',
      header: 'Created',
      cell: (row) => (
        <span className="text-sm text-slate-500">
          {new Date(row.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (row) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              navigate(`/underwrite/non-motor/risks/${row.id}`)
            }
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              navigate(`/underwrite/non-motor/risks/${row.id}/edit`)
            }
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteItem(row)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Subject Matters"
        description="Reference data for non-motor risks (Fire, Marine, Engineering, Liability, etc.)"
        action={
          <Button
            onClick={() =>
              navigate('/underwrite/non-motor/risks/new')
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Subject Matter
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1 min-w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search subject matters..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={subjectMatters}
        loading={isLoading}
        page={page}
        limit={limit}
        total={total}
        totalPages={totalPages}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <ConfirmDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        title="Delete Subject Matter"
        description="This will soft-delete the subject matter."
        confirmLabel="Delete Subject Matter"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteItem) {
            deleteMutation.mutate(deleteItem.id, {
              onSuccess: () => setDeleteItem(null),
            });
          }
        }}
      />
    </div>
  );
}
