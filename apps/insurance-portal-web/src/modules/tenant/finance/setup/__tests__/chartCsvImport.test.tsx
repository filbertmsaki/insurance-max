import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChartCsvImport } from '../ChartCsvImport';
import { CHART_CSV_HEADER, parseChartCsv } from '../chartCsvParser';

const csv = `${CHART_CSV_HEADER}\r\n1000,Assets,ASSET,DR,false,false,\r\n1100,"Cash, bank",ASSET,DR,true,true,1000\r\n`;
describe('CSV chart draft import', () => {
  it('reads quoted values and preserves the proposed hierarchy', () => {
    expect(parseChartCsv(csv, [])).toEqual([
      {
        code: '1000',
        name: 'Assets',
        type: 'ASSET',
        normalBalance: 'DR',
        posting: false,
        control: false,
        parentCode: null,
      },
      {
        code: '1100',
        name: 'Cash, bank',
        type: 'ASSET',
        normalBalance: 'DR',
        posting: true,
        control: true,
        parentCode: '1000',
      },
    ]);
  });
  it('keeps leading zeroes in account codes', () => {
    expect(
      parseChartCsv(
        `${CHART_CSV_HEADER}\n0010,Asset,ASSET,DR,true,false,`,
        [],
      )[0].code,
    ).toBe('0010');
  });
  it('rejects duplicates and unsafe hierarchies without changing existing accounts', () => {
    expect(() =>
      parseChartCsv(csv, [
        {
          code: '1000',
          type: 'ASSET',
          posting: false,
          control: false,
          parentCode: null,
        },
      ]),
    ).toThrow(/unique/);
    expect(() =>
      parseChartCsv(
        `${CHART_CSV_HEADER}\n1000,A,ASSET,DR,false,false,1100\n1100,B,ASSET,DR,false,false,1000`,
        [],
      ),
    ).toThrow(/cycle/);
    expect(() =>
      parseChartCsv(
        `${CHART_CSV_HEADER}\n1000,A,ASSET,DR,true,false,\n1100,B,ASSET,DR,true,false,1000`,
        [],
      ),
    ).toThrow(/nonposting/);
  });
  it('rejects invalid data and malformed CSV', () => {
    expect(() => parseChartCsv('code,name\n1,A', [])).toThrow(/template/);
    expect(() =>
      parseChartCsv(`${CHART_CSV_HEADER}\n1000,A,ASSET,DR,maybe,false,`, []),
    ).toThrow(/true or false/);
    expect(() =>
      parseChartCsv(`${CHART_CSV_HEADER}\n1000,"Unclosed`, []),
    ).toThrow(/not closed/);
  });
  it('previews accounts and adds them only after explicit confirmation', async () => {
    const add = vi.fn();
    render(<ChartCsvImport existing={[]} onAdd={add} />);
    const file = new File([csv], 'accounts.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'text', { value: async () => csv });
    fireEvent.change(screen.getByLabelText('Choose CSV file'), {
      target: { files: [file] },
    });
    expect(
      await screen.findByText('2 accounts ready to add'),
    ).toBeInTheDocument();
    expect(add).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Add accounts to draft' }),
    );
    expect(add).toHaveBeenCalledWith(parseChartCsv(csv, []));
  });
  it('revalidates before adding if the draft changes after preview', async () => {
    const add = vi.fn();
    const view = render(<ChartCsvImport existing={[]} onAdd={add} />);
    const file = new File([csv], 'accounts.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'text', { value: async () => csv });
    fireEvent.change(screen.getByLabelText('Choose CSV file'), {
      target: { files: [file] },
    });
    await screen.findByText('2 accounts ready to add');
    view.rerender(
      <ChartCsvImport
        existing={[
          {
            code: '1000',
            type: 'ASSET',
            posting: false,
            control: false,
            parentCode: null,
          },
        ]}
        onAdd={add}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Add accounts to draft' }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/unique/);
    expect(add).not.toHaveBeenCalled();
  });
});
