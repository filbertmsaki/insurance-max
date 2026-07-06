import { useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2, RotateCcw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { motorApi } from '../api';
import {
  useCreateMotorPolicyDetail,
  useDeleteMotorPolicyDetail,
  useMotorPolicies,
  useMotorPolicyDetails,
  useRestoreMotorPolicyDetail,
  useUpdateMotorPolicyDetail,
} from '../hooks';
import { MotorPolicyDetailForm } from '../components/MotorPolicyDetailForm';
import { MotorStatusBadge } from '../components/MotorStatusBadge';
import { type MotorPolicyDetailRecord } from '../types';

export function MotorPolicyDetailsPage() {
  const { data: policyOptions = [] } = useMotorPolicies();
  const { data: vehiclePage } = useQuery({
    queryKey: ['motor', 'vehicle-options'],
    queryFn: async () => (await motorApi.getVehicles({ page: 1, limit: 1000 })).data,
    staleTime: 60_000,
  });
  const vehicleOptions = vehiclePage ?? [];
  const [selectedPolicyId, setSelectedPolicyId] = useState('all');
  const { data: details = [], isLoading } = useMotorPolicyDetails(
    selectedPolicyId === 'all' ? undefined : selectedPolicyId,
  );
  const createMutation = useCreateMotorPolicyDetail();
  const updateMutation = useUpdateMotorPolicyDetail();
  const deleteMutation = useDeleteMotorPolicyDetail();
  const restoreMutation = useRestoreMotorPolicyDetail();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MotorPolicyDetailRecord | null>(null);
  const [deleteItem, setDeleteItem] = useState<MotorPolicyDetailRecord | null>(null);
  const [restoreItem, setRestoreItem] = useState<MotorPolicyDetailRecord | null>(null);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return details.filter((item) =>
      !term ||
      [item.cover_type, item.usage_type, item.certificate_no, item.sticker_no, item.policy?.policy_no, item.motor_vehicle?.registration_no]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [details, search]);

  const columns: Column<MotorPolicyDetailRecord>[] = [
    { key: 'policy', header: 'Policy', cell: (row) => row.policy?.policy_no ?? row.policy_id },
    { key: 'vehicle', header: 'Vehicle', cell: (row) => row.motor_vehicle?.registration_no ?? row.motor_vehicle_id },
    { key: 'policy_risk_id', header: 'Risk ID', cell: (row) => row.policy_risk_id },
    { key: 'status', header: 'Status', cell: (row) => <MotorStatusBadge status={row.deleted_at ? 'INACTIVE' : 'ACTIVE'} /> },
    { key: 'created_at', header: 'Created', cell: (row) => new Date(row.created_at).toLocaleDateString() },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => setEditing(row)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteItem(row)}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setRestoreItem(row)}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Motor Policy Details"
        description="Link motor vehicles to policy risks"
        action={
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Create Detail
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1 min-w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input placeholder="Search details..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={selectedPolicyId} onValueChange={setSelectedPolicyId}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Policy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Policies</SelectItem>
            {policyOptions.map((policy) => (
              <SelectItem key={policy.id} value={policy.id}>
                {policy.policy_no} ({policy.policy_status})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={isLoading}
        page={1}
        limit={filtered.length || 1}
        total={filtered.length}
        totalPages={1}
        onPageChange={() => undefined}
        onLimitChange={() => undefined}
      />

      <Dialog
        open={dialogOpen || !!editing}
        onOpenChange={(open) => {
          if (!open) {
            setDialogOpen(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Motor Policy Detail' : 'Create Motor Policy Detail'}</DialogTitle>
          </DialogHeader>
          <MotorPolicyDetailForm
            key={editing?.id ?? 'new'}
            policyOptions={policyOptions}
            vehicleOptions={vehicleOptions}
            isPending={editing ? updateMutation.isPending : createMutation.isPending}
            submitLabel={editing ? 'Save Changes' : 'Create Detail'}
            defaultValues={editing ?? undefined}
            onSubmit={(values) => {
              const mutation = editing ? updateMutation : createMutation;
              mutation.mutate(values, {
                onSuccess: () => {
                  setDialogOpen(false);
                  setEditing(null);
                },
              });
            }}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        title="Delete Detail"
        description="This will soft-delete the motor policy detail."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteItem && deleteMutation.mutate(deleteItem.id, { onSuccess: () => setDeleteItem(null) })}
      />

      <ConfirmDialog
        open={!!restoreItem}
        onOpenChange={(open) => !open && setRestoreItem(null)}
        title="Restore Detail"
        description="This will restore the motor policy detail."
        confirmLabel="Restore"
        loading={restoreMutation.isPending}
        onConfirm={() => restoreItem && restoreMutation.mutate(restoreItem.id, { onSuccess: () => setRestoreItem(null) })}
      />
    </div>
  );
}
