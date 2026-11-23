import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductScopeSelector } from '../ProductScopeSelector';

const products = [
  {
    id: 'p1',
    product_code: 'M1',
    product_name: 'Motor cover',
    is_active: true,
    lifecycle_status: 'ACTIVE',
    current_version_id: 'v1',
  },
  {
    id: 'p2',
    product_code: 'M2',
    product_name: 'Fleet cover',
    is_active: true,
    lifecycle_status: 'ACTIVE',
    current_version_id: 'v2',
  },
  {
    id: 'p3',
    product_code: 'C1',
    product_name: 'Marine cover',
    is_active: true,
    lifecycle_status: 'ACTIVE',
    current_version_id: 'v3',
  },
];
const categories = [
  { product_id: 'p1', category_id: 'motor', category_name: 'Motor' },
  { product_id: 'p2', category_id: 'motor', category_name: 'Motor' },
  { product_id: 'p3', category_id: 'marine', category_name: 'Marine' },
];
function Fixture({ disabled = false }: { disabled?: boolean }) {
  const [ids, setIds] = useState<string[]>(['p3']);
  return (
    <ProductScopeSelector
      products={products}
      categories={categories}
      selected={ids}
      onChange={setIds}
      disabled={disabled}
    />
  );
}
describe('Product scope selector', () => {
  it('selects and clears a category without changing hidden selections', () => {
    render(<Fixture />);
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'motor' },
    });
    expect(screen.queryByText(/Marine cover/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Select all shown' }));
    expect(screen.getByText('3 selected · 2 shown')).toBeInTheDocument();
    expect(screen.getByLabelText(/Motor cover/)).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Clear shown' }));
    expect(screen.getByText('1 selected · 2 shown')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: '' },
    });
    expect(screen.getByLabelText(/Marine cover/)).toBeChecked();
  });
  it('selects all products and filters by code or name', () => {
    render(<Fixture />);
    fireEvent.click(screen.getByRole('button', { name: 'Select all shown' }));
    expect(screen.getByText('3 selected · 3 shown')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search products'), {
      target: { value: 'm2' },
    });
    const group = screen.getByRole('group', { name: 'Products in scope' });
    expect(within(group).getAllByRole('checkbox')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Clear shown' }));
    expect(screen.getByText('2 selected · 1 shown')).toBeInTheDocument();
  });
  it('keeps selection controls disabled in review mode', () => {
    render(<Fixture disabled />);
    expect(
      screen.getByRole('button', { name: 'Select all shown' }),
    ).toBeDisabled();
    expect(screen.getByLabelText(/Marine cover/)).toBeDisabled();
    expect(screen.getByLabelText('Category')).toBeEnabled();
  });
});
