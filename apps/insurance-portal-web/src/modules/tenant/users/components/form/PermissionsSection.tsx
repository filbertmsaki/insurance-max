import { useMemo, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import type { UserAccessOptions } from '@/modules/tenant/users/api/users';
import {
  DATA_SCOPE_OPTIONS,
  INHERIT_SCOPE,
  type PermissionGrantValues,
  type PermissionsValues,
} from '@/modules/tenant/users/schemas/user-form.schema';
import { SectionHeading, SelectableCard } from './SelectableCard';

const ANY_TARGET = '__any__';

const SCOPE_OPTIONS = [
  { value: INHERIT_SCOPE, label: "User's data scope" },
  ...DATA_SCOPE_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
  })),
];

type ListedPermission = UserAccessOptions['permissions'][number];

function categoryOf(name: string) {
  return name.includes(':') ? name.split(':')[0] : 'general';
}

function categoryLabel(category: string) {
  return category
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function PermissionsSection({
  options,
  roleIds,
  assignedBranchIds,
  assignedDepartmentIds,
}: {
  options: UserAccessOptions;
  /** Selected roles; their permissions show ticked and can be removed. */
  roleIds: string[];
  /** Branches/departments a grant may be narrowed to. */
  assignedBranchIds: string[];
  assignedDepartmentIds: string[];
}) {
  const { control, setValue } = useFormContext<PermissionsValues>();
  const grants = useWatch({ control, name: 'permission_grants' }) ?? [];
  const excluded = useWatch({ control, name: 'excluded_permission_ids' }) ?? [];
  const [search, setSearch] = useState('');

  // Permissions the selected roles grant, by id.
  const rolePermissions = useMemo(() => {
    const byId = new Map<string, ListedPermission>();
    options.roles
      .filter((role) => roleIds.includes(role.id))
      .forEach((role) =>
        role.permissions.forEach((permission) =>
          byId.set(permission.id, {
            ...permission,
            description: null,
            category: categoryOf(permission.name),
          }),
        ),
      );
    return byId;
  }, [options.roles, roleIds]);

  // Grantable permissions plus role permissions the actor could not grant
  // (still listed so they can be removed).
  const listed = useMemo(() => {
    const byId = new Map<string, ListedPermission>(
      options.permissions.map((permission) => [permission.id, permission]),
    );
    rolePermissions.forEach((permission, id) => {
      if (!byId.has(id)) byId.set(id, permission);
    });
    return [...byId.values()];
  }, [options.permissions, rolePermissions]);

  const grantable = useMemo(
    () => new Set(options.permissions.map((permission) => permission.id)),
    [options.permissions],
  );

  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase();
    const groups = new Map<string, ListedPermission[]>();
    listed
      .filter(
        (permission) =>
          !term ||
          permission.name.toLowerCase().includes(term) ||
          permission.display_name.toLowerCase().includes(term),
      )
      .forEach((permission) => {
        groups.set(permission.category, [
          ...(groups.get(permission.category) ?? []),
          permission,
        ]);
      });
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [listed, search]);

  const branches = options.branches.filter((branch) =>
    assignedBranchIds.includes(branch.id),
  );
  const departments = options.departments.filter((department) =>
    assignedDepartmentIds.includes(department.id),
  );

  const write = (next: PermissionGrantValues[]) =>
    setValue('permission_grants', next, {
      shouldDirty: true,
      shouldValidate: true,
    });

  const writeExcluded = (next: string[]) =>
    setValue('excluded_permission_ids', next, { shouldDirty: true });

  const toggle = (permissionId: string, checked: boolean) => {
    if (rolePermissions.has(permissionId)) {
      // Role permission: unticking withholds it from this user only.
      writeExcluded(
        checked
          ? excluded.filter((id) => id !== permissionId)
          : [...excluded, permissionId],
      );
      if (!checked) {
        write(grants.filter((grant) => grant.permission_id !== permissionId));
      }
      return;
    }
    toggleGrant(permissionId, checked);
  };

  const toggleGrant = (permissionId: string, checked: boolean) =>
    write(
      checked
        ? [
            ...grants,
            {
              permission_id: permissionId,
              data_scope: INHERIT_SCOPE,
              scope_branch_id: '',
              scope_department_id: '',
            },
          ]
        : grants.filter((grant) => grant.permission_id !== permissionId),
    );

  const patch = (
    permissionId: string,
    values: Partial<PermissionGrantValues>,
  ) =>
    write(
      grants.map((grant) =>
        grant.permission_id === permissionId ? { ...grant, ...values } : grant,
      ),
    );

  return (
    <section>
      <SectionHeading
        title="Permissions"
        description="Permissions from the selected roles are ticked; untick one to remove it for this user only. Tick any other permission to grant it as an extra, optionally narrowed to one branch or department. You can only grant permissions you hold yourself."
      />

      <div className="relative mb-4 md:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search permissions…"
          className="pl-9"
        />
      </div>

      {grouped.length === 0 && (
        <p className="text-sm text-slate-500">No permissions match.</p>
      )}

      <div className="space-y-5">
        {grouped.map(([category, permissions]) => (
          <div key={category}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {categoryLabel(category)}
            </p>
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {permissions.map((permission) => {
                const grant = grants.find(
                  (item) => item.permission_id === permission.id,
                );
                const fromRole = rolePermissions.has(permission.id);
                const removed = fromRole && excluded.includes(permission.id);
                return (
                  <SelectableCard
                    key={permission.id}
                    checked={fromRole ? !removed : !!grant}
                    disabled={!fromRole && !grantable.has(permission.id)}
                    onCheckedChange={(checked) =>
                      toggle(permission.id, checked)
                    }
                    title={permission.display_name}
                    description={permission.description ?? permission.name}
                    badges={
                      <>
                        {fromRole && (
                          <Badge variant="info" className="text-[10px]">
                            From role
                          </Badge>
                        )}
                        {removed && (
                          <Badge variant="warning" className="text-[10px]">
                            Removed for this user
                          </Badge>
                        )}
                        {grant && !fromRole && (
                          <Badge variant="primary" className="text-[10px]">
                            Extra
                          </Badge>
                        )}
                      </>
                    }
                  >
                    {grant && !fromRole && (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Combobox
                          options={SCOPE_OPTIONS}
                          value={grant.data_scope}
                          onValueChange={(value) =>
                            patch(permission.id, {
                              data_scope:
                                value as PermissionGrantValues['data_scope'],
                              scope_branch_id: '',
                              scope_department_id: '',
                            })
                          }
                          placeholder="Data scope"
                          searchPlaceholder="Search scopes…"
                          emptyText="No scopes"
                        />
                        {grant.data_scope === 'BRANCH' && (
                          <Combobox
                            options={[
                              {
                                value: ANY_TARGET,
                                label: 'All assigned branches',
                              },
                              ...branches.map((branch) => ({
                                value: branch.id,
                                label: branch.name,
                              })),
                            ]}
                            value={grant.scope_branch_id || ANY_TARGET}
                            onValueChange={(value) =>
                              patch(permission.id, {
                                scope_branch_id:
                                  value === ANY_TARGET ? '' : value,
                              })
                            }
                            placeholder="All assigned branches"
                            searchPlaceholder="Search branches…"
                            emptyText="No assigned branches"
                          />
                        )}
                        {grant.data_scope === 'DEPARTMENT' && (
                          <Combobox
                            options={[
                              {
                                value: ANY_TARGET,
                                label: 'All assigned departments',
                              },
                              ...departments.map((department) => ({
                                value: department.id,
                                label: department.name,
                              })),
                            ]}
                            value={grant.scope_department_id || ANY_TARGET}
                            onValueChange={(value) =>
                              patch(permission.id, {
                                scope_department_id:
                                  value === ANY_TARGET ? '' : value,
                              })
                            }
                            placeholder="All assigned departments"
                            searchPlaceholder="Search departments…"
                            emptyText="No assigned departments"
                          />
                        )}
                      </div>
                    )}
                  </SelectableCard>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
