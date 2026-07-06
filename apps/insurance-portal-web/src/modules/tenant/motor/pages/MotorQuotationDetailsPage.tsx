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
  useCreateMotorQuotationDetail,
  useDeleteMotorQuotationDetail,
  useMotorQuotationDetails,
  useMotorQuotations,
  useRestoreMotorQuotationDetail,
  useUpdateMotorQuotationDetail,
} from '../hooks';
import { MotorQuotationDetailForm } from '../components/MotorQuotationDetailForm';
import { motorQuotationDetailRecordToFormValues } from '../schemas';
import { type MotorQuotationDetailRecord } from '../types';

export function MotorQuotationDetailsPage() {
  const { data: quotationOptions = [] } = useMotorQuotations();
  const { data: vehiclePage } = useQuery({
    queryKey: ['motor', 'vehicle-options'],
    queryFn: async () => (await motorApi.getVehicles({ page: 1, limit: 1000 })).data,
    staleTime: 60_000,
  });
  const vehicleOptions = vehiclePage ?? [];
  const [selectedQuotationId, setSelectedQuotationId] = useState('all');
  const { data: details = [], isLoading } = useMotorQuotationDetails(
    selectedQuotationId === 'all' ? undefined : selectedQuotationId,
  );
  const createMutation = useCreateMotorQuotationDetail();
  const updateMutation = useUpdateMotorQuotationDetail();
  const deleteMutation = useDeleteMotorQuotationDetail();
  const restoreMutation = useRestoreMotorQuotationDetail();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MotorQuotationDetailRecord | null>(null);
  const [deleteItem, setDeleteItem] = useState<MotorQuotationDetailRecord | null>(null);
  const [restoreItem, setRestoreItem] = useState<MotorQuotationDetailRecord | null>(null);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return details.filter((item) =>
      !term ||
      [item.cover_type, item.usage_type, item.excess_type, item.quotation?.quotation_no, item.motor_vehicle?.registration_no]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [details, search]);

  const columns: Column<MotorQuotationDetailRecord>[] = [
    { key: 'quotation', header: 'Quotation', cell: (row) => row.quotation?.quotation_no ?? row.quotation_id },
    { key: 'vehicle', header: 'Vehicle', cell: (row) => row.motor_vehicle?.registration_no ?? row.motor_vehicle_id },
    { key: 'quotation_risk_id', header: 'Risk ID', cell: (row) => row.quotation_risk_id },
    { key: 'excess_applicable', header: 'Excess', cell: (row) => (row.excess_applicable ? 'Yes' : 'No') },
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
        title="Motor Quotation Details"
        description="Link motor vehicles to quotation risks"
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
        <Select value={selectedQuotationId} onValueChange={setSelectedQuotationId}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Quotation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Quotations</SelectItem>
            {quotationOptions.map((quotation) => (
              <SelectItem key={quotation.id} value={quotation.id}>
                {quotation.quotation_no} ({quotation.status})
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
            <DialogTitle>{editing ? 'Edit Motor Quotation Detail' : 'Create Motor Quotation Detail'}</DialogTitle>
          </DialogHeader>
          <MotorQuotationDetailForm
            key={editing?.id ?? 'new'}
            quotationOptions={quotationOptions}
            vehicleOptions={vehicleOptions}
            isPending={editing ? updateMutation.isPending : createMutation.isPending}
            submitLabel={editing ? 'Save Changes' : 'Create Detail'}
            defaultValues={editing ? motorQuotationDetailRecordToFormValues(editing) : undefined}
            onSubmit={(values) => {
              const mutation = editing ? updateMutation : createMutation;
              mutation.mutate(values, {
                onSuccess: () => { setDialogOpen(false); setEditing(null); },
              });
            }}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        title="Delete Detail"
        description="This will soft-delete the motor quotation detail."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteItem && deleteMutation.mutate(deleteItem.id, { onSuccess: () => setDeleteItem(null) })}
      />

      <ConfirmDialog
        open={!!restoreItem}
        onOpenChange={(open) => !open && setRestoreItem(null)}
        title="Restore Detail"
        description="This will restore the motor quotation detail."
        confirmLabel="Restore"
        loading={restoreMutation.isPending}
        onConfirm={() => restoreItem && restoreMutation.mutate(restoreItem.id, { onSuccess: () => setRestoreItem(null) })}
      />
    </div>
  );
}
