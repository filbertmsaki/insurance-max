import { useFormContext, useWatch } from 'react-hook-form';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { UserAccessOptions } from '@/modules/tenant/users/api/users';
import {
  DATA_SCOPE_OPTIONS,
  type DataAccessValues,
} from '@/modules/tenant/users/schemas/user-form.schema';
import { SectionHeading } from './SelectableCard';

export function DataAccessSection({ options }: { options: UserAccessOptions }) {
  const { control, setValue } = useFormContext<DataAccessValues>();
  // User Only is the default (see EMPTY_ACCESS_VALUES); the radios always
  // show exactly one choice.
  const scope =
    useWatch({ control, name: 'quotation_policy_data_scope' }) ?? 'USER';
  const channel = useWatch({ control, name: 'insurance_channel_access' });

  return (
    <div className="space-y-6">
      <section>
        <SectionHeading
          title="Data scope"
          description="Which quotations and policies the user can see. Extra permissions can narrow or widen this per permission."
        />
        <div
          role="radiogroup"
          aria-label="Data scope"
          className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4"
        >
          {DATA_SCOPE_OPTIONS.map((option) => {
            const selected = scope === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() =>
                  setValue('quotation_policy_data_scope', option.value, {
                    shouldDirty: true,
                  })
                }
                className={cn(
                  'flex items-start gap-3 rounded-md border px-3 py-2.5 text-left transition-colors',
                  selected
                    ? 'border-blue-300 bg-blue-50/60 ring-1 ring-blue-300'
                    : 'border-slate-200 bg-white hover:border-slate-300',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                    selected ? 'border-blue-600' : 'border-slate-300 bg-white',
                  )}
                >
                  {selected && (
                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-900">
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {option.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <SectionHeading title="Insurance channel" />
        <label className="flex items-start justify-between gap-4 rounded-md border border-slate-200 bg-white px-3 py-2.5 md:max-w-xl">
          <span>
            <span className="block text-sm font-medium text-slate-900">
              Can select the insurance channel on quotations
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">
              {options.can_grant_insurance_channel
                ? 'Granted to this user only, never through a role.'
                : 'You can remove this access, but only users who hold it can grant it.'}
            </span>
          </span>
          <Switch
            checked={channel}
            disabled={!channel && !options.can_grant_insurance_channel}
            onCheckedChange={(checked) =>
              setValue('insurance_channel_access', checked, {
                shouldDirty: true,
              })
            }
          />
        </label>
      </section>
    </div>
  );
}
