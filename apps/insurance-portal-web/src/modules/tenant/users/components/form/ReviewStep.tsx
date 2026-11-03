import type { ReactNode } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import type {
  UserAccessOptions,
  UserAccessSection,
} from '@/modules/tenant/users/api/users';
import {
  DATA_SCOPE_OPTIONS,
  type CreateUserValues,
} from '@/modules/tenant/users/schemas/user-form.schema';
import { EffectivePermissionsPanel } from './EffectivePermissionsPanel';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-2 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="col-span-2 text-slate-900">{children || '—'}</dd>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-slate-900">{title}</h3>
      <dl className="divide-y divide-slate-100">{children}</dl>
    </div>
  );
}

export function ReviewStep({
  options,
  sections,
}: {
  options: UserAccessOptions;
  sections: UserAccessSection[];
}) {
  const { control } = useFormContext<CreateUserValues>();
  const values = useWatch({ control }) as CreateUserValues;

  const branchLabel = (id: string) =>
    options.branches.find((branch) => branch.id === id)?.name ?? id;
  const departmentLabel = (id: string) =>
    options.departments.find((department) => department.id === id)?.name ?? id;
  const roleLabels = options.roles
    .filter((role) => values.role_ids?.includes(role.id))
    .map((role) => role.display_name);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Group title="Profile">
          <Row label="Name">
            {values.first_name} {values.last_name}
          </Row>
          <Row label="Email">{values.email}</Row>
          <Row label="Phone">{values.phone}</Row>
          <Row label="Officer title">{values.officer_title}</Row>
        </Group>

        <Group title="Organisation">
          <Row label="Branches">
            {values.branch_ids?.map(branchLabel).join(', ')}
          </Row>
          <Row label="Active branch">
            {values.active_branch_id && branchLabel(values.active_branch_id)}
          </Row>
          <Row label="Departments">
            {values.department_ids?.map(departmentLabel).join(', ')}
          </Row>
          <Row label="Active department">
            {values.active_department_id &&
              departmentLabel(values.active_department_id)}
          </Row>
        </Group>

        {sections.includes('roles') && (
          <Group title="Roles">
            <Row label="Roles">
              {roleLabels.length > 0 && (
                <span className="flex flex-wrap gap-1">
                  {roleLabels.map((label) => (
                    <Badge key={label} variant="secondary">
                      {label}
                    </Badge>
                  ))}
                </span>
              )}
            </Row>
          </Group>
        )}

        {sections.includes('data_access') && (
          <Group title="Data access">
            <Row label="Data scope">
              {
                DATA_SCOPE_OPTIONS.find(
                  (option) =>
                    option.value === values.quotation_policy_data_scope,
                )?.label
              }
            </Row>
            <Row label="Insurance channel">
              {values.insurance_channel_access ? 'Can select' : 'No'}
            </Row>
          </Group>
        )}
      </div>

      <EffectivePermissionsPanel
        options={options}
        roleIds={values.role_ids ?? []}
        grants={values.permission_grants ?? []}
        excludedIds={values.excluded_permission_ids ?? []}
      />
    </div>
  );
}
