import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { UnderwriteLine } from '@insurance-max/contracts';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { MotorTransactionRegisterPage } from '../pages/MotorTransactionRegisterPage';
import { MotorTransactionsRedirect } from '../components/MotorTransactionsRedirect';
import { MotorCancellationCreatePage } from '../pages/MotorPolicyTransactionPages';
import { buildMotorInsuranceScope } from '../scope';

vi.mock('@/modules/tenant/underwrite/components/TransactionRows', () => ({
  TransactionRows: ({ kind }: { kind: string }) => (
    <div data-testid="rows">{kind}</div>
  ),
  RenewalRows: () => <div data-testid="rows">renewals</div>,
  TiraRows: ({ kind }: { kind: string }) => (
    <div data-testid="rows">tira-{kind}</div>
  ),
}));

vi.mock('@/modules/tenant/underwrite/lazy-pages', () => ({
  PolicyCancellationPage: () => <div data-testid="cancel-whole-policy" />,
  PolicyEndorsementPage: () => <div data-testid="endorsement" />,
  PolicyRenewalPage: () => <div data-testid="renewal" />,
}));

const scopeLine = vi.hoisted(() => ({ value: 'FLEET' as string }));
vi.mock('../components/MotorPolicyScope', () => ({
  MotorPolicyScope: ({
    children,
  }: {
    children: (line: UnderwriteLine) => ReactNode;
  }) => <>{children(scopeLine.value as UnderwriteLine)}</>,
}));

function setPermissions(permissions: string[]) {
  useAuthStore.setState({
    user: {
      id: 'user-1',
      companyId: 'company-1',
      roles: ['UNDERWRITER'],
      permissions,
      scope: 'company',
    },
  } as never);
}

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">{location.pathname + location.search}</div>
  );
}

describe('Independent Motor transaction register pages', () => {
  it.each([
    ['endorsements', 'Endorsements', 'endorsements'],
    ['renewals', 'Renewals', 'renewals'],
    ['cancellations', 'Cancellations', 'cancellations'],
    ['tira-pending', 'TIRAMIS Pending', 'tira-pending'],
  ] as const)('opens %s as a page without tabs', (kind, title, rows) => {
    render(
      <MemoryRouter>
        <MotorTransactionRegisterPage kind={kind} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByTestId('rows')).toHaveTextContent(rows);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Policy Transactions' }),
    ).not.toBeInTheDocument();
  });
  it.each([
    ['renewals', '/apps/motor/renewals?page=2'],
    ['tira-failed', '/apps/motor/quotations?tira_status=FAILED&page=2'],
  ])(
    'redirects an old %s bookmark without mounting a table',
    (kind, target) => {
      setPermissions(['underwrite.fleet.renewals.view', 'renewals:read']);
      render(
        <MemoryRouter
          initialEntries={['/apps/motor/transactions?tab=' + kind + '&page=2']}
        >
          <Routes>
            <Route
              path="/apps/motor/transactions"
              element={<MotorTransactionsRedirect />}
            />
            <Route path="*" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>,
      );
      expect(screen.getByTestId('location')).toHaveTextContent(target);
      expect(screen.queryByTestId('rows')).not.toBeInTheDocument();
    },
  );
});

describe('MotorCancellationCreatePage', () => {
  beforeEach(() =>
    setPermissions([
      'cancellations:create',
      'endorsements:create',
      'underwrite.fleet.endorsements.manage',
      'underwrite.fleet.cancellations.manage',
    ]),
  );

  function renderAt(url: string) {
    return render(
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route
            path="/apps/motor/policies/:policyId/cancellations/new"
            element={<MotorCancellationCreatePage />}
          />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('asks a fleet whether to remove vehicles or cancel the whole policy', () => {
    scopeLine.value = 'FLEET';
    renderAt('/apps/motor/policies/p-1/cancellations/new');

    expect(screen.getByText('Remove vehicles')).toBeInTheDocument();
    expect(screen.getByText('Cancel the whole policy')).toBeInTheDocument();
    expect(screen.queryByTestId('cancel-whole-policy')).toBeNull();
  });

  it('sends "Remove vehicles" to a FLEET_REMOVE_VEHICLE endorsement', () => {
    scopeLine.value = 'FLEET';
    renderAt('/apps/motor/policies/p-1/cancellations/new');

    fireEvent.click(screen.getByText('Remove vehicles'));

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/apps/motor/policies/p-1/endorsements/new?type=FLEET_REMOVE_VEHICLE',
    );
  });

  it('opens the whole-policy cancellation after choosing it', () => {
    scopeLine.value = 'FLEET';
    renderAt('/apps/motor/policies/p-1/cancellations/new?scope=policy');

    expect(screen.getByTestId('cancel-whole-policy')).toBeInTheDocument();
  });

  it('goes straight to cancellation for Single Motor', () => {
    scopeLine.value = 'MOTOR';
    renderAt('/apps/motor/policies/p-1/cancellations/new');

    expect(screen.getByTestId('cancel-whole-policy')).toBeInTheDocument();
  });

  it('disables "Remove vehicles" without fleet endorsement rights', () => {
    scopeLine.value = 'FLEET';
    setPermissions([
      'cancellations:create',
      'underwrite.fleet.cancellations.manage',
    ]);
    renderAt('/apps/motor/policies/p-1/cancellations/new');

    expect(
      screen.getByText('Remove vehicles').closest('button'),
    ).toBeDisabled();
  });
});

describe('buildMotorInsuranceScope transaction links', () => {
  it('keeps endorsement, cancellation and renewal links in the module', () => {
    const { paths } = buildMotorInsuranceScope('fleet');

    expect(paths.policyEndorsementCreate('p-1')).toBe(
      '/apps/motor/policies/p-1/endorsements/new',
    );
    expect(paths.policyCancellationDetail('p-1', 'c-1')).toBe(
      '/apps/motor/policies/p-1/cancellations/c-1',
    );
    expect(paths.policyRenewalDetail('p-1', 'r-1')).toBe(
      '/apps/motor/policies/p-1/renewals/r-1',
    );
  });
});
