import { useFormContext, useWatch } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import type { UserAccessOptions } from '@/modules/tenant/users/api/users';
import type { RolesValues } from '@/modules/tenant/users/schemas/user-form.schema';
import { SectionHeading, SelectableCard } from './SelectableCard';

export function RolesSection({ options }: { options: UserAccessOptions }) {
  const { control, setValue } = useFormContext<RolesValues>();
  const roleIds = useWatch({ control, name: 'role_ids' }) ?? [];

  const toggle = (roleId: string, checked: boolean) =>
    setValue(
      'role_ids',
      checked ? [...roleIds, roleId] : roleIds.filter((id) => id !== roleId),
      { shouldDirty: true },
    );

  return (
    <section>
      <SectionHeading
        title="Roles"
        description="Roles are the main way to give access. The user gets every permission in each selected role."
      />
      {options.roles.length ? (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {options.roles.map((role) => (
            <SelectableCard
              key={role.id}
              checked={roleIds.includes(role.id)}
              onCheckedChange={(checked) => toggle(role.id, checked)}
              title={role.display_name}
              description={role.description ?? role.name}
              badges={
                <>
                  {role.is_administrative && (
                    <Badge variant="warning" className="text-[10px]">
                      Administrator
                    </Badge>
                  )}
                  <Badge variant="muted" className="text-[10px]">
                    {role.permissions.length} permissions
                  </Badge>
                </>
              }
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          No roles are available to assign in this company.
        </p>
      )}
    </section>
  );
}
