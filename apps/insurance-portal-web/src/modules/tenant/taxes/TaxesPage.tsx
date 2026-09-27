import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { getApiErrorMessage } from '@/lib/api-error';
import { taxesApi, type TaxRecord } from './api';

const schema = z.object({
  tax_code: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9_-]*$/,
      'Use letters, numbers, hyphens or underscores',
    ),
  tax_name: z.string().trim().min(1, 'Name is required').max(150),
  percentage: z.number().min(0).max(100),
  is_active: z.boolean(),
  is_default: z.boolean(),
});
type Values = z.infer<typeof schema>;
const defaults: Values = {
  tax_code: '',
  tax_name: '',
  percentage: 0,
  is_active: true,
  is_default: false,
};

export function TaxesPage() {
  const { hasPermission, company } = useAuthStore();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['taxes', company?.id, 'list'],
    queryFn: taxesApi.list,
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TaxRecord | null>(null);
  const [deleting, setDeleting] = useState<TaxRecord | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['taxes'] });
  const save = useMutation({
    mutationFn: (values: Values) => {
      const data = {
        tax_code: values.tax_code.toUpperCase(),
        tax_name: values.tax_name,
        tax_rate: Number((values.percentage / 100).toFixed(10)),
        is_active: values.is_active,
        is_default: values.is_default,
      };
      return editing
        ? taxesApi.update(editing.id, data)
        : taxesApi.create(data);
    },
    onSuccess: () => {
      void invalidate();
      setOpen(false);
      toast.success(editing ? 'Tax updated' : 'Tax created');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: taxesApi.remove,
    onSuccess: () => {
      void invalidate();
      setDeleting(null);
      toast.success('Tax deleted');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const edit = (tax: TaxRecord | null) => {
    setEditing(tax);
    form.reset(
      tax
        ? {
            tax_code: tax.tax_code,
            tax_name: tax.tax_name,
            percentage: Number((Number(tax.tax_rate) * 100).toFixed(8)),
            is_active: tax.is_active,
            is_default: tax.is_default,
          }
        : defaults,
    );
    setOpen(true);
  };
  return (
    <div className="space-y-6">
      <PageHeader
        title="Taxes"
        description="Manage the taxes officers can select on a quotation. Each selected tax is calculated on the premium after discounts."
        action={
          hasPermission('product-distribution:create') ? (
            <Button onClick={() => edit(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Add tax
            </Button>
          ) : undefined
        }
      />
      {query.isLoading ? (
        <p>Loading taxes…</p>
      ) : query.isError ? (
        <div role="alert">
          {getApiErrorMessage(query.error)}{' '}
          <Button variant="outline" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Default</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!query.data?.length && (
              <TableRow>
                <TableCell colSpan={6}>
                  No taxes yet. Add a tax to make it available on quotations.
                </TableCell>
              </TableRow>
            )}
            {query.data?.map((tax) => (
              <TableRow key={tax.id}>
                <TableCell>{tax.tax_code}</TableCell>
                <TableCell>{tax.tax_name}</TableCell>
                <TableCell>
                  {Number((Number(tax.tax_rate) * 100).toFixed(8))}%
                </TableCell>
                <TableCell>{tax.is_default ? 'Default' : '-'}</TableCell>
                <TableCell>{tax.is_active ? 'Active' : 'Inactive'}</TableCell>
                <TableCell>
                  {hasPermission('product-distribution:update') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${tax.tax_code}`}
                      onClick={() => edit(tax)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {hasPermission('product-distribution:delete') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${tax.tax_code}`}
                      onClick={() => setDeleting(tax)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!save.isPending) setOpen(value);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit tax' : 'Add tax'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => save.mutate(values))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="tax_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={!!editing}
                        placeholder="VAT-MAINLAND"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tax_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="percentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.00000001"
                        value={Number.isNaN(field.value) ? '' : field.value}
                        onChange={(event) =>
                          field.onChange(
                            event.target.value === ''
                              ? NaN
                              : Number(event.target.value),
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3">
                    <FormLabel>Active</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="is_default"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3">
                    <FormLabel>Default tax</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {editing && (
                <p className="text-sm text-slate-500">
                  Changes apply when a premium is recalculated. Saved quotations
                  keep their existing tax amounts.
                </p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={save.isPending}
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? 'Saving…' : 'Save tax'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(value) => {
          if (!value) setDeleting(null);
        }}
        title="Delete tax"
        description={`Remove ${deleting?.tax_code} from available taxes? Existing quotations retain their saved amounts. The code remains reserved.`}
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id);
        }}
      />
    </div>
  );
}
