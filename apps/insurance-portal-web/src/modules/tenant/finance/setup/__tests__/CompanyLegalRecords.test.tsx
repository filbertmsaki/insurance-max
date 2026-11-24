import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompanyLegalRecords } from '../CompanyLegalRecords';

const patch = vi.fn();
vi.mock('@/modules/shared/api/client', () => ({
  apiClient: { patch: (...args: unknown[]) => patch(...args) },
}));
const company = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Alliance',
  tira_license_number: 'LIC-1',
  tin: '123',
  brela_registration_number: 'BR-1',
  default_currency: 'TZS',
};
function mount(
  canEdit = true,
  jurisdiction = 'TZ',
  source?: Parameters<typeof CompanyLegalRecords>[0]['source'],
) {
  const refresh = vi.fn().mockResolvedValue(undefined);
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      <CompanyLegalRecords
        company={company}
        source={source}
        jurisdiction={jurisdiction}
        canEdit={canEdit}
        locked={false}
        onEditingChange={vi.fn()}
        refresh={refresh}
      />
    </QueryClientProvider>,
  );
  return { refresh };
}
beforeEach(() => {
  patch.mockReset();
  patch.mockResolvedValue({});
});
describe('Company legal records', () => {
  it('shows Zanzibar tax fields conditionally and patches only the changed registration', async () => {
    mount(true, 'TZ', {
      profile: {
        territory: 'ZANZIBAR',
        registry: 'BPRA',
        zanzibarVat: 'NOT_REGISTERED',
      },
      address: null,
      mainlandVrn: null,
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit company details' }),
    );
    expect(
      screen.queryByLabelText('Mainland VAT registration'),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('BPRA registration number'), {
      target: { value: 'BZ-456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/companies/my', {
        finance_profile_tz: { bpraNumber: 'BZ-456' },
      }),
    );
  });
  it('updates only the current company and allows clearing an identifier', async () => {
    const { refresh } = mount();
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit company details' }),
    );
    fireEvent.change(screen.getByLabelText('TIN'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/companies/my', { tin: null }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
  it('hides editing without company update permission', () => {
    mount(false);
    expect(
      screen.queryByRole('button', { name: 'Edit company details' }),
    ).not.toBeInTheDocument();
  });
  it('does not overwrite Tanzanian identifiers for another jurisdiction', async () => {
    mount(true, 'KE');
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit company details' }),
    );
    expect(screen.queryByLabelText('TIN')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Company name'), {
      target: { value: 'Alliance Ltd' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/companies/my', {
        name: 'Alliance Ltd',
      }),
    );
  });
});
