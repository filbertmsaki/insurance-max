import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CustomerRecord } from '../types';
import { CustomerForm } from './CustomerForm';

vi.mock(
  '@/modules/platform/reference-data/components/LocationReferenceSelects',
  () => ({ LocationReferenceSelects: () => null }),
);

describe('CustomerForm edit values', () => {
  it('selects saved gender and ID type', async () => {
    const customer = {
      id: 'customer-1',
      customer_type: 'INDIVIDUAL',
      gender: 'F',
      id_type: 3,
      id_number: 'P123456',
    } as CustomerRecord;

    const onSubmit = vi.fn();
    const { rerender } = render(
      <CustomerForm
        customer={customer}
        isPending={false}
        submitLabel="Save Changes"
        onSubmit={onSubmit}
      />,
    );

    await waitFor(() => {
      const gender = screen.getByRole('combobox', { name: 'Gender' });
      const idType = screen.getByRole('combobox', { name: 'ID Type' });
      expect(gender.parentElement?.querySelector('select')).toHaveValue('F');
      expect(idType.parentElement?.querySelector('select')).toHaveValue('3');
      expect(gender).toHaveTextContent('Female');
      expect(idType).toHaveTextContent('Passport Number');
    });

    rerender(
      <CustomerForm
        customer={{ ...customer, id: 'customer-2', gender: 'M', id_type: 1 }}
        isPending={false}
        submitLabel="Save Changes"
        onSubmit={onSubmit}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('combobox', { name: 'Gender' }),
      ).toHaveTextContent('Male');
      expect(
        screen.getByRole('combobox', { name: 'ID Type' }),
      ).toHaveTextContent('National Identification Number (NIN)');
    });
  });
});
