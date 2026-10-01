import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mocked so the test never loads the persisted auth store (see handoff gotchas).
const calls: Array<{ method: string; url: string; body?: unknown }> = [];
vi.mock('@/modules/shared/api/client', () => {
  const record = (method: string) => (url: string, body?: unknown) => {
    calls.push({ method, url, body });
    return Promise.resolve({ data: { transaction: {}, vehicles: [] } });
  };
  return {
    apiClient: {
      get: record('get'),
      post: record('post'),
      put: record('put'),
      patch: record('patch'),
      delete: record('delete'),
    },
  };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { FleetVehicleEndorsementPanel } =
  await import('../fleet/FleetVehicleEndorsementPanel');
const helpers = await import('../fleet/fleetVehicleEndorsement');

const snapshot = {
  entries: [
    {
      fleetEntry: 1,
      motor: { registrationNumber: 'T1AAA', make: 'Toyota' },
      risks: [{ sumInsured: '1000' }],
    },
    {
      fleetEntry: 2,
      motor: { registrationNumber: 'T2AAA' },
      status: 'REMOVED',
    },
    {
      fleetEntry: 3,
      motor: { registrationNumber: 'T3AAA' },
      status: 'CANCELLED',
      removedEffectiveDate: '2026-09-01',
    },
  ],
};

function renderPanel(typeCode: string, editable = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <FleetVehicleEndorsementPanel
        endorsementId="end-1"
        endorsementTypeCode={typeCode}
        snapshot={snapshot}
        pricing={{
          fleetRemovalRefund: {
            refundAmount: '1500',
            cancellationMethod: 'PRO_RATA',
          },
        }}
        currencyCode="TZS"
        editable={editable}
        tiraStatusCode="TIRA106"
      />
    </QueryClientProvider>,
  );
}

describe('fleet vehicle endorsement helpers', () => {
  it('reads vehicles and their pending status from the snapshot', () => {
    expect(
      helpers
        .vehiclesFromSnapshot(snapshot)
        .map((vehicle) => [vehicle.fleetEntry, vehicle.status]),
    ).toEqual([
      [1, 'ACTIVE'],
      [2, 'REMOVED'],
      [3, 'CANCELLED'],
    ]);
  });

  it('builds TIRA MotorDtl input and lists missing mandatory fields', () => {
    const form = helpers.emptyFleetVehicleForm();
    expect(helpers.toMotorInput(form).missing).toContain('Chassis number');
    // A registered vehicle also needs its registration number.
    expect(helpers.toMotorInput(form).missing).toContain('Registration number');

    const filled = {
      ...form,
      registrationNumber: 'T 9 NEW',
      chassisNumber: 'CH-9',
      engineNumber: 'E9',
      make: 'Toyota',
      model: 'Hiace',
      modelNumber: 'H1',
      bodyType: 'Minibus',
      color: 'White',
      engineCapacity: '2800',
      fuelUsed: 'Diesel',
      yearOfManufacture: '2021',
      tareWeight: '2000',
      grossWeight: '3000',
      ownerName: 'ABC Ltd',
      ownerCategory: '2',
    };
    const { motor, missing } = helpers.toMotorInput(filled);
    expect(missing).toEqual([]);
    expect(motor).toMatchObject({
      motorCategory: 1,
      yearOfManufacture: 2021,
      chassisNumber: 'CH-9',
    });
    expect(motor).not.toHaveProperty('ownerAddress');
  });

  it('explains fleet TIRA rejections', () => {
    expect(helpers.describeTiraCode('tira221')).toMatch(/fleet type/);
    expect(helpers.describeTiraCode('TIRA999')).toBeNull();
  });
});

describe('FleetVehicleEndorsementPanel', () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it('removes and undoes vehicles on a remove-vehicle endorsement', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPanel('FLEET_REMOVE_VEHICLE');

    expect(screen.getByText(/TIRA rejected this change/)).toBeTruthy();
    expect(screen.getByText('Being removed')).toBeTruthy();
    expect(screen.getByText('Removed 2026-09-01')).toBeTruthy();
    expect(screen.getByText(/pro rata cancellation rule/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Remove/ }));
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }));

    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[0]).toMatchObject({
      method: 'delete',
      url: '/tenant/underwrite/fleet/endorsements/end-1/vehicles/1',
    });
    expect(calls[1]).toMatchObject({
      method: 'post',
      url: '/tenant/underwrite/fleet/endorsements/end-1/vehicles/2/revert',
    });
  });

  it('only offers adding on an add-vehicle endorsement, and nothing once submitted', () => {
    const { unmount } = renderPanel('FLEET_ADD_VEHICLE');
    expect(screen.getByRole('button', { name: /Add vehicle/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Remove$/ })).toBeNull();
    unmount();

    renderPanel('FLEET_ADD_VEHICLE', false);
    expect(screen.queryByRole('button', { name: /Add vehicle/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Undo/ })).toBeNull();
  });
});
