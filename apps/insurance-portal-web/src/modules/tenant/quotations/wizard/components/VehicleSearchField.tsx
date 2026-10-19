import type { Ref } from 'react';
import { PencilLine, ShieldCheck } from 'lucide-react';
import {
  AsyncCombobox,
  type AsyncComboboxOption,
} from '@/components/ui/async-combobox';
import { motorApi } from '@/modules/tenant/motor/api';
import type { MotorVehicleSearchResult } from '@/modules/tenant/motor/types';
import { getMotorTypeLabelFromCode } from '../utils/motorOptions';

const MIN_SEARCH_LENGTH = 2;
/** TIRA needs a full registration or chassis number. */
const MIN_TIRA_LOOKUP_LENGTH = 3;

// eslint-disable-next-line react-refresh/only-export-components
export function vehicleSearchOption(
  vehicle: MotorVehicleSearchResult,
  customerId?: string,
): AsyncComboboxOption {
  const title = [
    vehicle.registration_no,
    [vehicle.make, vehicle.model].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(' — ');
  return {
    value: vehicle.id,
    label: title || vehicle.chassis_no_masked || 'Vehicle',
    description: [
      vehicle.chassis_no_masked ? `Chassis ${vehicle.chassis_no_masked}` : null,
      vehicle.manufacture_year,
      getMotorTypeLabelFromCode(vehicle.motor_type) || null,
      vehicle.customer && vehicle.customer.id !== customerId
        ? `Owner: ${vehicle.customer.name}`
        : null,
    ]
      .filter(Boolean)
      .join(' · '),
  };
}

/**
 * One search box for registration or chassis number over the company's
 * vehicle register; TIRA lookup and manual entry are offered underneath.
 */
export function VehicleSearchField({
  id,
  customerId,
  onSelect,
  onTiraLookup,
  onEnterManually,
  invalid,
  triggerRef,
}: {
  /** Lets a <label htmlFor> name the field. */
  id?: string;
  /** Ranks this customer's vehicles first. */
  customerId?: string;
  /** Receives the register entry's ID; load the full record from it. */
  onSelect: (vehicleId: string) => void;
  onTiraLookup: (search: string) => void;
  onEnterManually: (search: string) => void;
  invalid?: boolean;
  triggerRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <AsyncCombobox
      id={id}
      ref={triggerRef}
      queryKey={['quotations', 'vehicle-search', customerId ?? '']}
      fetchOptions={async (search, limit, signal) => {
        const page = await motorApi.searchVehicles(
          { q: search, customer_id: customerId || undefined, limit },
          signal,
        );
        return {
          options: page.data.map((vehicle) =>
            vehicleSearchOption(vehicle, customerId),
          ),
          hasMore: page.pagination?.hasNextPage ?? false,
        };
      }}
      onValueChange={(value) => onSelect(value)}
      placeholder="Search vehicle by registration or chassis number"
      searchPlaceholder="Registration or chassis number"
      emptyText="Not in the vehicle register."
      minSearchLength={MIN_SEARCH_LENGTH}
      minSearchHint="Type at least 2 characters to search."
      aria-invalid={invalid}
      aria-required
      actions={[
        {
          key: 'tira',
          icon: <ShieldCheck className="h-4 w-4" />,
          label: (search) => `Search TIRA for "${search}"`,
          hidden: (search) =>
            search.replace(/[^A-Za-z0-9]/g, '').length < MIN_TIRA_LOOKUP_LENGTH,
          onSelect: onTiraLookup,
        },
        {
          key: 'manual',
          icon: <PencilLine className="h-4 w-4" />,
          label: () => 'Enter vehicle details manually',
          onSelect: onEnterManually,
        },
      ]}
    />
  );
}
