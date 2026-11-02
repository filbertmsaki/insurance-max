import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnderwriteLine } from '@insurance-max/contracts';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { buildFleetRiskPricingSignature } from '@/modules/tenant/quotations/wizard/utils/pricingStaleness';
import { underwriteApi } from '../api';
import { getUnderwriteLineMeta } from '../lines';
import {
  useUnderwriteQuotationWizard,
  type UnderwriteWizardStep,
} from '../wizard/useUnderwriteQuotationWizard';

const reference = vi.hoisted(() => ({ empty: { data: [] }, noCustomer: {} }));
vi.mock('@/modules/tenant/quotations/hooks', () => ({
  quotationKeys: { all: ['quotations'] },
  useQuotationCurrentCompanyId: () => undefined,
  useQuotationCategories: () => reference.empty,
  useQuotationProducts: () => reference.empty,
  useQuotationRisks: () => reference.empty,
  useQuotationVehicles: () => reference.empty,
}));
vi.mock('@/modules/tenant/customers/hooks', () => ({
  useCustomer: () => reference.noCustomer,
}));
vi.mock('@/modules/tenant/non-motor/hooks', () => ({
  useSubjectMatterOptions: () => reference.empty,
}));
vi.mock('../api', () => ({
  underwriteApi: { createDraft: vi.fn(), updateDraft: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const steps: UnderwriteWizardStep[] = [
  {
    id: 'customer',
    label: 'Customer',
    description: '',
    fields: ['product_id'],
  },
  {
    id: 'vehicles',
    label: 'Vehicles',
    description: '',
    fields: ['fleet.items'],
  },
  { id: 'premium', label: 'Premium', description: '', fields: [] },
  { id: 'review', label: 'Review', description: '', fields: [] },
];

function renderWizard(allowEarlyManualDraft = true) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const hook = renderHook(
    () =>
      useUnderwriteQuotationWizard({
        line: getUnderwriteLineMeta(UnderwriteLine.FLEET),
        steps,
        deferDraftUntilStepId: 'premium',
        allowEarlyManualDraft,
      }),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>{children}</MemoryRouter>
        </QueryClientProvider>
      ),
    },
  );
  // These tests isolate persistence timing; schema validation is exercised by the existing schema tests.
  const validate = vi
    .spyOn(hook.result.current.form, 'trigger')
    .mockResolvedValue(true);
  act(() => hook.result.current.form.setValue('product_id', 'product-1'));
  return { ...hook, validate };
}

type WizardResult = ReturnType<typeof renderWizard>['result'];
async function move(result: WizardResult, step: string) {
  await act(async () => {
    await result.current.goToStep(step);
  });
}
async function reachPremium(result: WizardResult) {
  await move(result, 'vehicles');
  await move(result, 'premium');
}
function calculate(result: WizardResult) {
  const values = result.current.form.getValues();
  const item = values.fleet.items[0];
  const risk = item.risks_covered[0];
  const metadata = {
    pricing_quote_id: 'price-1',
    pricing_is_stale: false,
    pricing_status: 'CALCULATED',
    pricing_input_signature: buildFleetRiskPricingSignature({
      ...values,
      fleet_header: values.fleet.header,
      item,
      risk,
    }),
    expires_at: new Date(Date.now() + 3600000).toISOString(),
  } as NonNullable<typeof risk.rating_result_metadata>;
  act(() =>
    result.current.form.setValue(
      'fleet.items.0.risks_covered.0.rating_result_metadata',
      metadata,
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({
    user: null,
    company: null,
    authorizationContext: null,
  });
  vi.mocked(underwriteApi.createDraft).mockResolvedValue({
    id: 'draft-1',
  } as Awaited<ReturnType<typeof underwriteApi.createDraft>>);
  vi.mocked(underwriteApi.updateDraft).mockResolvedValue({
    id: 'draft-1',
  } as Awaited<ReturnType<typeof underwriteApi.updateDraft>>);
});

describe('Fleet draft persistence', () => {
  it('does not automatically create a draft before leaving Premium, including backward navigation', async () => {
    const { result } = renderWizard();
    await reachPremium(result);
    expect(result.current.stepId).toBe('premium');
    await move(result, 'customer');
    expect(result.current.stepId).toBe('customer');
    expect(underwriteApi.createDraft).not.toHaveBeenCalled();
    expect(underwriteApi.updateDraft).not.toHaveBeenCalled();
  });
  it('blocks the first automatic save while premiums are not calculated', async () => {
    const { result } = renderWizard();
    await reachPremium(result);
    await move(result, 'review');
    expect(result.current.stepId).toBe('premium');
    expect(underwriteApi.createDraft).not.toHaveBeenCalled();
  });
  it.each(['stale', 'expired', 'changed inputs'] as const)(
    'blocks %s pricing',
    async (state) => {
      const { result } = renderWizard();
      await reachPremium(result);
      calculate(result);
      act(() => {
        if (state === 'stale')
          result.current.form.setValue(
            'fleet.items.0.risks_covered.0.rating_result_metadata.pricing_is_stale',
            true,
          );
        if (state === 'expired')
          result.current.form.setValue(
            'fleet.items.0.risks_covered.0.rating_result_metadata.expires_at',
            '2020-01-01T00:00:00Z',
          );
        if (state === 'changed inputs')
          result.current.form.setValue(
            'fleet.items.0.motor_dtl.registration_number',
            'T999AAA',
          );
      });
      await move(result, 'review');
      expect(result.current.stepId).toBe('premium');
      expect(underwriteApi.createDraft).not.toHaveBeenCalled();
    },
  );
  it('creates one draft after calculated premiums, then updates that draft despite incomplete corrections', async () => {
    const { result } = renderWizard();
    await reachPremium(result);
    calculate(result);
    await move(result, 'review');
    expect(result.current.stepId).toBe('review');
    expect(underwriteApi.createDraft).toHaveBeenCalledTimes(1);
    expect(underwriteApi.createDraft).toHaveBeenCalledWith(
      'fleet',
      expect.objectContaining({
        current_wizard_step: 'review',
        product_id: 'product-1',
      }),
    );
    act(() =>
      result.current.form.setValue(
        'fleet.items.0.risks_covered.0.rating_result_metadata',
        null,
      ),
    );
    await move(result, 'vehicles');
    await waitFor(() =>
      expect(underwriteApi.updateDraft).toHaveBeenCalledWith(
        'fleet',
        'draft-1',
        expect.objectContaining({ current_wizard_step: 'vehicles' }),
      ),
    );
    expect(underwriteApi.createDraft).toHaveBeenCalledTimes(1);
  });
  it('keeps explicit Save draft available before Premium and uses the resulting draft afterward', async () => {
    const { result } = renderWizard();
    expect(result.current.canSaveDraft).toBe(true);
    await act(async () => {
      await result.current.saveDraft();
    });
    expect(underwriteApi.createDraft).toHaveBeenCalledTimes(1);
    expect(underwriteApi.createDraft).toHaveBeenCalledWith(
      'fleet',
      expect.objectContaining({ current_wizard_step: 'customer' }),
    );
    await move(result, 'vehicles');
    await waitFor(() =>
      expect(underwriteApi.updateDraft).toHaveBeenCalledTimes(1),
    );
    expect(underwriteApi.createDraft).toHaveBeenCalledTimes(1);
  });
  it('retains the previous manual-save restriction for wizards that do not opt in', async () => {
    const { result } = renderWizard(false);
    expect(result.current.canSaveDraft).toBe(false);
    await act(async () => {
      expect(await result.current.saveDraft()).toBeNull();
    });
    expect(underwriteApi.createDraft).not.toHaveBeenCalled();
  });
  it('stays on Premium and retains entries if initial persistence fails', async () => {
    vi.mocked(underwriteApi.createDraft).mockRejectedValueOnce(
      new Error('Save failed'),
    );
    const { result } = renderWizard();
    await reachPremium(result);
    calculate(result);
    await move(result, 'review');
    expect(result.current.stepId).toBe('premium');
    expect(result.current.form.getValues('product_id')).toBe('product-1');
    expect(result.current.draftId).toBeNull();
    expect(underwriteApi.updateDraft).not.toHaveBeenCalled();
  });
  it('rechecks earlier field validation before first persistence', async () => {
    const { result, validate } = renderWizard();
    await reachPremium(result);
    calculate(result);
    validate.mockResolvedValueOnce(false);
    await move(result, 'review');
    expect(result.current.stepId).toBe('premium');
    expect(underwriteApi.createDraft).not.toHaveBeenCalled();
  });
});
