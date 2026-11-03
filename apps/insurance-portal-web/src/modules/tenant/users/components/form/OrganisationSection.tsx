import { useFormContext, useWatch } from 'react-hook-form';
import { Combobox } from '@/components/ui/combobox';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import type { UserAccessOptions } from '@/modules/tenant/users/api/users';
import type { OrganisationValues } from '@/modules/tenant/users/schemas/user-form.schema';
import { SectionHeading, SelectableCard } from './SelectableCard';

const NO_ACTIVE_DEPARTMENT = '__none__';

export function OrganisationSection({
  options,
}: {
  options: UserAccessOptions;
}) {
  const { control, setValue, getValues } = useFormContext<OrganisationValues>();
  const branchIds = useWatch({ control, name: 'branch_ids' }) ?? [];
  const departmentIds = useWatch({ control, name: 'department_ids' }) ?? [];

  const branchName = new Map(
    options.branches.map((branch) => [branch.id, branch.name]),
  );
  const servesAny = (departmentBranchIds: string[], selected: string[]) =>
    !departmentBranchIds.length ||
    departmentBranchIds.some((id) => selected.includes(id));
  const availableDepartments = options.departments.filter((department) =>
    servesAny(department.branch_ids, branchIds),
  );

  const change = { shouldDirty: true, shouldValidate: true } as const;
  const setIds = (key: 'branch_ids' | 'department_ids', ids: string[]) =>
    setValue(key, ids, change);
  const setActive = (
    key: 'active_branch_id' | 'active_department_id',
    id: string,
  ) => setValue(key, id, change);

  const toggleBranch = (branchId: string, checked: boolean) => {
    const next = checked
      ? [...branchIds, branchId]
      : branchIds.filter((id) => id !== branchId);
    setIds('branch_ids', next);

    if (!next.includes(getValues('active_branch_id'))) {
      setActive('active_branch_id', next[0] ?? '');
    }

    // Departments tied to a branch the user leaves go with it.
    const keptDepartments = departmentIds.filter((id) => {
      const department = options.departments.find((d) => d.id === id);
      return !department || servesAny(department.branch_ids, next);
    });
    if (keptDepartments.length !== departmentIds.length) {
      setIds('department_ids', keptDepartments);
      if (!keptDepartments.includes(getValues('active_department_id'))) {
        setActive('active_department_id', '');
      }
    }
  };

  const toggleDepartment = (departmentId: string, checked: boolean) => {
    const next = checked
      ? [...departmentIds, departmentId]
      : departmentIds.filter((id) => id !== departmentId);
    setIds('department_ids', next);
    if (!next.includes(getValues('active_department_id'))) {
      setActive('active_department_id', '');
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <SectionHeading
          title="Branches"
          description="The branches this user works in. Their active branch sets the default context after login."
        />
        <FormField
          control={control}
          name="branch_ids"
          render={() => (
            <FormItem>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {options.branches.map((branch) => (
                  <SelectableCard
                    key={branch.id}
                    checked={branchIds.includes(branch.id)}
                    onCheckedChange={(checked) =>
                      toggleBranch(branch.id, checked)
                    }
                    title={branch.name}
                    description={branch.code}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="active_branch_id"
          render={({ field }) => (
            <FormItem className="mt-4 md:max-w-md">
              <FormLabel>Active branch</FormLabel>
              <FormControl>
                <Combobox
                  options={options.branches
                    .filter((branch) => branchIds.includes(branch.id))
                    .map((branch) => ({
                      value: branch.id,
                      label: `${branch.name} (${branch.code})`,
                    }))}
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder="Select the active branch"
                  searchPlaceholder="Search selected branches…"
                  emptyText="Select branches above first"
                  disabled={!branchIds.length}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </section>

      <section>
        <SectionHeading
          title="Departments"
          description="Optional. Only company-wide departments and those in the selected branches are listed."
        />
        {availableDepartments.length ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {availableDepartments.map((department) => (
              <SelectableCard
                key={department.id}
                checked={departmentIds.includes(department.id)}
                onCheckedChange={(checked) =>
                  toggleDepartment(department.id, checked)
                }
                title={department.name}
                description={
                  department.branch_ids.length
                    ? `${department.code} · ${department.branch_ids
                        .map((id) => branchName.get(id) ?? 'Branch')
                        .join(', ')}`
                    : `${department.code} · Company-wide`
                }
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            No departments are available for the selected branches.
          </p>
        )}
        <FormField
          control={control}
          name="active_department_id"
          render={({ field }) => (
            <FormItem className="mt-4 md:max-w-md">
              <FormLabel>Active department</FormLabel>
              <FormControl>
                <Combobox
                  options={[
                    {
                      value: NO_ACTIVE_DEPARTMENT,
                      label: 'No active department',
                    },
                    ...options.departments
                      .filter((department) =>
                        departmentIds.includes(department.id),
                      )
                      .map((department) => ({
                        value: department.id,
                        label: `${department.name} (${department.code})`,
                      })),
                  ]}
                  value={field.value || NO_ACTIVE_DEPARTMENT}
                  onValueChange={(value) =>
                    field.onChange(value === NO_ACTIVE_DEPARTMENT ? '' : value)
                  }
                  placeholder="No active department"
                  searchPlaceholder="Search selected departments…"
                  emptyText="No departments selected"
                  disabled={!departmentIds.length}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </section>
    </div>
  );
}
