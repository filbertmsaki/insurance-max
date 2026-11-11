import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { UnderwriteAccessMatrix } from './UnderwriteAccessMatrix';
import type { UserAccessOptions } from '@/modules/tenant/users/api/users';
import {
  DATA_SCOPE_OPTIONS,
  INHERIT_SCOPE,
  type PermissionGrantValues,
} from '@/modules/tenant/users/schemas/user-form.schema';

const SCOPE_LABEL = Object.fromEntries(
  DATA_SCOPE_OPTIONS.map((option) => [option.value, option.label]),
);

/** Every permission the user ends up with, labelled by where it comes from. */
export function EffectivePermissionsPanel({
  options,
  roleIds,
  grants,
  excludedIds = [],
}: {
  options: UserAccessOptions;
  roleIds: string[];
  grants: PermissionGrantValues[];
  /** Role permissions removed for this user. */
  excludedIds?: string[];
}) {
  const rows = useMemo(() => {
    const byName = new Map<
      string,
      { name: string; label: string; sources: string[] }
    >();
    const add = (name: string, label: string, source: string) => {
      const row = byName.get(name) ?? { name, label, sources: [] };
      row.sources.push(source);
      byName.set(name, row);
    };

    options.roles
      .filter((role) => roleIds.includes(role.id))
      .forEach((role) =>
        role.permissions
          .filter((permission) => !excludedIds.includes(permission.id))
          .forEach((permission) =>
            add(permission.name, permission.display_name, role.display_name),
          ),
      );

    grants.forEach((grant) => {
      const permission = options.permissions.find(
        (item) => item.id === grant.permission_id,
      );
      if (!permission) return;
      const scope =
        grant.data_scope === INHERIT_SCOPE
          ? ''
          : ` · ${SCOPE_LABEL[grant.data_scope]}`;
      add(permission.name, permission.display_name, `Extra${scope}`);
    });

    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [options, roleIds, grants, excludedIds]);

  return (
    <div className="space-y-3">
      <UnderwriteAccessMatrix permissionNames={rows.map((row) => row.name)} />
      <div className="rounded-md border border-slate-200 bg-slate-50/60">
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
          <p className="text-sm font-semibold text-slate-900">
            Effective permissions
          </p>
          <Badge variant="muted">{rows.length}</Badge>
        </div>
        {rows.length ? (
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {rows.map((row) => (
              <li key={row.name} className="px-3 py-2">
                <p className="text-sm text-slate-800">{row.label}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {row.sources.map((source) => (
                    <Badge
                      key={source}
                      variant={
                        source.startsWith('Extra') ? 'primary' : 'outline'
                      }
                      className="text-[10px] font-normal"
                    >
                      {source}
                    </Badge>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 py-4 text-sm text-slate-500">
            No permissions yet. Select a role or an extra permission.
          </p>
        )}
      </div>
    </div>
  );
}
