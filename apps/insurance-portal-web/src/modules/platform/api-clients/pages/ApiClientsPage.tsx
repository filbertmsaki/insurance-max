import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Plus,
  Copy,
  RotateCcw,
  Ban,
  MoreHorizontal,
  Check,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { apiClientsApi } from '@/modules/platform/api-clients/api/api-clients';
import type { ApiClient } from '@/types';

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  scopes: z.string().min(1, 'At least one scope required'),
  ipWhitelist: z.string().min(1, 'At least one allowlisted IP is required'),
  rateLimitPerMinute: z
    .string()
    .regex(/^[1-9]\d*$/, 'Enter a whole number greater than zero'),
});

function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function SecretModal({
  secret,
  open,
  onClose,
}: {
  secret: string;
  open: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Client Secret</DialogTitle>
          <DialogDescription>
            Copy this secret now. It will not be shown again.
          </DialogDescription>
        </DialogHeader>
        <Alert variant="warning" className="bg-amber-50 border-amber-200">
          <AlertDescription className="text-amber-800">
            Store this secret securely. You won't be able to retrieve it after
            closing this dialog.
          </AlertDescription>
        </Alert>
        <div className="flex items-center gap-2 p-3 bg-slate-50 border rounded-md">
          <code className="flex-1 text-sm font-mono break-all">{secret}</code>
          <Button
            size="icon"
            variant="ghost"
            onClick={copy}
            className="h-8 w-8 shrink-0"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ApiClientsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [rotateId, setRotateId] = useState<string | null>(null);
  const [secretModal, setSecretModal] = useState<{
    open: boolean;
    secret: string;
  }>({
    open: false,
    secret: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['api-clients', { page, limit }],
    queryFn: () => apiClientsApi.getApiClients({ page, limit }),
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      rateLimitPerMinute: '60',
    },
  });

  const createMutation = useMutation({
    mutationFn: (d: z.infer<typeof schema>) =>
      apiClientsApi.createApiClient({
        name: d.name,
        description: d.description,
        scopes: splitList(d.scopes),
        ip_whitelist: splitList(d.ipWhitelist),
        rate_limit_per_minute: Number(d.rateLimitPerMinute),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['api-clients'] });
      setCreateOpen(false);
      form.reset();
      setSecretModal({ open: true, secret: result.plainSecret });
      toast.success('API Client created');
    },
  });

  const rotateMutation = useMutation({
    mutationFn: apiClientsApi.rotateSecret,
    onSuccess: (result) => {
      setRotateId(null);
      setSecretModal({ open: true, secret: result.plainSecret });
      toast.success('Secret rotated');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: apiClientsApi.revokeApiClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-clients'] });
      setRevokeId(null);
      toast.success('API Client revoked');
    },
  });

  const columns: Column<ApiClient>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (r) => <span className="font-medium">{r.name}</span>,
    },
    {
      key: 'client_id',
      header: 'Client ID',
      cell: (r) => (
        <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">
          {r.client_id}
        </code>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'scopes',
      header: 'Scopes',
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.scopes.map((s) => (
            <Badge key={s} variant="secondary" className="text-xs">
              {s}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'last_used',
      header: 'Last Used',
      cell: (r) => (
        <span className="text-sm text-slate-500">
          {r.last_used_at
            ? format(new Date(r.last_used_at), 'MMM d, yyyy')
            : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      cell: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setRotateId(r.id)}>
              <RotateCcw className="mr-2 h-4 w-4" /> Rotate Secret
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setRevokeId(r.id)}
              className="text-red-600"
              disabled={r.status === 'revoked'}
            >
              <Ban className="mr-2 h-4 w-4" /> Revoke
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="API Clients"
        description="Manage machine-to-machine API credentials"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create API Client
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        page={page}
        limit={limit}
        total={data?.pagination?.total ?? 0}
        totalPages={data?.pagination?.totalPages ?? 1}
        onPageChange={setPage}
        onLimitChange={(l) => {
          setLimit(l);
          setPage(1);
        }}
      />

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Client</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={(event) => {
                void form.handleSubmit((d) => createMutation.mutate(d))(event);
              }}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My Mobile App" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="scopes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scopes (comma-separated)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="read:users, write:claims"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ipWhitelist"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>IP Allowlist</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="203.0.113.10, 203.0.113.11"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Enter the TIRAMIS server's public outbound IP. Separate
                      multiple IPs with commas.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rateLimitPerMinute"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate Limit Per Minute</FormLabel>
                    <FormControl>
                      <Input min={1} type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Secret Modal */}
      <SecretModal
        open={secretModal.open}
        secret={secretModal.secret}
        onClose={() => setSecretModal({ open: false, secret: '' })}
      />

      {/* Rotate Confirm */}
      <ConfirmDialog
        open={!!rotateId}
        onOpenChange={(o) => !o && setRotateId(null)}
        title="Rotate Secret"
        description="This will generate a new secret. The old secret will stop working immediately."
        confirmLabel="Rotate"
        onConfirm={() => rotateMutation.mutate(rotateId!)}
        loading={rotateMutation.isPending}
      />

      {/* Revoke Confirm */}
      <ConfirmDialog
        open={!!revokeId}
        onOpenChange={(o) => !o && setRevokeId(null)}
        title="Revoke API Client"
        description="This will permanently revoke this API client. It will stop working immediately."
        confirmLabel="Revoke"
        onConfirm={() => revokeMutation.mutate(revokeId!)}
        loading={revokeMutation.isPending}
      />
    </div>
  );
}
