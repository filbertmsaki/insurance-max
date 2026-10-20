import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Form } from '@/components/ui/form';
import {
  verificationsApi,
  type VerificationResult,
} from '@/modules/tenant/verifications/api';
import {
  createEmptyMotorDetails,
  type QuotationFormSchemaValues,
} from '../../schemas';
import { MotorDetailsStep } from '../steps/MotorDetailsStep';
import { VehicleLookup } from './VehicleLookup';

vi.mock('@/modules/tenant/verifications/api', () => ({
  verificationsApi: { motor: vi.fn() },
}));

const result: VerificationResult = {
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
    responseDetails: {
      RegistrationNumber: 't123abc',
      Make: 'Toyota',
      Model: 'Corolla',
      EngineCapacity: 1500,
    },
  },
};

function search() {
  fireEvent.change(screen.getByPlaceholderText('e.g. T123ABC'), {
    target: { value: ' t123abc ' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Fetch details' }));
}

beforeEach(() => {
  vi.resetAllMocks();
  // Radix Select scrolls focused options; jsdom has no layout implementation.
  Element.prototype.scrollIntoView = vi.fn();
});

describe('VehicleLookup', () => {
  it('populates Motor Details and preserves fields absent from the response', async () => {
    vi.mocked(verificationsApi.motor).mockResolvedValue(result);
    function Harness() {
      const form = useForm<QuotationFormSchemaValues>({
        defaultValues: {
          motor_mode: 'new',
          motor: {
            ...createEmptyMotorDetails(),
            owner_name: 'Existing owner',
            registration_no: 'T123ABC',
          },
        },
      });
      return (
        <Form {...form}>
          <MotorDetailsStep form={form} vehicleOptions={[]} />
        </Form>
      );
    }
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );
    search();
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Vehicle details populated',
    );
    expect(screen.getByRole('combobox', { name: 'Make' })).toHaveTextContent('TOYOTA');
    expect(screen.getByRole('combobox', { name: 'Model' })).toHaveTextContent(
      'COROLLA',
    );
    expect(
      screen.getByRole('textbox', { name: 'Engine capacity (cc)' }),
    ).toHaveValue('1500');
    expect(screen.getByRole('textbox', { name: 'Owner name' })).toHaveValue(
      'Existing owner',
    );
    expect(verificationsApi.motor).toHaveBeenCalledWith({
      motorCategory: 1,
      motorRegistrationNumber: 'T123ABC',
    });
  });

  it('supports motorcycle searches by chassis number', async () => {
    vi.mocked(verificationsApi.motor).mockResolvedValue(result);
    render(<VehicleLookup initialCategory="2" onFound={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Search by' }), {
      key: 'ArrowDown',
    });
    fireEvent.click(
      await screen.findByRole('option', { name: 'Chassis number' }),
    );
    fireEvent.change(screen.getByLabelText('Chassis number'), {
      target: { value: ' ch123 ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Fetch details' }));
    await screen.findByRole('status');
    expect(verificationsApi.motor).toHaveBeenCalledWith({
      motorCategory: 2,
      motorChassisNumber: 'CH123',
    });
  });

  it.each([
    { ...result, success: false, responseCode: 'TIRA007' },
    { ...result, verifiedRecordDetails: null },
  ])('alerts when no vehicle record is returned', async (response) => {
    const onFound = vi.fn();
    vi.mocked(verificationsApi.motor).mockResolvedValue(response);
    render(<VehicleLookup onFound={onFound} />);
    search();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Vehicle details not found.',
    );
    expect(onFound).not.toHaveBeenCalled();
  });

  it('validates an empty identifier without submitting the quotation', () => {
    const onSubmit = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <VehicleLookup onFound={vi.fn()} />
      </form>,
    );
    fireEvent.keyDown(screen.getByLabelText('Registration number'), {
      key: 'Enter',
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a registration number or chassis number.',
    );
    expect(verificationsApi.motor).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('reports network failures and allows retrying', async () => {
    vi.mocked(verificationsApi.motor)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(result);
    render(<VehicleLookup onFound={vi.fn()} />);
    search();
    expect(await screen.findByRole('alert')).toHaveTextContent('Network error');
    fireEvent.click(screen.getByRole('button', { name: 'Fetch details' }));
    await screen.findByRole('status');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('blocks duplicate requests and ignores responses after leaving the form', async () => {
    let resolve!: (value: VerificationResult) => void;
    vi.mocked(verificationsApi.motor).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const onFound = vi.fn();
    const view = render(<VehicleLookup onFound={onFound} />);
    search();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Fetching...' }),
      ).toBeDisabled(),
    );
    expect(screen.getByLabelText('Registration number')).toBeDisabled();
    expect(verificationsApi.motor).toHaveBeenCalledTimes(1);
    view.unmount();
    await act(async () => {
      resolve(result);
    });
    expect(onFound).not.toHaveBeenCalled();
  });
});
