import { act, renderHook } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyFleetDetails, createEmptyFleetItemRow, type QuotationFormSchemaValues } from '../../../schemas';
import { useAutoFleetPricing } from '../useAutoFleetPricing';

vi.mock('../../steps/MotorFleetDetailsStep', () => ({ getVehicleIssues: () => [] }));

describe('automatic fleet pricing', () => {
  afterEach(() => vi.useRealTimers());

  it('prices a loaded fleet and reprices changed inputs without reacting to calculated amounts', () => {
    vi.useFakeTimers();
    const item = createEmptyFleetItemRow();
    item.risks_covered[0].risk_id = 'risk-1';
    const calculate = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => {
      const form = useForm<QuotationFormSchemaValues>({
        defaultValues: { fleet: { ...createEmptyFleetDetails(), items: [item, structuredClone(item)] } },
      });
      useAutoFleetPricing(form, calculate, true);
      return form;
    });
    act(() => vi.advanceTimersByTime(600));
    expect(calculate).toHaveBeenCalledTimes(1);
    act(() => result.current.setValue('fleet.items.0.risks_covered.0.premium_including_tax', '500'));
    act(() => vi.advanceTimersByTime(600));
    expect(calculate).toHaveBeenCalledTimes(1);
    act(() => result.current.setValue('fleet.items.0.risks_covered.0.sum_insured', '10000'));
    act(() => vi.advanceTimersByTime(600));
    expect(calculate).toHaveBeenCalledTimes(2);
  });
});
