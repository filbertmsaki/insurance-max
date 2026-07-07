import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { useAllFactors } from '@/modules/tenant/product-engine/hooks';
import { useNonMotorCustomers } from '../hooks';
import { SubjectMatterForm } from '../components/SubjectMatterForm';
import { SubjectMatterFactorValueForm } from '../components/SubjectMatterFactorValueForm';
import { SubjectMatterStatusBadge } from '../components/SubjectMatterStatusBadge';
import {
  subjectMatterRecordToFormValues,
} from '../schemas';
import {
  useCreateSubjectMatterFactorValue,
  useDeleteSubjectMatter,
  useSubjectMatter,
  useSubjectMatterFactorValues,
  useUpdateSubjectMatter,
} from '../hooks';
import type { SubjectMatterFactorValueRecord } from '../types';

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-start gap-3">
      <span className="min-w-36 text-sm text-slate-500">{label}</span>
      <span className="text-sm text-slate-900">{value ?? ' - '}</span>
    </div>
  );
}

export function SubjectMatterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();
  const canUpdate = hasPermission('non-motor:update');
  const canDelete = hasPermission('non-motor:delete');
  const canCreate = hasPermission('non-motor:create');
  const { data: subjectMatter, isLoading } = useSubjectMatter(id);
  const { data: customers = [] } = useNonMotorCustomers();
  const { data: factors = [] } = useAllFactors();
  const { data: factorValues = [] } = useSubjectMatterFactorValues(id);
  const updateMutation = useUpdateSubjectMatter(id);
  const deleteMutation = useDeleteSubjectMatter();
  const createFactorValueMutation = useCreateSubjectMatterFactorValue();
  const [editOpen, setEditOpen] = useState(false);
  const [addValueOpen, setAddValueOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const columns: Column<SubjectMatterFactorValueRecord>[] = useMemo(() => [
    { key: 'factor', header: 'Factor', cell: (row) => row.factor?.name ?? row.factor_id },
    {
      key: 'value',
      header: 'Value',
      cell: (row) =>
        row.value_text ??
        row.value_number ??
        row.value_date ??
        (row.value_boolean === null ? null : String(row.value_boolean)) ??
        (row.value_json ? JSON.stringify(row.value_json) : ' - '),
    },
    { key: 'created_at', header: 'Created', cell: (row) => new Date(row.created_at).toLocaleString() },
  ], []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    );
  }

  if (!subjectMatter) {
    return (
      <div className="text-center py-24 text-slate-500">
        <p className="font-medium">Subject matter not found</p>
        <Button variant="link" onClick={() => navigate('/non-motor/subject-matters')}>Back to Subject Matters</Button>
      </div>
    );
  }

  const defaultValues = subjectMatterRecordToFormValues(subjectMatter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/non-motor/subject-matters')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{subjectMatter.subject_code}</h1>
              <SubjectMatterStatusBadge status={subjectMatter.status} />
            </div>
            <p className="text-sm text-slate-500">{subjectMatter.customer?.company_name ?? subjectMatter.customer_id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {canCreate && (
            <Button variant="outline" size="sm" onClick={() => setAddValueOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Factor Value
            </Button>
          )}
          {canUpdate && (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
          )}
          {canDelete && (
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label="Customer" value={subjectMatter.customer?.company_name ?? subjectMatter.customer_id} />
          <Row label="Type" value={subjectMatter.subject_type} />
          <Row label="Description" value={subjectMatter.description} />
          <Row label="Location" value={subjectMatter.location} />
          <Row label="Country" value={subjectMatter.country} />
          <Row label="Region" value={subjectMatter.region} />
          <Row label="District" value={subjectMatter.district} />
          <Row label="Ward" value={subjectMatter.ward} />
          <Row label="Coordinates" value={[subjectMatter.latitude, subjectMatter.longitude].filter(Boolean).join(', ')} />
          <Row label="Value" value={`${subjectMatter.currency} ${subjectMatter.value}`} />
          <Row label="Created At" value={subjectMatter.created_at} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Factor Values</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={factorValues}
            loading={false}
            page={1}
            limit={factorValues.length || 1}
            total={factorValues.length}
            totalPages={1}
            onPageChange={() => undefined}
            onLimitChange={() => undefined}
          />
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Subject Matter</DialogTitle>
          </DialogHeader>
          {canUpdate && (
            <SubjectMatterForm
              customers={customers}
              isPending={updateMutation.isPending}
              submitLabel="Save Changes"
              defaultValues={defaultValues}
              onSubmit={(values) => {
                updateMutation.mutate(values, {
                  onSuccess: () => setEditOpen(false),
                });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={addValueOpen} onOpenChange={setAddValueOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Factor Value</DialogTitle>
          </DialogHeader>
          {canCreate && (
            <SubjectMatterFactorValueForm
              subjectMatterId={subjectMatter.id}
              factors={factors}
              isPending={createFactorValueMutation.isPending}
              submitLabel="Create Factor Value"
              onSubmit={(values) => {
                createFactorValueMutation.mutate(values, {
                  onSuccess: () => setAddValueOpen(false),
                });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Subject Matter"
        description="This will soft-delete the subject matter record."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(subjectMatter.id, { onSuccess: () => navigate('/non-motor/subject-matters') })}
      />
    </div>
  );
}
