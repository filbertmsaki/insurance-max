import { useDeferredValue, useMemo, useState } from 'react';
import { Combobox } from '@/components/ui/combobox';
import { useVehicleReference } from '@/modules/platform/reference-data/hooks';

export type VehicleReferenceKind =
  | 'makes'
  | 'models'
  | 'body_type'
  | 'colour'
  | 'fuel_type';

export function VehicleReferencePicker({
  kind,
  value,
  onValueChange,
  makeId,
  disabled,
  placeholder,
  searchPlaceholder,
  ariaRequired,
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
}: {
  kind: VehicleReferenceKind;
  value: string;
  onValueChange: (value: string) => void;
  makeId?: string;
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  ariaRequired?: boolean;
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}) {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const needsMake = kind === 'models';
  const query = useVehicleReference(
    kind,
    {
      search: deferredSearch.trim() || undefined,
      make_id: needsMake ? makeId : undefined,
      is_active: true,
    },
    !disabled && (!needsMake || Boolean(makeId)),
  );
  const options = useMemo(() => {
    const active = (query.data ?? []).map((row) => ({
      value: row.name,
      label: row.name,
    }));
    if (
      value &&
      !active.some(
        (option) =>
          option.value.toLocaleLowerCase() === value.toLocaleLowerCase(),
      )
    ) {
      active.unshift({ value, label: `${value} (saved value)` });
    }
    return active;
  }, [query.data, value]);

  return (
    <Combobox
      value={value}
      options={options}
      placeholder={placeholder ?? `Select ${kind.replace('_', ' ')}`}
      searchPlaceholder={
        searchPlaceholder ?? `Search ${kind.replace('_', ' ')}`
      }
      emptyText="No matching active reference values"
      loading={query.isLoading || query.isFetching}
      onSearchChange={setSearch}
      disabled={disabled}
      id={id}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
      aria-required={ariaRequired}
      onValueChange={onValueChange}
    />
  );
}
