import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import {
  defaultWizardNavigation,
  useWizardNavigation,
} from '@/modules/tenant/underwrite/wizard/wizardNavigation';
import { MotorWizardNavigation } from '../components/MotorWizardNavigation';
import { MotorQuotationCreatePage } from '../pages/MotorQuotationCreatePage';

// The real wizards are covered by their own tests; here we only need to know
// which one the page mounted and where it would navigate.
vi.mock('@/modules/tenant/underwrite/lazy-pages', () => ({
  MotorQuotationWizardPage: () => <WizardProbe name="single-wizard" />,
  FleetQuotationWizardPage: () => <WizardProbe name="fleet-wizard" />,
}));

function WizardProbe({ name }: { name: string }) {
  const nav = useWizardNavigation();
  return <div data-testid={name}>{nav.quotationEdit('motor', 'q-1')}</div>;
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.search}</div>;
}

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

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/apps/motor/quotations/new"
          element={
            <>
              <MotorQuotationCreatePage />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

const BOTH = [
  'quotations:create',
  'underwrite.motor.create',
  'underwrite.fleet.create',
];

describe('MotorQuotationCreatePage', () => {
  beforeEach(() => setPermissions(BOTH));

  it('asks for the quotation type first', () => {
    renderAt('/apps/motor/quotations/new');

    expect(
      screen.getByRole('radio', { name: /Single Motor/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Fleet/ })).toBeInTheDocument();
    expect(screen.queryByTestId('single-wizard')).not.toBeInTheDocument();
  });

  it('opens the fleet wizard after choosing Fleet', async () => {
    renderAt('/apps/motor/quotations/new');

    fireEvent.click(screen.getByRole('radio', { name: /Fleet/ }));

    expect(await screen.findByTestId('fleet-wizard')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('?type=fleet');
  });

  it('keeps the wizard inside the Motor Insurance module', async () => {
    renderAt('/apps/motor/quotations/new?type=single');

    expect(await screen.findByTestId('single-wizard')).toHaveTextContent(
      '/apps/motor/quotations/q-1/edit',
    );
  });

  it('only offers the types the user may create', () => {
    setPermissions(['quotations:create', 'underwrite.motor.create']);
    renderAt('/apps/motor/quotations/new');

    expect(
      screen.getByRole('radio', { name: /Single Motor/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Fleet/ })).toBeNull();
  });

  it('ignores a type in the URL that the user may not create', () => {
    setPermissions(['quotations:create', 'underwrite.motor.create']);
    renderAt('/apps/motor/quotations/new?type=fleet');

    expect(screen.queryByTestId('fleet-wizard')).toBeNull();
    expect(
      screen.getByRole('radio', { name: /Single Motor/ }),
    ).toBeInTheDocument();
  });
});

describe('wizard navigation', () => {
  it('defaults to the line routes when no provider is set', () => {
    expect(defaultWizardNavigation.quotationEdit('fleet', 'q-1')).toBe(
      '/apps/underwrite/fleet/quotations/q-1/edit',
    );
  });

  it('routes to the Motor Insurance module under its provider', () => {
    function Probe() {
      const nav = useWizardNavigation();
      return <span>{nav.quotationDetail('fleet', 'q-9')}</span>;
    }
    render(
      <MotorWizardNavigation>
        <Probe />
      </MotorWizardNavigation>,
    );
    expect(screen.getByText('/apps/motor/quotations/q-9')).toBeInTheDocument();
  });
});
