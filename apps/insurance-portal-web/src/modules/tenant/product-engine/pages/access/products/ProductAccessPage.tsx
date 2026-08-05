import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { productAccessApi } from '@/modules/tenant/product-engine/api/product-access';
import {
  useAllActiveCategories,
  useAllActiveProducts,
  useProductAccessByBranch,
  useProductAccessByDepartment,
  useProductAccessByUser,
  useGrantProductAccessBranch,
  useGrantProductAccessDepartment,
  useGrantProductAccessUser,
  useRevokeProductAccessBranch,
  useRevokeProductAccessDepartment,
  useRevokeProductAccessUser,
  useDepartments,
} from '@/modules/tenant/product-engine/hooks';
import { branchesApi } from '@/modules/tenant/branches/api/branches';
import { useQuery } from '@tanstack/react-query';
import type { AccessRecord, AccessStatus } from '@/types/product-engine';

// ─── Schema ──────────────────────────────────────────────────────────────────

const grantSchema = z.object({
  product_id: z.string().min(1, 'Product is required'),
  can_view: z.boolean(),
  can_create_policy: z.boolean(),
  access_status: z.enum(['ALLOW', 'DENY']),
});
type GrantFormValues = z.infer<typeof grantSchema>;

function AccessStatusBadge({ status }: { status: AccessStatus }) {
  return status === 'ALLOW' ? (
    <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
      ALLOW
    </Badge>
  ) : (
    <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
      DENY
    </Badge>
  );
}

function AccessTable({
  records,
  isLoading,
  onRevoke,
  canManage,
  entityName,
}: {
  records: AccessRecord[];
  isLoading: boolean;
  onRevoke: (record: AccessRecord) => void;
  canManage: boolean;
  entityName: string;
}) {
  if (isLoading)
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 hover:bg-slate-50">
            <TableHead>Product</TableHead>
            <TableHead>Can View</TableHead>
            <TableHead>Can Create Policy</TableHead>
            <TableHead>Access Status</TableHead>
            {canManage && <TableHead className="w-12" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={canManage ? 5 : 4}
                className="text-center py-8 text-slate-400 text-sm"
              >
                No access rules configured for this {entityName}.
              </TableCell>
            </TableRow>
          ) : (
            records.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium text-sm">
                  {r.product?.product_name ?? r.product_id}
                </TableCell>
                <TableCell>
                  {r.can_view ? (
                    <Badge className="bg-green-50 text-green-600 border-green-200 text-xs hover:bg-green-50">
                      Yes
                    </Badge>
                  ) : (
                    <span className="text-slate-400 text-xs">No</span>
                  )}
                </TableCell>
                <TableCell>
                  {r.can_create_policy ? (
                    <Badge className="bg-green-50 text-green-600 border-green-200 text-xs hover:bg-green-50">
                      Yes
                    </Badge>
                  ) : (
                    <span className="text-slate-400 text-xs">No</span>
                  )}
                </TableCell>
                <TableCell>
                  <AccessStatusBadge status={r.access_status} />
                </TableCell>
                {canManage && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => onRevoke(r)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function GrantDialog({
  open,
  onOpenChange,
  onGrant,
  loading,
  products,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGrant: (values: GrantFormValues) => void;
  loading: boolean;
  products: { id: string; product_name: string; category_id: string }[];
}) {
  const { data: categories = [] } = useAllActiveCategories();
  const [catFilter, setCatFilter] = useState('');

  const form = useForm<GrantFormValues>({
    resolver: zodResolver(grantSchema),
    defaultValues: {
      product_id: '',
      can_view: true,
      can_create_policy: false,
      access_status: 'ALLOW',
    },
  });

  const filteredProducts = catFilter
    ? products.filter((p) => p.category_id === catFilter)
    : products;

  function onSubmit(values: GrantFormValues) {
    onGrant(values);
    form.reset();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Grant Product Access</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                Filter by Category
              </label>
              <Select
                value={catFilter || 'all'}
                onValueChange={(v) => setCatFilter(v === 'all' ? '' : v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <FormField
              control={form.control}
              name="product_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Product <span className="text-red-500">*</span>
                  </FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredProducts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.product_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="access_status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Access Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ALLOW">ALLOW</SelectItem>
                      <SelectItem value="DENY">DENY</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="can_view"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">Can View</FormLabel>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="can_create_policy"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">Can Create Policy</FormLabel>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                Grant Access
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Branch tab ───────────────────────────────────────────────────────────────

function BranchTab({
  canManage,
  products,
}: {
  canManage: boolean;
  products: { id: string; product_name: string; category_id: string }[];
}) {
  const { data: branches = [] } = useQuery({
    queryKey: ['branches-list'],
    queryFn: branchesApi.getAllBranches,
    staleTime: 60_000,
  });
  const [selectedId, setSelectedId] = useState('');
  const [grantOpen, setGrantOpen] = useState(false);
  const [revokeItem, setRevokeItem] = useState<AccessRecord | null>(null);
  const { data: records = [], isLoading } =
    useProductAccessByBranch(selectedId);
  const grantMutation = useGrantProductAccessBranch();
  const revokeMutation = useRevokeProductAccessBranch();

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="space-y-1 flex-1">
          <p className="text-xs font-medium text-slate-500">Select Branch</p>
          <Select
            value={selectedId || 'none'}
            onValueChange={(v) => setSelectedId(v === 'none' ? '' : v)}
          >
            <SelectTrigger className="h-9 w-64">
              <SelectValue placeholder="Choose a branch…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Choose branch —</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canManage && selectedId && (
          <Button size="sm" onClick={() => setGrantOpen(true)}>
            <Plus className="mr-2 h-3.5 w-3.5" /> Grant Access
          </Button>
        )}
      </div>
      {selectedId && (
        <AccessTable
          records={records}
          isLoading={isLoading}
          onRevoke={setRevokeItem}
          canManage={canManage}
          entityName="branch"
        />
      )}
      <GrantDialog
        open={grantOpen}
        onOpenChange={setGrantOpen}
        products={products}
        loading={grantMutation.isPending}
        onGrant={(v) =>
          grantMutation.mutate(
            { ...v, branch_id: selectedId },
            { onSuccess: () => setGrantOpen(false) },
          )
        }
      />
      <ConfirmDialog
        open={!!revokeItem}
        onOpenChange={(o) => {
          if (!o) setRevokeItem(null);
        }}
        title="Revoke Access"
        description="Revoke this product access for the branch?"
        confirmLabel="Revoke"
        loading={revokeMutation.isPending}
        onConfirm={() => {
          if (revokeItem)
            revokeMutation.mutate(
              { id: revokeItem.id, branchId: selectedId },
              { onSuccess: () => setRevokeItem(null) },
            );
        }}
      />
    </div>
  );
}

function DepartmentTab({
  canManage,
  products,
}: {
  canManage: boolean;
  products: { id: string; product_name: string; category_id: string }[];
}) {
  const { data: departments = [] } = useDepartments();
  const [selectedId, setSelectedId] = useState('');
  const [grantOpen, setGrantOpen] = useState(false);
  const [revokeItem, setRevokeItem] = useState<AccessRecord | null>(null);
  const { data: records = [], isLoading } =
    useProductAccessByDepartment(selectedId);
  const grantMutation = useGrantProductAccessDepartment();
  const revokeMutation = useRevokeProductAccessDepartment();

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="space-y-1 flex-1">
          <p className="text-xs font-medium text-slate-500">
            Select Department
          </p>
          <Select
            value={selectedId || 'none'}
            onValueChange={(v) => setSelectedId(v === 'none' ? '' : v)}
          >
            <SelectTrigger className="h-9 w-64">
              <SelectValue placeholder="Choose a department…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Choose department —</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canManage && selectedId && (
          <Button size="sm" onClick={() => setGrantOpen(true)}>
            <Plus className="mr-2 h-3.5 w-3.5" /> Grant Access
          </Button>
        )}
      </div>
      {selectedId && (
        <AccessTable
          records={records}
          isLoading={isLoading}
          onRevoke={setRevokeItem}
          canManage={canManage}
          entityName="department"
        />
      )}
      <GrantDialog
        open={grantOpen}
        onOpenChange={setGrantOpen}
        products={products}
        loading={grantMutation.isPending}
        onGrant={(v) =>
          grantMutation.mutate(
            { ...v, department_id: selectedId },
            { onSuccess: () => setGrantOpen(false) },
          )
        }
      />
      <ConfirmDialog
        open={!!revokeItem}
        onOpenChange={(o) => {
          if (!o) setRevokeItem(null);
        }}
        title="Revoke Access"
        description="Revoke this product access for the department?"
        confirmLabel="Revoke"
        loading={revokeMutation.isPending}
        onConfirm={() => {
          if (revokeItem)
            revokeMutation.mutate(
              { id: revokeItem.id, deptId: selectedId },
              { onSuccess: () => setRevokeItem(null) },
            );
        }}
      />
    </div>
  );
}

function UserTab({
  canManage,
  products,
}: {
  canManage: boolean;
  products: { id: string; product_name: string; category_id: string }[];
}) {
  const [companyUserId, setCompanyUserId] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [grantOpen, setGrantOpen] = useState(false);
  const [revokeItem, setRevokeItem] = useState<AccessRecord | null>(null);
  const { data: records = [], isLoading } =
    useProductAccessByUser(companyUserId);
  const grantMutation = useGrantProductAccessUser();
  const revokeMutation = useRevokeProductAccessUser();

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500">Company User ID</p>
          <div className="flex gap-2">
            <input
              className="h-9 w-72 rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter company user ID…"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setCompanyUserId(inputValue.trim());
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => setCompanyUserId(inputValue.trim())}
            >
              Load
            </Button>
          </div>
        </div>
        {canManage && companyUserId && (
          <Button size="sm" onClick={() => setGrantOpen(true)}>
            <Plus className="mr-2 h-3.5 w-3.5" /> Grant Access
          </Button>
        )}
      </div>
      {companyUserId && (
        <AccessTable
          records={records}
          isLoading={isLoading}
          onRevoke={setRevokeItem}
          canManage={canManage}
          entityName="user"
        />
      )}
      <GrantDialog
        open={grantOpen}
        onOpenChange={setGrantOpen}
        products={products}
        loading={grantMutation.isPending}
        onGrant={(v) =>
          grantMutation.mutate(
            { ...v, company_user_id: companyUserId },
            { onSuccess: () => setGrantOpen(false) },
          )
        }
      />
      <ConfirmDialog
        open={!!revokeItem}
        onOpenChange={(o) => {
          if (!o) setRevokeItem(null);
        }}
        title="Revoke Access"
        description="Revoke this product access for the user?"
        confirmLabel="Revoke"
        loading={revokeMutation.isPending}
        onConfirm={() => {
          if (revokeItem)
            revokeMutation.mutate(
              { id: revokeItem.id, userId: companyUserId },
              { onSuccess: () => setRevokeItem(null) },
            );
        }}
      />
    </div>
  );
}

// ─── Resolve Panel ────────────────────────────────────────────────────────────

function ResolvePanel({
  products,
}: {
  products: { id: string; product_name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [form, setForm] = useState({
    company_user_id: '',
    branch_id: '',
    department_id: '',
    product_id: '',
  });
  const [loading, setLoading] = useState(false);

  async function resolve() {
    setLoading(true);
    try {
      const res = await productAccessApi.resolve({
        company_user_id: form.company_user_id,
        branch_id: form.branch_id || undefined,
        department_id: form.department_id || undefined,
        product_id: form.product_id || undefined,
      });
      setResult(res);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        Resolve Access
        {open ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100">
          <div className="grid grid-cols-2 gap-3 pt-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                Company User ID *
              </label>
              <input
                className="h-8 w-full rounded border border-slate-300 px-2 text-xs"
                value={form.company_user_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, company_user_id: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                Product
              </label>
              <select
                className="h-8 w-full rounded border border-slate-300 px-2 text-xs bg-white"
                value={form.product_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, product_id: e.target.value }))
                }
              >
                <option value="">Any</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.product_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                Branch ID (optional)
              </label>
              <input
                className="h-8 w-full rounded border border-slate-300 px-2 text-xs"
                value={form.branch_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, branch_id: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                Department ID (optional)
              </label>
              <input
                className="h-8 w-full rounded border border-slate-300 px-2 text-xs"
                value={form.department_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, department_id: e.target.value }))
                }
              />
            </div>
          </div>
          <Button
            size="sm"
            onClick={resolve}
            disabled={loading || !form.company_user_id}
          >
            {loading ? 'Resolving…' : 'Resolve'}
          </Button>
          {result ? (
            <pre className="text-xs bg-slate-800 text-green-300 p-3 rounded overflow-x-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ProductAccessPage() {
  const { hasPermission } = useAuthStore();
  const canManage = hasPermission('product-access:manage');
  const { data: products = [] } = useAllActiveProducts();

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Product Access Control"
        description="Grant or restrict insurance product access for branches, departments, and users"
      />

      <Tabs defaultValue="branch">
        <TabsList>
          <TabsTrigger value="branch">Branch Access</TabsTrigger>
          <TabsTrigger value="department">Department Access</TabsTrigger>
          <TabsTrigger value="user">User Access</TabsTrigger>
        </TabsList>
        <TabsContent value="branch" className="mt-6">
          <BranchTab canManage={canManage} products={products} />
        </TabsContent>
        <TabsContent value="department" className="mt-6">
          <DepartmentTab canManage={canManage} products={products} />
        </TabsContent>
        <TabsContent value="user" className="mt-6">
          <UserTab canManage={canManage} products={products} />
        </TabsContent>
      </Tabs>

      <ResolvePanel products={products} />
    </div>
  );
}
