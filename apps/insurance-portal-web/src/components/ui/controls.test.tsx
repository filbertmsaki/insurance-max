import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormField } from './form-field';
import { Input } from './input';
import { SearchInput } from './search-input';
import { Button } from './button';
import { TextInput } from './text-input';
import { LinkButton } from './button-group';

describe('shared controls', () => {
  it('connects a required field to its error', () => {
    render(<FormField id="customer" label="Customer" required error="Choose a customer"><Input /></FormField>);
    const input = screen.getByRole('textbox', { name: /customer/i });
    expect(input.getAttribute('aria-required')).toBe('true');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('customer-description');
    expect(screen.getByText('Choose a customer').id).toBe('customer-description');
  });
  it('clears a populated search using its accessible action', () => {
    const clear = vi.fn();
    render(<SearchInput aria-label="Search customers" value="Jane" onChange={() => {}} onClear={clear} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(clear).toHaveBeenCalledOnce();
  });
  it('disables a loading button while preserving its label', () => {
    render(<Button loading>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
  });
  it('allows the password visibility to be toggled', () => {
    render(<TextInput type="password" aria-label="Password" />);
    const input = screen.getByLabelText('Password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input.getAttribute('type')).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input.getAttribute('type')).toBe('password');
  });
  it('does not navigate or invoke a disabled link action', () => {
    const click = vi.fn();
    render(<LinkButton href="/example" disabled onClick={click}>Open</LinkButton>);
    const link = screen.getByRole('link', { name: 'Open' });
    fireEvent.click(link);
    expect(link.hasAttribute('href')).toBe(false);
    expect(link.getAttribute('aria-disabled')).toBe('true');
    expect(click).not.toHaveBeenCalled();
  });
  it('prevents a disabled slotted link from invoking its handler', () => {
    const click = vi.fn();
    render(<Button asChild disabled><a href="/example" onClick={click}>Open</a></Button>);
    const link = screen.getByText('Open');
    fireEvent.click(link);
    expect(link.hasAttribute('href')).toBe(false);
    expect(link.getAttribute('aria-disabled')).toBe('true');
    expect(click).not.toHaveBeenCalled();
  });
});
