import { useMemo } from 'react';
import {
  UNDERWRITE_COVER_ACTIONS,
  UNDERWRITE_COVERS,
  type UnderwriteActionValue,
  type UnderwriteCover,
  underwriteActionLabel,
  underwriteCoverActions,
  underwriteCoverGrantSource,
  underwriteCoverPermission,
} from '@insurance-max/contracts';
import { cn } from '@/lib/utils';

/** Base permission each cover action also needs (the API checks both). */
const BASE_PERMISSION: Partial<Record<UnderwriteActionValue, string[]>> = {
  view: ['quotations:read'],
  create: ['quotations:create'],
  edit: ['quotations:update'],
  delete: ['quotations:delete-draft'],
  submit: [
    'quotations:submit-approval',
    'quotations:request-payment',
    'quotations:submit-tiramis',
  ],
  approve: ['quotations:approve'],
  'policies.view': ['policies:read'],
  'tira.retry': ['quotations:retry-tiramis'],
};

const SHORT_LABEL: Record<string, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  submit: 'Submit',
  approve: 'Approve',
  'policies.view': 'Policies',
  'tira.retry': 'TIRA retry',
};

/**
 * Underwriting access by cover (product, risk and quotation type) and
 * action. Shows where each grant comes from: the whole line (which includes
 * its Short-Term cover) or the restricted cover alone. With `onToggle` the
 * cells edit the underlying permissions.
 */
export function UnderwriteAccessMatrix({
  permissionNames,
  onToggle,
  isAssignable,
}: {
  /** Effective permission names (roles, minus exclusions, plus grants). */
  permissionNames: string[];
  /** Editable mode: grant or revoke the permission behind a cell. */
  onToggle?: (permissionName: string, granted: boolean) => void;
  /** Hides cells whose permission does not exist in this installation. */
  isAssignable?: (permissionName: string) => boolean;
}) {
  const held = useMemo(() => new Set(permissionNames), [permissionNames]);

  const missingBase = useMemo(() => {
    const missing = new Set<string>();
    for (const definition of UNDERWRITE_COVERS) {
      for (const action of UNDERWRITE_COVER_ACTIONS) {
        if (!underwriteCoverGrantSource(held, definition.cover, action))
          continue;
        const base = BASE_PERMISSION[action];
        if (base && !base.some((name) => held.has(name))) {
          missing.add(`${SHORT_LABEL[action]} needs ${base.join(' or ')}`);
        }
      }
    }
    return [...missing];
  }, [held]);

  const cell = (cover: UnderwriteCover, action: UnderwriteActionValue) => {
    if (!underwriteCoverActions(cover).includes(action)) {
      return <span className="text-slate-300">—</span>;
    }
    const own = underwriteCoverPermission(cover, action);
    const source = underwriteCoverGrantSource(held, cover, action);
    const label = `${underwriteActionLabel(action)}: ${cover}`;
    if (onToggle && (!isAssignable || isAssignable(own))) {
      const ownHeld = held.has(own);
      const inherited = source === 'LINE' && !ownHeld;
      return (
        <input
          type="checkbox"
          aria-label={label}
          className="h-4 w-4 accent-blue-600"
          checked={ownHeld || inherited}
          disabled={inherited}
          title={inherited ? 'Included in the line grant' : undefined}
          onChange={(event) => onToggle(own, event.target.checked)}
        />
      );
    }
    return (
      <span
        aria-label={`${label}: ${source ?? 'not granted'}`}
        className={cn(
          'inline-block rounded px-1.5 py-0.5 text-[10px] font-medium',
          source === 'COVER' && 'bg-blue-100 text-blue-800',
          source === 'LINE' && 'bg-emerald-100 text-emerald-800',
          !source && 'text-slate-300',
        )}
      >
        {source === 'COVER' ? 'Cover' : source === 'LINE' ? 'Line' : '—'}
      </span>
    );
  };

  return (
    <div className="rounded-md border border-slate-200">
      <div className="border-b border-slate-200 px-3 py-2">
        <p className="text-sm font-semibold text-slate-900">
          Underwriting access
        </p>
        <p className="text-xs text-slate-500">
          Grants add up. A line (Motor, Fleet) includes its Short-Term cover; a
          Short-Term grant never includes ordinary Motor or Fleet business. Data
          scope (own, branch, department, company) still applies.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-slate-500">
              <th className="px-3 py-2 font-medium">Cover</th>
              {UNDERWRITE_COVER_ACTIONS.map((action) => (
                <th key={action} className="px-2 py-2 text-center font-medium">
                  {SHORT_LABEL[action]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {UNDERWRITE_COVERS.map((definition) => (
              <tr key={definition.cover}>
                <th scope="row" className="px-3 py-2 font-normal">
                  <span className="block font-medium text-slate-800">
                    {definition.label}
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    {definition.description}
                  </span>
                </th>
                {UNDERWRITE_COVER_ACTIONS.map((action) => (
                  <td key={action} className="px-2 py-2 text-center">
                    {cell(definition.cover, action)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {missingBase.length > 0 && (
        <ul
          role="status"
          className="space-y-0.5 border-t border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
        >
          {missingBase.map((item) => (
            <li key={item}>Missing dependency: {item}.</li>
          ))}
        </ul>
      )}
    </div>
  );
}
