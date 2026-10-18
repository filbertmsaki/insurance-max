import type { Ref } from 'react';
import { UserPlus } from 'lucide-react';
import {
  AsyncCombobox,
  type AsyncComboboxOption,
} from '@/components/ui/async-combobox';
import { customersApi } from '@/modules/tenant/customers/api';
import {
  CUSTOMER_ID_TYPE_OPTIONS,
  type CustomerSearchResult,
} from '@/modules/tenant/customers/types';

const MIN_SEARCH_LENGTH = 2;

/** "National Identification Number (NIN)" → "NIN". */
function shortIdTypeLabel(idType: CustomerSearchResult['id_type']) {
  const label = CUSTOMER_ID_TYPE_OPTIONS.find(
    (option) => option.value === idType,
  )?.label;
  return label?.match(/\(([^)]+)\)/)?.[1] ?? label ?? 'ID';
}

// eslint-disable-next-line react-refresh/only-export-components
export function customerSearchOption(
  customer: CustomerSearchResult,
): AsyncComboboxOption {
  return {
    value: customer.id,
    label: customer.name || customer.customer_no,
    description: [
      customer.customer_no,
      customer.phone,
      customer.id_number_masked
        ? `${shortIdTypeLabel(customer.id_type)} ${customer.id_number_masked}`
        : null,
      customer.customer_type === 'CORPORATE' ? 'Corporate' : 'Individual',
    ]
      .filter(Boolean)
      .join(' · '),
  };
}

async function searchCustomerOptions(
  search: string,
  limit: number,
  signal: AbortSignal,
) {
  const page = await customersApi.searchCustomers({ q: search, limit }, signal);
  return {
    options: page.data.map(customerSearchOption),
    hasMore: page.pagination?.hasNextPage ?? false,
  };
}

/**
 * One search box for name, phone, ID or customer number, searched on the
 * server under the user's customer scope.
 */
export function CustomerSearchField({
  id,
  value,
  selectedLabel,
  onSelect,
  onCreateNew,
  invalid,
  triggerRef,
}: {
  /** Set by FormControl so the form label names the field. */
  id?: string;
  value: string;
  selectedLabel?: string;
  onSelect: (customerId: string) => void;
  /** Offered under the results; receives what the user typed. */
  onCreateNew?: (search: string) => void;
  invalid?: boolean;
  triggerRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <AsyncCombobox
      id={id}
      ref={triggerRef}
      queryKey={['quotations', 'customer-search']}
      fetchOptions={searchCustomerOptions}
      value={value}
      selectedLabel={selectedLabel}
      onValueChange={(next) => onSelect(next)}
      placeholder="Search customer by name, phone or ID number"
      searchPlaceholder="Name, phone, ID or customer number"
      emptyText="No matching customer found."
      minSearchLength={MIN_SEARCH_LENGTH}
      minSearchHint="Type at least 2 characters to search."
      aria-invalid={invalid}
      aria-required
      actions={
        onCreateNew
          ? [
              {
                key: 'create-customer',
                icon: <UserPlus className="h-4 w-4" />,
                label: () => 'Create new customer',
                onSelect: onCreateNew,
              },
            ]
          : []
      }
    />
  );
}
