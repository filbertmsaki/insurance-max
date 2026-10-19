import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnderwriteLine } from '@insurance-max/contracts';
import { Form } from '@/components/ui/form';
import { motorApi } from '@/modules/tenant/motor/api';
import type { MotorVehicleRecord } from '@/modules/tenant/motor/types';
import type { QuotationFormSchemaValues } from '@/modules/tenant/quotations/schemas';
import { verificationsApi } from '@/modules/tenant/verifications/api';
import { getUnderwriteLineMeta } from '../lines';
import {
  LEGACY_MOTOR_STEP_MAP,
  MOTOR_WIZARD_STEPS,
} from '../motor/MotorQuotationWizardPage';
import { MotorVehicleSection } from '../motor/MotorVehicleSection';
import { defaultValuesForLine } from '../wizard/defaults';

vi.mock('@/modules/tenant/motor/api', () => ({
  motorApi: { searchVehicles: vi.fn(), getVehicle: vi.fn() },
}));
vi.mock('@/modules/tenant/verifications/api', () => ({
  verificationsApi: { motor: vi.fn() },
}));

/** Fields each step of the previous four-step Motor wizard validated. */
const PREVIOUS_STEP_FIELDS = [
  'product_id',
  'currency',
  'exchange_rate',
  'cover_note_type',
  'valid_from',
  'valid_until',
  'cover_note_desc',
  'operative_clause',
  'risks.0.risk_id',
  'customer_id',
  'policyholder',
  'motor',
  'risks.0.sum_insured',
  'addons',
  'channel_type',
  'intermediary_company_id',
  'commission_rate',
  'commission_paid',
  'payment_mode_tira',
];

describe('Motor wizard steps', () => {
  it('has two steps that still validate every field the old steps did', () => {
    expect(MOTOR_WIZARD_STEPS.map((step) => step.id)).toEqual([
      'details',
      'review',
    ]);
    const fields = new Set(MOTOR_WIZARD_STEPS.flatMap((step) => step.fields));
    expect(
      PREVIOUS_STEP_FIELDS.filter((field) => !fields.has(field as never)),
    ).toEqual([]);
  });

  it('reopens drafts saved by the earlier layouts on an existing step', () => {
    const ids = new Set(MOTOR_WIZARD_STEPS.map((step) => step.id));
    for (const legacy of [
      'product-cover',
      'customer-vehicle',
      'premium-source',
      'review-submit',
      'customer',
      'vehicle',
      'cover',
      'premium',
      'source',
    ]) {
      expect(ids.has(LEGACY_MOTOR_STEP_MAP[legacy])).toBe(true);
    }
  });
});

const registerVehicle = {
  id: 'vehicle-1',
  customer_id: 'customer-old',
  customer: {
    id: 'customer-old',
    customer_type: 'INDIVIDUAL',
    first_name: 'Asha',
    middle_name: null,
    last_name: 'Juma',
    company_name: null,
  },
  registration_no: 'T 123 ABC',
  chassis_no: 'JTE0001234',
  engine_no: 'ENG123',
  make: 'Toyota',
  model: 'Hilux',
  body_type: 'Pickup',
  color: 'White',
  manufacture_year: 2020,
  cubic_capacity: 2800,
  fuel_type: 'Diesel',
  tare_weight: '2000',
  gross_weight: null,
  motor_category: 1,
  motor_type: 1,
  motor_usage: 2,
  owner_name: 'Asha Juma',
  owner_category: 1,
  owner_address: 'Ilala',
  metadata: null,
} as unknown as MotorVehicleRecord;

function renderSection(customerId = 'customer-new') {
  function Harness() {
    const form = useForm<QuotationFormSchemaValues>({
      defaultValues: {
        ...defaultValuesForLine(getUnderwriteLineMeta(UnderwriteLine.MOTOR)),
        customer_id: customerId,
      },
    });
    return (
      <Form {...form}>
        <form>
          <MotorVehicleSection form={form} />
        </form>
      </Form>
    );
  }
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>,
  );
}

async function search(term: string) {
  fireEvent.click(screen.getByRole('combobox', { name: /vehicle/i }));
  fireEvent.change(
    await screen.findByPlaceholderText('Registration or chassis number'),
    { target: { value: term } },
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('MotorVehicleSection', () => {
  it('searches the register on the server and opens vehicle details for review', async () => {
    vi.mocked(motorApi.searchVehicles).mockResolvedValue({
      data: [
        {
          id: 'vehicle-1',
          registration_no: 'T 123 ABC',
          chassis_no_masked: 'JTE***1234',
          make: 'TOYOTA',
          model: 'HILUX',
          manufacture_year: 2020,
          motor_category: 1,
          motor_type: 1,
          customer: {
            id: 'customer-old',
            customer_no: 'CUST-1',
            name: 'Asha Juma',
          },
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });
    vi.mocked(motorApi.getVehicle).mockResolvedValue(registerVehicle);
    renderSection();

    await search('t123');
    fireEvent.click(await screen.findByRole('option', { name: /T 123 ABC/ }));

    expect(motorApi.searchVehicles).toHaveBeenCalledWith(
      expect.objectContaining({ q: 't123', customer_id: 'customer-new' }),
      expect.anything(),
    );
    expect(
      await screen.findByText('T123ABC — TOYOTA HILUX'),
    ).toBeInTheDocument();
    expect(screen.getByText(/From the vehicle register/)).toBeInTheDocument();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    // Details are edited in the modal, including any missing register values.
    expect(
      screen.getByRole('textbox', { name: 'Gross weight (kg)' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Make' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    // The vehicle belongs to someone else and will be handed over.
    expect(
      screen
        .getAllByRole('status')
        .some((status) =>
          status.textContent?.includes('Registered under Asha Juma'),
        ),
    ).toBe(true);
  });

  it('looks a vehicle up with TIRA without choosing what was typed', async () => {
    vi.mocked(motorApi.searchVehicles).mockResolvedValue({
      data: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });
    vi.mocked(verificationsApi.motor).mockResolvedValue({
      success: true,
      verificationType: 'MOTOR',
      status: 'SUCCESS',
      responseCode: 'TIRA001',
      requestId: null,
      transactionId: null,
      responseMessage: null,
      registrationNumber: null,
      coverNoteReferenceNumber: null,
      respondedAt: null,
      fullResponse: {},
      verifiedRecordDetails: {
        responseDetails: { RegistrationNumber: 'T999XYZ', Make: 'Isuzu' },
      },
    });
    renderSection();

    await search('T999XYZ');
    fireEvent.click(
      await screen.findByRole('option', {
        name: /Search TIRA for "T999XYZ"/,
      }),
    );

    expect(await screen.findByText(/Verified with TIRA/)).toBeInTheDocument();
    expect(verificationsApi.motor).toHaveBeenCalledWith({
      motorCategory: 1,
      motorRegistrationNumber: 'T999XYZ',
    });
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    await waitFor(() =>
      expect(
        screen.getByRole('textbox', { name: 'Model' }),
      ).toBeInTheDocument(),
    );
  });
});
