import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState, ErrorState } from '@/components/shared/ContentStates';
import { branchesApi } from '@/modules/tenant/branches/api/branches';
import { useRbacGuard } from '@/modules/shared/auth/hooks/useRbacGuard';
import { mapApiErrorsToForm } from '@/lib/api-error';
import {
  useCreateUser,
  useUpdateUser,
  useUser,
} from '@/modules/tenant/users/hooks';
import { usePageTitle } from '@/modules/shared/meta/page-title';
import type { UserStatus, UserType } from '@/types';

// ─── Validation schemas ───────────────────────────────────────────────────────

const PHONE_REGEX = /^(\+255|255|0)[67]\d{8}$/;

const USER_TYPE_VALUES = [
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
  'STAFF',
  'AGENT',
  'BROKER',
  'CUSTOMER',
  'OWNER',
  'COMPANY_USER',
] as const;

const createUserSchema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  phone: z
    .string()
    .regex(PHONE_REGEX, 'Must be a valid Tanzanian phone number'),
  password: z.string().min(6, 'Min 6 characters'),
  user_type: z.enum(USER_TYPE_VALUES).optional(),
  officer_title: z.string().min(1, 'Required'),
  branch_id: z.string().uuid('Branch is required'),
});

const editUserSchema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  phone: z
    .string()
    .regex(PHONE_REGEX, 'Must be a valid Tanzanian phone number'),
  status: z.enum(['active', 'inactive', 'suspended', 'locked']),
  user_type: z.enum(USER_TYPE_VALUES).optional(),
});

type CreateUserForm = z.infer<typeof createUserSchema>;
type EditUserForm = z.infer<typeof editUserSchema>;

// ─── Constants ────────────────────────────────────────────────────────────────

const USER_STATUSES: UserStatus[] = [
  'active',
  'inactive',
  'suspended',
  'locked',
];

const ALL_USER_TYPES: { value: UserType; label: string }[] = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'COMPANY_ADMIN', label: 'Company Admin' },
  { value: 'OWNER', label: 'Owner' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'AGENT', label: 'Agent' },
  { value: 'BROKER', label: 'Broker' },
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'COMPANY_USER', label: 'Company User' },
];

const NON_OWNER_USER_TYPES = ALL_USER_TYPES.filter(
  (t) => t.value !== 'SUPER_ADMIN' && t.value !== 'COMPANY_ADMIN',
);

const CREATE_FIELD_MAP: Partial<Record<string, keyof CreateUserForm & string>> =
  {
    first_name: 'first_name',
    last_name: 'last_name',
    email: 'email',
    phone: 'phone',
    password: 'password',
    user_type: 'user_type',
    officer_title: 'officer_title',
    branch_id: 'branch_id',
  };

const EDIT_FIELD_MAP: Partial<Record<string, keyof EditUserForm & string>> = {
  first_name: 'first_name',
  last_name: 'last_name',
  phone: 'phone',
  status: 'status',
  user_type: 'user_type',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export function UserFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const userQuery = useUser(id);
  const user = userQuery.data;

  usePageTitle(
    isEdit ? user && `Edit ${user.first_name} ${user.last_name}` : 'New User',
  );

  if (isEdit && userQuery.isError) {
    return (
      <ErrorState
        description="This user could not be loaded for editing."
        onRetry={() => {
          void userQuery.refetch();
        }}
      />
    );
  }

  if (isEdit && (userQuery.isLoading || !user)) {
    return (
      <EmptyState
        title="Loading user"
        description="The user form will appear in a moment."
      />
    );
  }

  const backPath = isEdit ? `/apps/users/${id}` : '/apps/users';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to={backPath}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader
          title={isEdit ? 'Edit User' : 'Add New User'}
          description={
            isEdit
              ? `Update ${user!.first_name} ${user!.last_name}'s profile details.`
              : 'Create a new user account in this company.'
          }
        />
      </div>

      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          {isEdit ? (
            <EditUserFormSection
              userId={id!}
              defaults={{
                first_name: user!.first_name,
                last_name: user!.last_name,
                phone: user!.phone,
                status: user!.status,
                user_type: user!.user_type as UserType | undefined,
              }}
              backPath={backPath}
            />
          ) : (
            <CreateUserFormSection backPath={backPath} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Shared fields ────────────────────────────────────────────────────────────

function useUserTypeOptions() {
  const { isOwner } = useRbacGuard();
  return isOwner ? ALL_USER_TYPES : NON_OWNER_USER_TYPES;
}

function FormActions({
  backPath,
  isPending,
  pendingLabel,
  submitLabel,
}: {
  backPath: string;
  isPending: boolean;
  pendingLabel: string;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Button type="button" variant="outline" asChild>
        <Link to={backPath}>Cancel</Link>
      </Button>
      <Button type="submit" disabled={isPending}>
        {isPending ? pendingLabel : submitLabel}
      </Button>
    </div>
  );
}

// ─── Create ───────────────────────────────────────────────────────────────────

function CreateUserFormSection({ backPath }: { backPath: string }) {
  const navigate = useNavigate();
  const userTypeOptions = useUserTypeOptions();
  const createMutation = useCreateUser();

  const { data: branchOptions = [] } = useQuery({
    queryKey: ['branches', 'user-assignment-options'],
    queryFn: branchesApi.getAllBranches,
    staleTime: 30_000,
  });

  const form = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      password: '',
      user_type: undefined,
      officer_title: 'Underwriter',
      branch_id: '',
    },
  });

  const handleCreate = (data: CreateUserForm) => {
    createMutation.mutate(data, {
      onSuccess: (created) => navigate(`/apps/users/${created.id}`),
      onError: (err) =>
        mapApiErrorsToForm(err, form.setError, CREATE_FIELD_MAP),
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="first_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First name</FormLabel>
                <FormControl>
                  <Input placeholder="John" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="last_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last name</FormLabel>
                <FormControl>
                  <Input placeholder="Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="john@company.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input placeholder="+255712345678" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Min 6 characters"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="user_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  User type{' '}
                  <span className="text-slate-400 font-normal">(optional)</span>
                </FormLabel>
                <Select
                  value={field.value ?? ''}
                  onValueChange={(v) => field.onChange(v || undefined)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select user type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {userTypeOptions.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
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
            name="officer_title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Officer title</FormLabel>
                <FormControl>
                  <Input placeholder="Underwriter" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="branch_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assigned branch</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {branchOptions
                      .filter((branch) => branch.status === 'active')
                      .map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name} ({branch.code})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormActions
          backPath={backPath}
          isPending={createMutation.isPending}
          pendingLabel="Creating…"
          submitLabel="Create user"
        />
      </form>
    </Form>
  );
}

// ─── Edit ─────────────────────────────────────────────────────────────────────

function EditUserFormSection({
  userId,
  defaults,
  backPath,
}: {
  userId: string;
  defaults: EditUserForm;
  backPath: string;
}) {
  const navigate = useNavigate();
  const userTypeOptions = useUserTypeOptions();
  const updateMutation = useUpdateUser(userId);

  const form = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
    defaultValues: defaults,
  });

  const handleUpdate = (data: EditUserForm) => {
    updateMutation.mutate(
      { id: userId, data },
      {
        onSuccess: () => navigate(backPath),
        onError: (err) =>
          mapApiErrorsToForm(err, form.setError, EDIT_FIELD_MAP),
      },
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleUpdate)} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="first_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="last_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {USER_STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
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
            name="user_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>User type</FormLabel>
                <Select
                  value={field.value ?? ''}
                  onValueChange={(v) => field.onChange(v || undefined)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select user type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {userTypeOptions.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormActions
          backPath={backPath}
          isPending={updateMutation.isPending}
          pendingLabel="Saving…"
          submitLabel="Save changes"
        />
      </form>
    </Form>
  );
}
