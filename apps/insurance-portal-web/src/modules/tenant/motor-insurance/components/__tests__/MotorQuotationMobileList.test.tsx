import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { QuotationListItem } from '@/modules/tenant/quotations/types';
import { MotorQuotationMobileList } from '../MotorQuotationMobileList';

const row = (over: Partial<QuotationListItem>) =>
  ({
    id: 'q1',
    quotation_no: 'MQ-0001',
    customer_name: 'Juma Hassan',
    quotation_flow: 'MOTOR_SINGLE',
    total_premium_including_tax: 125000,
    currency_code: 'TZS',
    ...over,
  }) as QuotationListItem;

function setup(
  props: Partial<Parameters<typeof MotorQuotationMobileList>[0]> = {},
) {
  const handlers = {
    onOpen: vi.fn(),
    onTypeChange: vi.fn(),
    onCreate: vi.fn(),
  };
  render(
    <MotorQuotationMobileList
      rows={[
        row({}),
        row({
          id: 'q2',
          quotation_no: 'MQ-0002',
          quotation_flow: 'MOTOR_FLEET',
        }),
      ]}
      total={2}
      loading={false}
      isFetching={false}
      onRetry={vi.fn()}
      onRefresh={() => Promise.resolve()}
      search=""
      onSearchChange={vi.fn()}
      type=""
      onTypeChange={handlers.onTypeChange}
      sortBy="created_at"
      sortOrder="DESC"
      onSortChange={vi.fn()}
      filters={[]}
      onFilterChange={vi.fn()}
      page={1}
      totalPages={1}
      onPageChange={vi.fn()}
      onOpen={handlers.onOpen}
      onCreate={handlers.onCreate}
      {...props}
    />,
  );
  return handlers;
}

describe('MotorQuotationMobileList', () => {
  it('renders rows with type badge, count and opens a row on tap', () => {
    const h = setup();
    expect(screen.getByText('2 quotations')).toBeInTheDocument();
    expect(screen.getAllByText('Fleet')).toHaveLength(2); // chip + badge
    fireEvent.click(screen.getByRole('button', { name: /Quotation MQ-0002/ }));
    expect(h.onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'q2' }),
    );
  });

  it('changes the type filter from the chips and shows the FAB', () => {
    const h = setup();
    fireEvent.click(screen.getByRole('radio', { name: 'Fleet' }));
    expect(h.onTypeChange).toHaveBeenCalledWith('fleet');
    fireEvent.click(screen.getByRole('button', { name: /New quotation/ }));
    expect(h.onCreate).toHaveBeenCalled();
  });

  it('shows a type-specific empty state', () => {
    setup({ rows: [], total: 0, type: 'fleet' });
    expect(screen.getByText('No fleet quotations yet')).toBeInTheDocument();
  });
});
