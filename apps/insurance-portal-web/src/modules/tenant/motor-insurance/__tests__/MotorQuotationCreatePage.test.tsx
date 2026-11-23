import { fireEvent, render, screen, within } from '@testing-library/react';
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
vi.mock('../lazy-pages', () => ({
  SingleMotorQuotationWizard: () => <WizardProbe name="single-wizard" />,
  FleetQuotationWizard: () => <WizardProbe name="fleet-wizard" />,
  ShortTermQuotationWizard: ({ allowFleet }: { allowFleet?: boolean }) => (
    <div data-testid="short-term-wizard">{String(allowFleet)}</div>
  ),
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

  it('offers Standard Motor Cover and Short-Term', () => {
    renderAt('/apps/motor/quotations/new');

    const group = within(
      screen.getByRole('radiogroup', { name: 'Quotation type' }),
    );
    expect(group.getAllByRole('radio')).toHaveLength(2);
    expect(
      group.getByRole('radio', { name: /Standard Motor Cover/ }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('single-wizard')).not.toBeInTheDocument();
  });

  it('opens Standard Motor Cover on the single wizard', async () => {
    renderAt('/apps/motor/quotations/new');

    fireEvent.click(
      within(
        screen.getByRole('radiogroup', { name: 'Quotation type' }),
      ).getByRole('radio', { name: /Standard Motor Cover/ }),
    );

    expect(await screen.findByTestId('single-wizard')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('?type=single');
  });

  it('opens Standard Motor Cover on fleet when only Fleet is allowed', async () => {
    setPermissions(['quotations:create', 'underwrite.fleet.create']);
    renderAt('/apps/motor/quotations/new?type=standard');

    expect(await screen.findByTestId('fleet-wizard')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('?type=fleet');
  });

  it('still opens the fleet wizard from a ?type=fleet link', async () => {
    renderAt('/apps/motor/quotations/new?type=fleet');

    expect(await screen.findByTestId('fleet-wizard')).toBeInTheDocument();
  });

  it('opens the Short-Term wizard', async () => {
    renderAt('/apps/motor/quotations/new');

    fireEvent.click(
      within(
        screen.getByRole('radiogroup', { name: 'Quotation type' }),
      ).getByRole('radio', { name: /Short-Term/ }),
    );

    expect(await screen.findByTestId('short-term-wizard')).toHaveTextContent(
      'true',
    );
    expect(screen.getByTestId('location')).toHaveTextContent(
      '?type=short-term',
    );
  });

  it('selects a mobile option before continuing to its wizard', async () => {
    renderAt('/apps/motor/quotations/new');
    const group = within(
      screen.getByRole('radiogroup', { name: 'Mobile quotation type' }),
    );
    const button = screen.getByRole('button', { name: 'Select an option' });
    expect(button).toBeDisabled();
    fireEvent.click(group.getByRole('radio', { name: /Standard Motor Cover/ }));
    expect(group.getByRole('radio', { name: /Standard Motor Cover/ })).toBeChecked();
    expect(button).toHaveTextContent('Continue with Standard Motor Cover');
    fireEvent.click(button);
    expect(await screen.findByTestId('single-wizard')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('?type=single');
  });

  it('offers Short-Term single only without Fleet permission', async () => {
    setPermissions(['quotations:create', 'underwrite.motor.create']);
    renderAt('/apps/motor/quotations/new?type=short-term');

    expect(await screen.findByTestId('short-term-wizard')).toHaveTextContent(
      'false',
    );
  });

  it('keeps the wizard inside the Motor Insurance module', async () => {
    renderAt('/apps/motor/quotations/new?type=single');

    expect(await screen.findByTestId('single-wizard')).toHaveTextContent(
      '/apps/motor/quotations/q-1/edit',
    );
  });

  it('only offers the types the user may create', () => {
    setPermissions(['quotations:create']);
    renderAt('/apps/motor/quotations/new');

    expect(
      screen.queryByRole('radio', { name: /Standard Motor Cover/ }),
    ).toBeNull();
  });

  it('ignores a type in the URL that the user may not create', () => {
    setPermissions(['quotations:create', 'underwrite.motor.create']);
    renderAt('/apps/motor/quotations/new?type=fleet');

    expect(screen.queryByTestId('fleet-wizard')).toBeNull();
    expect(
      within(
        screen.getByRole('radiogroup', { name: 'Quotation type' }),
      ).getByRole('radio', { name: /Standard Motor Cover/ }),
    ).toBeInTheDocument();
  });
});

describe('wizard navigation', () => {
  it('uses canonical Motor Insurance links without a provider', () => {
    expect(defaultWizardNavigation.quotationEdit('fleet', 'q-1')).toBe(
      '/apps/motor/quotations/q-1/edit',
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
