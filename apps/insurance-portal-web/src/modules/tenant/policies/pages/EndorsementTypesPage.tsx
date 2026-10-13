import { useState } from 'react';
import { Pencil, Plus, ShieldCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { DataTable, type Column } from '@/components/data-table';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import {
  useCreateEndorsementType,
  useEndorsementTypes,
  useUpdateEndorsementType,
} from '../hooks';
import type { EndorsementTypeRecord } from '../types';

const endorsementTypeSchema = z.object({
  code: z
    .string()
    .min(1, 'Code is required')
    .max(50)
    .regex(/^[A-Z0-9_]+$/, 'Uppercase letters, numbers, and underscores only'),
  name: z.string().min(1, 'Name is required').max(150),
  tira_endorsement_type: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (value) => !value || /^\d+$/.test(value),
      'TIRA endorsement type must be a whole number',
    ),
  requires_new_cover_note: z.boolean(),
  is_active: z.boolean(),
});

type EndorsementTypeFormValues = z.infer<typeof endorsementTypeSchema>;

function EndorsementTypeStatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge variant="success">Active</Badge>
  ) : (
    <Badge variant="muted">Inactive</Badge>
  );
}

interface UpsertEndorsementTypeDialogProps {
  open: boolean;
  editing: EndorsementTypeRecord | null;
  onClose: () => void;
  onSubmit: (values: EndorsementTypeFormValues) => void;
  isPending: boolean;
}

function UpsertEndorsementTypeDialog({
  open,
  editing,
  onClose,
  onSubmit,
  isPending,
}: UpsertEndorsementTypeDialogProps) {
  const form = useForm<EndorsementTypeFormValues>({
    resolver: zodResolver(endorsementTypeSchema),
    values: editing
      ? {
          code: editing.code,
          name: editing.name,
          tira_endorsement_type: editing.tira_endorsement_type
            ? String(editing.tira_endorsement_type)
            : '',
          requires_new_cover_note: editing.requires_new_cover_note,
          is_active: editing.is_active,
        }
      : undefined,
    defaultValues: {
      code: editing?.code ?? '',
      name: editing?.name ?? '',
      tira_endorsement_type: editing?.tira_endorsement_type
        ? String(editing.tira_endorsement_type)
        : '',
      requires_new_cover_note: editing?.requires_new_cover_note ?? true,
      is_active: editing?.is_active ?? true,
    },
  });

  const key = editing?.id ?? 'new';

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog key={key} open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Edit Endorsement Type' : 'Create Endorsement Type'}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? 'Update this endorsement type. The code cannot be changed after creation.'
              : 'Define a new endorsement type that underwriters can select when starting an endorsement. Map it to the real TIRA endorsement-type code your regulator has assigned before using it in production.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Code <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="INCREASE_SUM_INSURED"
                        {...field}
                        disabled={!!editing}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Unique per company - uppercase letters, numbers, and
                      underscores only.
                      {editing && ' Cannot be changed after creation.'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Name <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Increase Sum Insured" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tira_endorsement_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>TIRA Endorsement Type Code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. 12"
                        inputMode="numeric"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      The numeric endorsement-type code from your TIRAMIS
                      integration spec. Leave blank until it's confirmed -
                      endorsements can still be created, but submission to
                      TIRAMIS requires this to be set.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <FormField
              control={form.control}
              name="requires_new_cover_note"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-4 py-3">
                  <div>
                    <FormLabel className="mb-0">
                      Requires replacement cover note
                    </FormLabel>
                    <FormDescription className="text-xs">
                      When enabled, issuing this endorsement replaces the
                      existing cover note reference.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-4 py-3">
                  <div>
                    <FormLabel className="mb-0">Active</FormLabel>
                    <FormDescription className="text-xs">
                      Inactive endorsement types can't be selected when starting
                      a new endorsement.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? 'Saving...'
                  : editing
                    ? 'Save Changes'
                    : 'Create Endorsement Type'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function EndorsementTypesPage() {
  const { hasPermission } = useAuthStore();
  const canManage = hasPermission('endorsements:create');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EndorsementTypeRecord | null>(null);

  const { data: endorsementTypes = [], isLoading } = useEndorsementTypes();
  const createMutation = useCreateEndorsementType();
  const updateMutation = useUpdateEndorsementType();

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(endorsementType: EndorsementTypeRecord) {
    setEditing(endorsementType);
    setDialogOpen(true);
  }

  function handleSubmit(values: EndorsementTypeFormValues) {
    const tiraCode = values.tira_endorsement_type
      ? Number(values.tira_endorsement_type)
      : undefined;

    if (editing) {
      updateMutation.mutate(
        {
          id: editing.id,
          payload: {
            name: values.name,
            tira_endorsement_type: tiraCode ?? null,
            requires_new_cover_note: values.requires_new_cover_note,
            is_active: values.is_active,
          },
        },
        {
          onSuccess: () => {
            setDialogOpen(false);
            setEditing(null);
          },
        },
      );
      return;
    }

    createMutation.mutate(
      {
        code: values.code,
        name: values.name,
        tira_endorsement_type: tiraCode,
        requires_new_cover_note: values.requires_new_cover_note,
        is_active: values.is_active,
      },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setEditing(null);
        },
      },
    );
  }

  const columns: Column<EndorsementTypeRecord>[] = [
    {
      key: 'name',
      header: 'Endorsement Type',
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-indigo-50 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
          </div>
          <div>
            <p className="font-medium text-slate-900">{r.name}</p>
            <code className="text-xs text-slate-400">{r.code}</code>
          </div>
        </div>
      ),
    },
    {
      key: 'tira_endorsement_type',
      header: 'TIRA Code',
      cell: (r) =>
        r.tira_endorsement_type ? (
          <span className="text-sm text-slate-900">
            {r.tira_endorsement_type}
          </span>
        ) : (
          <Badge variant="warning">Not configured</Badge>
        ),
    },
    {
      key: 'requires_new_cover_note',
      header: 'Replacement Cover Note',
      cell: (r) => (
        <span className="text-sm text-slate-500">
          {r.requires_new_cover_note ? 'Required' : 'Not required'}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      cell: (r) => <EndorsementTypeStatusBadge active={r.is_active} />,
    },
    ...(canManage
      ? [
          {
            key: 'actions' as keyof EndorsementTypeRecord,
            header: '',
            className: 'w-12',
            cell: (r: EndorsementTypeRecord) => (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => openEdit(r)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Endorsement Types"
        description="Configure the endorsement types underwriters can select when starting a policy endorsement, mapped to your TIRAMIS endorsement-type codes"
        action={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Endorsement Type
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={endorsementTypes}
        loading={isLoading}
        page={1}
        limit={Math.max(endorsementTypes.length, 10)}
        total={endorsementTypes.length}
        totalPages={1}
        onPageChange={() => undefined}
        onLimitChange={() => undefined}
        showColumnVisibility={false}
        emptyMessage="No endorsement types configured yet"
      />

      <UpsertEndorsementTypeDialog
        open={dialogOpen}
        editing={editing}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
