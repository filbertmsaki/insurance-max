import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Power,
  PowerOff,
  Trash2,
  Building2,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DataTable,
  tableFilters,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { branchesApi } from '@/modules/tenant/branches/api/branches';
import {
  DepartmentForm,
  type DepartmentFormValues,
} from '@/modules/tenant/departments/components/DepartmentForm';
import {
  departmentsKeys,
  useCreateDepartment,
  useUpdateDepartment,
  useUpdateDepartmentStatus,
  useDeleteDepartment,
} from '@/modules/tenant/departments/hooks';
import {
  departmentsApi,
  type DepartmentRecord,
} from '@/modules/tenant/departments/api/departments';

const DEPARTMENT_FILTER_KEYS = ['status', 'branch_id'] as const;
type DepartmentFilterKey = (typeof DEPARTMENT_FILTER_KEYS)[number];
const DEPARTMENT_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

function StatusBadge({ status }: { status: string }) {
  return status === 'active' ? (
    <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
      Active
    </Badge>
  ) : (
    <Badge className="bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100">
      Inactive
    </Badge>
  );
}

export function DepartmentsPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();
  const canCreate = hasPermission('departments:create');
  const canUpdate = hasPermission('departments:update');
  const canDelete = hasPermission('departments:delete');

  const { data: branchOptions = [] } = useQuery({
    queryKey: ['branches', 'all'],
    queryFn: branchesApi.getAllBranches,
    staleTime: 60_000,
  });

  const { tableProps, state } = useServerTable<
    DepartmentRecord,
    DepartmentFilterKey
  >({
    queryKey: departmentsKeys.lists(),
    fetcher: (params, signal) => departmentsApi.listDepartments(params, signal),
    filterKeys: DEPARTMENT_FILTER_KEYS,
    defaultSortBy: 'created_at',
    defaultLimit: 10,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DepartmentRecord | null>(null);
  const [deleteItem, setDeleteItem] = useState<DepartmentRecord | null>(null);

  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment(editing?.id ?? undefined);
  const statusMutation = useUpdateDepartmentStatus();
  const deleteMutation = useDeleteDepartment();

  const columns: Column<DepartmentRecord>[] = [
    {
      key: 'name',
      header: 'Department',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-blue-100 flex items-center justify-center shrink-0">
            <Building2 className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-slate-900">{row.name}</p>
            <code className="text-xs text-slate-400">{row.code}</code>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'branch',
      header: 'Branch',
      sortable: true,
      cell: (row) =>
        row.branch ? (
          <div className="flex items-center gap-1.5 text-sm text-slate-600">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            <span>{row.branch.name}</span>
          </div>
        ) : (
          <span className="text-sm text-slate-400">Unassigned</span>
        ),
    },
    {
      key: 'description',
      header: 'Description',
      cell: (row) => (
        <span className="text-sm text-slate-500 line-clamp-1">
          {row.description ?? <span className="text-slate-300">—</span>}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      cell: (row) => (
        <span className="text-sm text-slate-500">
          {new Date(row.created_at).toLocaleDateString()}
        </span>
      ),
    },
  ];

  const rowActions = [
    {
      label: 'View Details',
      icon: Building2,
      onClick: (row: DepartmentRecord) =>
        navigate(`/apps/departments/${row.id}`),
    },
    {
      label: 'Edit',
      icon: Pencil,
      hidden: !canUpdate,
      onClick: (row: DepartmentRecord) => {
        setEditing(row);
        setDialogOpen(true);
      },
    },
    {
      label: 'Deactivate',
      icon: PowerOff,
      separator: true,
      hidden: (row: DepartmentRecord) => !canUpdate || row.status !== 'active',
      onClick: (row: DepartmentRecord) =>
        statusMutation.mutate({ departmentId: row.id, status: 'inactive' }),
    },
    {
      label: 'Activate',
      icon: Power,
      separator: true,
      hidden: (row: DepartmentRecord) => !canUpdate || row.status === 'active',
      onClick: (row: DepartmentRecord) =>
        statusMutation.mutate({ departmentId: row.id, status: 'active' }),
    },
    {
      label: 'Delete',
      icon: Trash2,
      destructive: true,
      separator: true,
      hidden: !canDelete,
      onClick: (row: DepartmentRecord) => setDeleteItem(row),
    },
  ];

  function handleSubmit(values: DepartmentFormValues) {
    const dto = {
      name: values.name,
      code: values.code,
      description: values.description || undefined,
      branch_id:
        values.branch_id && values.branch_id !== 'none'
          ? values.branch_id
          : undefined,
    };

    if (editing) {
      updateMutation.mutate(dto, {
        onSuccess: () => {
          setDialogOpen(false);
          setEditing(null);
        },
      });
      return;
    }

    createMutation.mutate(dto, {
      onSuccess: () => {
        setDialogOpen(false);
        setEditing(null);
      },
    });
  }

  return (
    <div>
      <PageHeader
        title="Departments"
        description="Manage departments and their branch assignments"
        action={
          canCreate ? (
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Department
            </Button>
          ) : undefined
        }
      />

      <DataTable
        {...tableProps}
        columns={columns}
        searchPlaceholder="Search departments…"
        filters={tableFilters(state.filters, [
          {
            key: 'status',
            label: 'Status',
            options: DEPARTMENT_STATUS_OPTIONS,
          },
          {
            key: 'branch_id',
            label: 'Branch',
            options: branchOptions.map((branch) => ({
              value: branch.id,
              label: branch.name,
            })),
          },
        ])}
        rowActions={rowActions}
        emptyMessage="No departments yet"
      />

      <DepartmentForm
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        editing={editing}
        branchOptions={branchOptions}
        isPending={createMutation.isPending}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={!!deleteItem}
        onOpenChange={(o) => !o && setDeleteItem(null)}
        title="Delete Department"
        description="This will permanently delete the department and cannot be undone."
        confirmLabel="Delete Department"
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
