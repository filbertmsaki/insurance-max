import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { AppBarConfig } from '../AppBarConfig';
import { MobileAppBar } from '../MobileAppBar';

vi.mock('@/modules/shared/organization/api/organization', () => ({
  organizationApi: {
    getContext: vi.fn().mockResolvedValue({
      activeBranch: { id: 'b-1', name: 'HQ' },
      assignedBranches: [
        { id: 'b-1', name: 'HQ' },
        { id: 'b-2', name: 'Arusha' },
      ],
      assignedDepartments: [],
    }),
  },
}));

const USER = { name: 'Neema Kato', role: 'Company user', initials: 'NK' };

function renderBar({
  unreadCount = 3,
  page,
}: { unreadCount?: number; page?: React.ReactNode } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MobileAppBar
          user={USER}
          fallbackTitle="Quotations"
          unreadCount={unreadCount}
          drawerOpen={false}
          onMenu={vi.fn()}
          notificationsPath="/apps/notifications"
          profilePath="/apps/settings/profile"
          settingsPath="/apps/settings/number-format"
        />
        {page}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useAuthStore.setState({
    user: {
      id: 'user-1',
      companyId: 'company-1',
      roles: [],
      permissions: [],
      scope: 'company',
    },
  } as never);
});

describe('MobileAppBar', () => {
  it('is one surface with the shared divider and 44px controls in order', () => {
    renderBar();
    const bar = screen.getByRole('banner');
    expect(bar.className).toMatch(/border-\[var\(--color-divider\)\]/);
    expect(bar.className).toMatch(/bg-\[var\(--color-surface\)\]/);
    expect(bar.className).toMatch(/env\(safe-area-inset-top\)/);
    expect(
      screen.getByRole('heading', { name: 'Quotations' }),
    ).toBeInTheDocument();

    const names = within(bar)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'));
    expect(names).toEqual([
      'Open menu',
      'Search',
      'Notifications, 3 unread',
      'Account menu, Neema Kato',
    ]);
    for (const button of within(bar).getAllByRole('button')) {
      expect(button.className).toMatch(/h-11 w-11/);
    }
  });

  it('puts the avatar on a transparent button that opens the account menu', () => {
    renderBar();
    const account = screen.getByRole('button', {
      name: 'Account menu, Neema Kato',
    });
    expect(account).toHaveAttribute('aria-haspopup', 'menu');
    expect(account).toHaveAttribute('aria-expanded', 'false');
    expect(account.className).toMatch(/bg-transparent/);
    expect(account.className).not.toMatch(/bg-vz-body|bg-slate/);

    fireEvent.click(account);
    expect(account).toHaveAttribute('aria-expanded', 'true');
    const sheet = screen.getByRole('dialog', { name: 'Account menu' });
    expect(within(sheet).getByText('Neema Kato')).toBeInTheDocument();
    expect(within(sheet).getByText('Company user')).toBeInTheDocument();
    for (const label of ['Profile', 'Settings', 'Sign out']) {
      expect(
        within(sheet).getByRole('button', { name: label }),
      ).toBeInTheDocument();
    }
  });

  it('caps the unread count at 99+', () => {
    renderBar({ unreadCount: 140 });
    expect(
      screen.getByRole('button', { name: 'Notifications, 140 unread' }),
    ).toHaveTextContent('99+');
  });

  it('opens full-screen search with a Cancel button', () => {
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    const overlay = screen.getByRole('dialog', { name: 'Search' });
    expect(
      within(overlay).getByRole('searchbox', { name: 'Search' }),
    ).toBeInTheDocument();
    fireEvent.click(within(overlay).getByRole('button', { name: 'Cancel' }));
    expect(
      screen.queryByRole('dialog', { name: 'Search' }),
    ).not.toBeInTheDocument();
  });

  it('shows the inner variant for task flows: back arrow and step title only', () => {
    const onBack = vi.fn();
    renderBar({
      page: (
        <AppBarConfig
          variant="inner"
          title="New in-transit quotation"
          subtitle="Step 1 of 3 · Cover"
          onBack={onBack}
        />
      ),
    });
    const bar = screen.getByRole('banner');
    expect(within(bar).getByText('Step 1 of 3 · Cover')).toBeInTheDocument();
    expect(
      within(bar).getByRole('heading', { name: 'New in-transit quotation' }),
    ).toBeInTheDocument();
    expect(
      within(bar)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Back']);
    fireEvent.click(within(bar).getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('shows page actions in the bar', () => {
    renderBar({
      page: (
        <AppBarConfig variant="inner" title="QUO-1">
          <button type="button" aria-label="Quotation actions" />
        </AppBarConfig>
      ),
    });
    expect(
      within(screen.getByRole('banner')).getByRole('button', {
        name: 'Quotation actions',
      }),
    ).toBeInTheDocument();
  });
});
