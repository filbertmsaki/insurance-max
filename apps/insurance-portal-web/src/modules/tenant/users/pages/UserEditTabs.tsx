import { useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  useForm,
  useFormContext,
  useWatch,
  type DefaultValues,
  type FieldValues,
  type Resolver,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { mapApiErrorsToForm } from '@/lib/api-error';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import type {
  UpdateUserAccessDto,
  UserAccess,
  UserAccessOptions,
  UserAccessSection,
} from '@/modules/tenant/users/api/users';
import {
  useUpdateUser,
  useUpdateUserAccess,
} from '@/modules/tenant/users/hooks';
import {
  EDITABLE_STATUSES,
  accessToValues,
  dataAccessSchema,
  editProfileSchema,
  grantToPayload,
  organisationSchema,
  organisationToPayload,
  permissionsSchema,
  rolesSchema,
  type DataAccessValues,
  type EditProfileValues,
  type RolesValues,
  type PermissionsValues,
} from '@/modules/tenant/users/schemas/user-form.schema';
import { ProfileSection } from '@/modules/tenant/users/components/form/ProfileSection';
import { OrganisationSection } from '@/modules/tenant/users/components/form/OrganisationSection';
import { RolesSection } from '@/modules/tenant/users/components/form/RolesSection';
import { PermissionsSection } from '@/modules/tenant/users/components/form/PermissionsSection';
import { DataAccessSection } from '@/modules/tenant/users/components/form/DataAccessSection';
import { EffectivePermissionsPanel } from '@/modules/tenant/users/components/form/EffectivePermissionsPanel';
import type { UserDetail } from '@/types';

type TabId = 'profile' | UserAccessSection;

const TAB_LABELS: Record<TabId, string> = {
  profile: 'Profile',
  organisation: 'Organisation',
  roles: 'Roles',
  permissions: 'Permissions',
  data_access: 'Data access',
};

const EDIT_FIELD_MAP: Partial<
  Record<string, keyof EditProfileValues & string>
> = {
  first_name: 'first_name',
  last_name: 'last_name',
  phone: 'phone',
  status: 'status',
};

export function UserEditTabs({
  user,
  access,
  options,
}: {
  user: UserDetail;
  access: UserAccess;
  options: UserAccessOptions;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [dirty, setDirty] = useState<Partial<Record<TabId, boolean>>>({});

  const { hasPermission } = useAuthStore();
  const tabs: TabId[] = [
    ...(hasPermission('users:update') ? (['profile'] as const) : []),
    ...(
      ['organisation', 'roles', 'permissions', 'data_access'] as const
    ).filter((section) => options.sections.update.includes(section)),
  ];
  const requested = searchParams.get('tab') as TabId | null;
  const tab = requested && tabs.includes(requested) ? requested : tabs[0];
  const backPath = `/apps/users/${user.id}`;
  const values = accessToValues(access);

  const markDirty = (id: TabId) => (isDirty: boolean) =>
    setDirty((current) =>
      current[id] === isDirty ? current : { ...current, [id]: isDirty },
    );

  return (
    <Tabs
      value={tab}
      onValueChange={(next) =>
        setSearchParams(
          (params) => {
            params.set('tab', next);
            return params;
          },
          { replace: true },
        )
      }
    >
      <TabsList className="mb-4 flex-wrap">
        {tabs.map((id) => (
          <TabsTrigger key={id} value={id} className="gap-1.5">
            {TAB_LABELS[id]}
            {dirty[id] && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-amber-500"
                aria-label="Unsaved changes"
              />
            )}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* forceMount keeps unsaved edits when switching tabs. */}
      {tabs.includes('profile') && (
        <TabsContent
          value="profile"
          forceMount
          className="data-[state=inactive]:hidden"
        >
          <ProfileTab
            user={user}
            backPath={backPath}
            onDirtyChange={markDirty('profile')}
          />
        </TabsContent>
      )}

      {tabs.includes('organisation') && (
        <TabsContent
          value="organisation"
          forceMount
          className="data-[state=inactive]:hidden"
        >
          <AccessTabForm
            userId={user.id}
            backPath={backPath}
            resolver={zodResolver(organisationSchema)}
            defaults={values}
            toPayload={organisationToPayload}
            onDirtyChange={markDirty('organisation')}
          >
            <OrganisationSection options={options} />
          </AccessTabForm>
        </TabsContent>
      )}

      {tabs.includes('roles') && (
        <TabsContent
          value="roles"
          forceMount
          className="data-[state=inactive]:hidden"
        >
          <AccessTabForm
            userId={user.id}
            backPath={backPath}
            resolver={zodResolver(rolesSchema)}
            defaults={values}
            toPayload={(form: RolesValues) => ({ role_ids: form.role_ids })}
            onDirtyChange={markDirty('roles')}
          >
            <RolesSection options={options} />
          </AccessTabForm>
        </TabsContent>
      )}

      {tabs.includes('permissions') && (
        <TabsContent
          value="permissions"
          forceMount
          className="data-[state=inactive]:hidden"
        >
          <AccessTabForm
            userId={user.id}
            backPath={backPath}
            resolver={zodResolver(permissionsSchema)}
            defaults={values}
            toPayload={(form: PermissionsValues) => ({
              permission_grants: form.permission_grants.map(grantToPayload),
              excluded_permission_ids: form.excluded_permission_ids,
            })}
            onDirtyChange={markDirty('permissions')}
          >
            <PermissionsTabBody options={options} access={access} />
          </AccessTabForm>
        </TabsContent>
      )}

      {tabs.includes('data_access') && (
        <TabsContent
          value="data_access"
          forceMount
          className="data-[state=inactive]:hidden"
        >
          <AccessTabForm
            userId={user.id}
            backPath={backPath}
            resolver={zodResolver(dataAccessSchema)}
            defaults={values}
            toPayload={(form: DataAccessValues) => form}
            onDirtyChange={markDirty('data_access')}
          >
            <DataAccessSection options={options} />
          </AccessTabForm>
        </TabsContent>
      )}
    </Tabs>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function TabActions({
  backPath,
  isPending,
  isDirty,
  onReset,
}: {
  backPath: string;
  isPending: boolean;
  isDirty: boolean;
  onReset: () => void;
}) {
  return (
    <div className="mt-6 flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
      <Button type="button" variant="ghost" asChild>
        <Link to={backPath}>Back to user</Link>
      </Button>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!isDirty || isPending}
          onClick={onReset}
        >
          Discard changes
        </Button>
        <Button type="submit" disabled={!isDirty || isPending}>
          {isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}

function ProfileTab({
  user,
  backPath,
  onDirtyChange,
}: {
  user: UserDetail;
  backPath: string;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const updateMutation = useUpdateUser(user.id);
  const statusEditable = (EDITABLE_STATUSES as readonly string[]).includes(
    user.status,
  );
  const form = useForm<EditProfileValues>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      ...(statusEditable && {
        status: user.status as EditProfileValues['status'],
      }),
    },
  });
  const { isDirty } = form.formState;
  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange]);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) =>
          updateMutation.mutate(
            { id: user.id, data },
            {
              onSuccess: () => form.reset(data),
              onError: (err) =>
                mapApiErrorsToForm(err, form.setError, EDIT_FIELD_MAP),
            },
          ),
        )}
      >
        <Card>
          <CardContent className="pt-6">
            <ProfileSection
              mode="edit"
              lockedStatus={statusEditable ? undefined : user.status}
            />
            <TabActions
              backPath={backPath}
              isPending={updateMutation.isPending}
              isDirty={isDirty}
              onReset={() => form.reset()}
            />
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}

/** One access section: its own form, saved through PUT /users/:id/access. */
function AccessTabForm<TValues extends FieldValues>({
  userId,
  backPath,
  resolver,
  defaults,
  toPayload,
  onDirtyChange,
  children,
}: {
  userId: string;
  backPath: string;
  resolver: Resolver<TValues>;
  defaults: ReturnType<typeof accessToValues>;
  toPayload: (values: TValues) => UpdateUserAccessDto;
  onDirtyChange: (dirty: boolean) => void;
  children: ReactNode;
}) {
  const updateAccess = useUpdateUserAccess(userId);
  const form = useForm<TValues>({
    resolver,
    defaultValues: defaults as unknown as DefaultValues<TValues>,
  });
  const { isDirty } = form.formState;
  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange]);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) =>
          updateAccess.mutate(toPayload(values), {
            onSuccess: (access) =>
              form.reset(
                accessToValues(access) as unknown as DefaultValues<TValues>,
              ),
          }),
        )}
      >
        <Card>
          <CardContent className="pt-6">
            {children}
            <TabActions
              backPath={backPath}
              isPending={updateAccess.isPending}
              isDirty={isDirty}
              onReset={() => form.reset()}
            />
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}

/** Uses the saved roles and organisation; other tabs save separately. */
function PermissionsTabBody({
  options,
  access,
}: {
  options: UserAccessOptions;
  access: UserAccess;
}) {
  const { control } = useFormContext<PermissionsValues>();
  const grants = useWatch({ control, name: 'permission_grants' }) ?? [];
  const excludedIds =
    useWatch({ control, name: 'excluded_permission_ids' }) ?? [];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <PermissionsSection
          options={options}
          roleIds={access.role_ids}
          assignedBranchIds={access.branch_ids}
          assignedDepartmentIds={access.department_ids}
        />
      </div>
      <EffectivePermissionsPanel
        options={options}
        roleIds={access.role_ids}
        grants={grants}
        excludedIds={excludedIds}
      />
    </div>
  );
}
