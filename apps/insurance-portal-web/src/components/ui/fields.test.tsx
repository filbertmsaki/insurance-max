import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DatePicker } from './date-picker';
import { formatControlDate, parseControlDate } from './date-format';
import { SegmentedControl } from './radio';
import { Textarea } from './textarea';
import { MultiSelect } from './multi-select';

describe('date controls', () => {
  it('converts valid dates and rejects invalid calendar dates', () => {
    expect(formatControlDate('2026-11-09')).toBe('09/11/26');
    expect(parseControlDate('09/11/26')).toBe('2026-11-09');
    expect(parseControlDate('29/02/24')).toBe('2024-02-29');
    expect(parseControlDate('29/02/26')).toBeUndefined();
    expect(parseControlDate('')).toBe('');
  });
  it('keeps the ISO value in the form and blocks an invalid draft', () => {
    function Form() {
      const [date, setDate] = React.useState('2026-11-09');
      return (
        <form data-testid="form">
          <DatePicker
            aria-label="Date"
            name="date"
            value={date}
            onChange={setDate}
          />
        </form>
      );
    }
    render(<Form />);
    const input = screen.getByRole('textbox', {
      name: 'Date',
    }) as HTMLInputElement;
    const form = screen.getByTestId('form') as HTMLFormElement;
    fireEvent.change(input, { target: { value: '29/02/26' } });
    expect(form.checkValidity()).toBe(false);
    fireEvent.change(input, { target: { value: '29/02/24' } });
    fireEvent.blur(input);
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).get('date')).toBe('2024-02-29');
  });
  it('rejects dates outside the supplied bounds', () => {
    const change = vi.fn();
    render(<DatePicker aria-label="Cover date" value="" min="2026-01-01" onChange={change} />);
    const input = screen.getByRole('textbox', { name: 'Cover date' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '31/12/25' } });
    fireEvent.blur(input);
    expect(input.checkValidity()).toBe(false);
    expect(screen.getByRole('alert').textContent).toContain('01/01/26');
    expect(change).not.toHaveBeenCalled();
  });
  it('accepts a four-digit year without rewriting it while typing', () => {
    const change = vi.fn();
    render(<DatePicker aria-label="Date of birth" value="" onChange={change} />);
    const input = screen.getByRole('textbox', { name: 'Date of birth' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '09/11/19' } });
    expect(input.value).toBe('09/11/19');
    fireEvent.change(input, { target: { value: '09/11/1980' } });
    fireEvent.blur(input);
    expect(change).toHaveBeenCalledWith('1980-11-09');
  });
});

describe('other field controls', () => {
  it('uses native radio selection for segmented controls', () => {
    function Control() {
      const [value, setValue] = React.useState('single');
      return (
        <SegmentedControl
          name="kind"
          aria-label="Quotation type"
          value={value}
          onChange={setValue}
          options={[
            { value: 'single', label: 'Single' },
            { value: 'fleet', label: 'Fleet' },
          ]}
        />
      );
    }
    render(<Control />);
    fireEvent.click(screen.getByRole('radio', { name: 'Fleet' }));
    expect(
      (screen.getByRole('radio', { name: 'Fleet' }) as HTMLInputElement)
        .checked,
    ).toBe(true);
  });
  it('counts uncontrolled textarea characters', () => {
    render(<Textarea aria-label="Description" showCount maxLength={20} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), {
      target: { value: 'Cover' },
    });
    expect(screen.getByText('5 / 20')).toBeTruthy();
  });
  it('removes a selected multiselect value through its labelled button', () => {
    function Control() {
      const [value, setValue] = React.useState(['motor', 'property']);
      return <MultiSelect aria-label="Products" name="products" value={value} onChange={setValue} options={[{ value: 'motor', label: 'Motor' }, { value: 'property', label: 'Property' }]} />;
    }
    render(<Control />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Motor' }));
    expect(screen.queryByRole('button', { name: 'Remove Motor' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove Property' })).toBeTruthy();
  });
  it('exposes choices as checked and unchecked checkboxes', async () => {
    function Control() {
      const [value, setValue] = React.useState(['motor']);
      return <MultiSelect aria-label="Products" value={value} onChange={setValue} options={[{ value: 'motor', label: 'Motor' }, { value: 'property', label: 'Property' }]} />;
    }
    render(<Control />);
    fireEvent.click(screen.getByRole('combobox', { name: /products/i }));
    const motor = await screen.findByRole('checkbox', { name: 'Motor' });
    const property = screen.getByRole('checkbox', { name: 'Property' });
    expect((motor as HTMLInputElement).checked).toBe(true);
    expect((property as HTMLInputElement).checked).toBe(false);
    fireEvent.click(property);
    expect((property as HTMLInputElement).checked).toBe(true);
  });
});
