import type { ReactNode } from 'react';
import type { DataTableFilter } from '@/components/data-table';
import {
  RecordMobileList,
  type RecordListChip,
  type RecordListSort,
} from '@/components/record-list/RecordMobileList';
import { formatMoney } from '@/modules/shared/formatting/number-format';
import type { QuotationListItem } from '@/modules/tenant/quotations/types';
import type { SortOrder } from '@/types';

/** Phone-only (<768px) view of the Motor Insurance quotation register. */

export type MotorTypeChip = '' | 'single' | 'fleet';

const TYPE_CHIPS: RecordListChip[] = [
  { value: '', label: 'All' },
  { value: 'single', label: 'Single' },
  { value: 'fleet', label: 'Fleet' },
];

const SORTS: RecordListSort[] = [
  { value: 'newest', label: 'Newest', sortBy: 'created_at', order: 'DESC' },
  { value: 'oldest', label: 'Oldest', sortBy: 'created_at', order: 'ASC' },
  {
    value: 'premium',
    label: 'Premium',
    sortBy: 'total_premium_including_tax',
    order: 'DESC',
  },
];

interface MotorQuotationMobileListProps {
  rows: QuotationListItem[];
  total: number;
  loading: boolean;
  isFetching: boolean;
  error?: string;
  onRetry: () => void;
  onRefresh: () => Promise<unknown>;
  search: string;
  onSearchChange: (value: string) => void;
  type: MotorTypeChip;
  onTypeChange: (value: MotorTypeChip) => void;
  sortBy?: string;
  sortOrder?: SortOrder;
  onSortChange: (key: string, order: SortOrder) => void;
  filters: DataTableFilter[];
  onFilterChange: (key: string, value: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onOpen: (row: QuotationListItem) => void;
  onCreate?: () => void;
  sheetExtras?: ReactNode;
}

export function MotorQuotationMobileList({
  onTypeChange,
  ...props
}: MotorQuotationMobileListProps) {
  return (
    <RecordMobileList<QuotationListItem>
      {...props}
      onTypeChange={(value) => onTypeChange(value as MotorTypeChip)}
      noun={{ one: 'quotation', many: 'quotations' }}
      searchLabel="Search by quotation no. or customer"
      searchHint="Try a different quotation number or customer name."
      chips={TYPE_CHIPS}
      sorts={SORTS}
      createLabel="New quotation"
      getRow={(row) => {
        const fleet = row.quotation_flow === 'MOTOR_FLEET';
        const premium = Number.isFinite(row.total_premium_including_tax)
          ? formatMoney(row.total_premium_including_tax, row.currency_code)
          : '—';
        return {
          id: row.id,
          title: row.quotation_no,
          badge: {
            label: fleet ? 'Fleet' : 'Single',
            tone: fleet ? 'primary' : 'muted',
          },
          subtitle: row.customer_name || 'No customer',
          amount: premium,
          amountLabel: 'Premium',
          ariaLabel: `Quotation ${row.quotation_no}, ${row.customer_name || 'no customer'}, premium ${premium}`,
        };
      }}
    />
  );
}
