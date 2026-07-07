import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { useNonMotorCustomers } from '../hooks';
import { SubjectMatterForm } from '../components/SubjectMatterForm';
import { SubjectMatterStatusBadge } from '../components/SubjectMatterStatusBadge';
import { subjectMatterRecordToFormValues } from '../schemas';
import { useCreateSubjectMatter, useDeleteSubjectMatter, useSubjectMattersList, useUpdateSubjectMatter } from '../hooks';
import type { SubjectMatterRecord } from '../types';

export function SubjectMattersPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();
  const canCreate = hasPermission('non-motor:create');
  const canUpdate = hasPermission('non-motor:update');
  const canDelete = hasPermission('non-motor:delete');
  const { data: customers = [] } = useNonMotorCustomers();
  const { data, isLoading, page, limit, search, setSearch, setPage, setLimit } = useSubjectMattersList();
  const createMutation = useCreateSubjectMatter();
  const updateMutation = useUpdateSubjectMatter();
  const deleteMutation = useDeleteSubjectMatter();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectMatterRecord | null>(null);
  const [deleteItem, setDeleteItem] = useState<SubjectMatterRecord | null>(null);

  const subjectMatters = data?.data ?? [];
  const pagination = data?.pagination;

  const columns: Column<SubjectMatterRecord>[] = [
    { key: 'subject_code', header: 'Code', cell: (row) => row.subject_code },
    { key: 'customer', header: 'Customer', cell: (row) => row.customer?.company_name ?? row.customer_id },
    { key: 'subject_type', header: 'Type', cell: (row) => row.subject_type ?? ' - ' },
    { key: 'location', header: 'Location', cell: (row) => row.location ?? ' - ' },
    { key: 'value', header: 'Value', cell: (row) => `${row.currency} ${row.value}` },
    { key: 'status', header: 'Status', cell: (row) => <SubjectMatterStatusBadge status={row.status} /> },
        {
          key: 'actions',
          header: '',
          className: 'w-24',
          cell: (row) => (
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="icon" onClick={() => navigate(`/underwriting/non-motor/subject-matters/${row.id}`)}>
                <Search className="h-4 w-4" />
              </Button>
              {canUpdate && (
                <Button variant="ghost" size="icon" onClick={() => setEditing(row)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {canDelete && (
                <Button variant="ghost" size="icon" onClick={() => setDeleteItem(row)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ),
        },
  ];

  const defaultValues = useMemo(
    () => (editing ? subjectMatterRecordToFormValues(editing) : undefined),
    [editing],
  );

  return (
    <div>
      <PageHeader
        title="Non-Motor Subject Matters"
        description="Manage non-motor subject matter records and factor values"
        action={canCreate ? (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Create Subject Matter
          </Button>
        ) : undefined}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1 min-w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search subject matters..." className="pl-9" />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={subjectMatters}
        loading={isLoading}
        page={pagination?.page ?? page}
        limit={pagination?.limit ?? limit}
        total={pagination?.total ?? subjectMatters.length}
        totalPages={pagination?.totalPages ?? 1}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Dialog open={dialogOpen || !!editing} onOpenChange={(open) => {
        if (!open) {
          setDialogOpen(false);
          setEditing(null);
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Subject Matter' : 'Create Subject Matter'}</DialogTitle>
          </DialogHeader>
          {(editing ? canUpdate : canCreate) && (
            <SubjectMatterForm
              customers={customers}
              isPending={editing ? updateMutation.isPending : createMutation.isPending}
              submitLabel={editing ? 'Save Changes' : 'Create Subject Matter'}
              defaultValues={defaultValues}
              onSubmit={(values) => {
                const mutation = editing ? updateMutation : createMutation;
                mutation.mutate(values, {
                  onSuccess: (result) => {
                    setDialogOpen(false);
                    setEditing(null);
                    navigate(`/underwriting/non-motor/subject-matters/${result.id}`);
                  },
                });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        title="Delete Subject Matter"
        description="This will soft-delete the subject matter record."
        confirmLabel="Delete"
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
