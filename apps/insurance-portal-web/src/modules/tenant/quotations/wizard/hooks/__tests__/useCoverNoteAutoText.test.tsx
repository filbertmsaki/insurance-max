import { act, renderHook } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import type { QuotationFormSchemaValues } from '../../../schemas';
import { useCoverNoteAutoText } from '../useCoverNoteAutoText';

function setup(initial?: {
  cover_note_desc?: string;
  operative_clause?: string;
}) {
  const { result: formResult } = renderHook(() =>
    useForm<QuotationFormSchemaValues>({
      defaultValues: {
        cover_note_desc: initial?.cover_note_desc ?? '',
        operative_clause: initial?.operative_clause ?? '',
      },
    }),
  );
  return formResult.current;
}

describe('useCoverNoteAutoText', () => {
  it('does not generate text when no product is selected (missing product)', () => {
    const form = setup();
    const { result } = renderHook((props) => useCoverNoteAutoText(props), {
      initialProps: {
        form,
        productName: '',
        validFrom: '2026-07-30',
        validUntil: '2027-07-29',
      },
    });

    expect(result.current.generatedCoverNoteDesc).toBeNull();
    expect(form.getValues('cover_note_desc')).toBe('');
  });

  it('auto-populates on initial product selection', () => {
    const form = setup();
    const { rerender } = renderHook((props) => useCoverNoteAutoText(props), {
      initialProps: {
        form,
        productName: '',
        validFrom: '2026-07-30',
        validUntil: '2027-07-29',
      },
    });

    act(() => {
      rerender({
        form,
        productName: 'Motor Private',
        validFrom: '2026-07-30',
        validUntil: '2027-07-29',
      });
    });

    expect(form.getValues('cover_note_desc')).toBe(
      'Cover note for Motor Private for the period from 30/07/2026 to 29/07/2027.',
    );
    expect(form.getValues('operative_clause')).toContain('Motor Private');
  });

  it('updates the generated text when the product changes', () => {
    const form = setup();
    const { rerender } = renderHook((props) => useCoverNoteAutoText(props), {
      initialProps: {
        form,
        productName: 'Motor Private',
        validFrom: '2026-07-30',
        validUntil: '2027-07-29',
      },
    });

    act(() => {
      rerender({
        form,
        productName: 'Motor Commercial',
        validFrom: '2026-07-30',
        validUntil: '2027-07-29',
      });
    });

    expect(form.getValues('cover_note_desc')).toBe(
      'Cover note for Motor Commercial for the period from 30/07/2026 to 29/07/2027.',
    );
  });

  it('updates the generated text when the cover dates change', () => {
    const form = setup();
    const { rerender } = renderHook((props) => useCoverNoteAutoText(props), {
      initialProps: {
        form,
        productName: 'Motor Private',
        validFrom: '2026-07-30',
        validUntil: '2027-07-29',
      },
    });

    act(() => {
      rerender({
        form,
        productName: 'Motor Private',
        validFrom: '2026-08-01',
        validUntil: '2027-07-31',
      });
    });

    expect(form.getValues('cover_note_desc')).toBe(
      'Cover note for Motor Private for the period from 01/08/2026 to 31/07/2027.',
    );
  });

  it('does not overwrite a manually edited value on subsequent changes', () => {
    const form = setup();
    const { rerender } = renderHook((props) => useCoverNoteAutoText(props), {
      initialProps: {
        form,
        productName: 'Motor Private',
        validFrom: '2026-07-30',
        validUntil: '2027-07-29',
      },
    });

    act(() => {
      form.setValue('cover_note_desc', 'Manually written description', {
        shouldDirty: true,
      });
    });

    act(() => {
      rerender({
        form,
        productName: 'Motor Commercial',
        validFrom: '2026-08-01',
        validUntil: '2027-07-31',
      });
    });

    expect(form.getValues('cover_note_desc')).toBe(
      'Manually written description',
    );
  });

  it('regenerates the default via resetCoverNoteDescToDefault / resetOperativeClauseToDefault', () => {
    const form = setup();
    form.setValue('cover_note_desc', 'Manually written description');

    const { result } = renderHook(() =>
      useCoverNoteAutoText({
        form,
        productName: 'Motor Private',
        validFrom: '2026-07-30',
        validUntil: '2027-07-29',
      }),
    );

    act(() => {
      result.current.resetCoverNoteDescToDefault();
      result.current.resetOperativeClauseToDefault();
    });

    expect(form.getValues('cover_note_desc')).toBe(
      'Cover note for Motor Private for the period from 30/07/2026 to 29/07/2027.',
    );
    expect(form.getValues('operative_clause')).toContain('Motor Private');
  });

  it('preserves a saved value while hydrating an existing quotation and does not overwrite it afterwards', () => {
    const form = setup({
      cover_note_desc: 'Saved description from the record',
      operative_clause: 'Saved operative clause from the record',
    });

    const { rerender } = renderHook((props) => useCoverNoteAutoText(props), {
      initialProps: {
        form,
        productName: 'Motor Private',
        validFrom: '2026-07-30',
        validUntil: '2027-07-29',
        isHydrating: true,
      },
    });

    // Hydration completes; product/dates were already set from the saved record.
    act(() => {
      rerender({
        form,
        productName: 'Motor Private',
        validFrom: '2026-07-30',
        validUntil: '2027-07-29',
        isHydrating: false,
      });
    });

    expect(form.getValues('cover_note_desc')).toBe(
      'Saved description from the record',
    );
    expect(form.getValues('operative_clause')).toBe(
      'Saved operative clause from the record',
    );
  });

  it('generates partial text without invalid text when cover dates are incomplete', () => {
    const form = setup();
    const { result } = renderHook(() =>
      useCoverNoteAutoText({
        form,
        productName: 'Motor Private',
        validFrom: '',
        validUntil: '',
      }),
    );

    expect(result.current.generatedCoverNoteDesc).toBe(
      'Cover note for Motor Private.',
    );
    expect(result.current.generatedCoverNoteDesc).not.toMatch(
      /undefined|null|NaN/,
    );
  });
});
