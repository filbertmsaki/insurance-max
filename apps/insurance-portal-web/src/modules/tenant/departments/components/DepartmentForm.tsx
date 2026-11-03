import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import type { DepartmentRecord } from '@/modules/tenant/departments/api/departments';

const schema = z.object({
  name: z
    .string()
    .min(2, 'Department name must be at least 2 characters')
    .max(120),
  description: z.string().max(500).optional().or(z.literal('')),
  branch_ids: z.array(z.string()),
});

export type DepartmentFormValues = z.infer<typeof schema>;

type BranchOption = { id: string; name: string; code: string };

interface DepartmentFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: DepartmentFormValues) => void;
  isPending: boolean;
  editing?: DepartmentRecord | null;
  branchOptions: BranchOption[];
}

export function DepartmentForm({
  open,
  onClose,
  onSubmit,
  isPending,
  editing,
  branchOptions,
}: DepartmentFormProps) {
  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(schema),
    values: editing
      ? {
          name: editing.name,
          description: editing.description ?? '',
          branch_ids: editing.branch_ids ?? [],
        }
      : undefined,
    defaultValues: {
      name: '',
      description: '',
      branch_ids: [],
    },
  });

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Edit Department' : 'Create Department'}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? 'Update the department identity and the branches it operates in.'
              : 'Add a new department for the current company.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => {
              onSubmit(values);
              if (!editing) {
                form.reset();
              }
            })}
            className="space-y-5"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Department Name <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Claims Department" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {editing && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Department Code</p>
                <Input value={editing.code} readOnly disabled />
                <p className="text-xs text-slate-500">
                  Generated automatically and unique within the company.
                </p>
              </div>
            )}

            <FormField
              control={form.control}
              name="branch_ids"
              render={({ field }) => {
                const selected = field.value ?? [];
                const toggle = (branchId: string, checked: boolean) =>
                  field.onChange(
                    checked
                      ? [...selected, branchId]
                      : selected.filter((id) => id !== branchId),
                  );
                return (
                  <FormItem>
                    <FormLabel>Branches</FormLabel>
                    <p className="text-xs text-slate-500">
                      Select every branch this department operates in. Leave
                      all unchecked to make it company-wide.
                    </p>
                    {branchOptions.length ? (
                      <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
                        {branchOptions.map((branch) => (
                          <label
                            key={branch.id}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50"
                          >
                            <Checkbox
                              checked={selected.includes(branch.id)}
                              onCheckedChange={(checked) =>
                                toggle(branch.id, checked === true)
                              }
                            />
                            <span>
                              {branch.name} ({branch.code})
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">
                        No branches available — the department will be
                        company-wide.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Optional description"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
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
                    : 'Create Department'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
