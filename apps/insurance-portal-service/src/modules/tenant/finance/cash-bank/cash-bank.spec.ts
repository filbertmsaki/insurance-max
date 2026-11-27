import { statementRows } from './cash-bank-statements';
import { physicalCount } from './cash-bank-setup';

describe('Cash office and bank statement input', () => {
  it('reads quoted references, debit and credit columns, local dates and grouped amounts', () => {
    const rows = statementRows(
      {
        csv: '\uFEFFDate;Description;Ref;Debit;Credit\r\n01/02/2026;"Rent; HQ";"REF ""002""";1,200.50;\r\n02/02/2026;Interest;INT;;0.25',
        delimiter: ';',
        dateFormat: 'DD/MM/YYYY',
        dateColumn: 'Date',
        descriptionColumn: 'Description',
        referenceColumn: 'Ref',
        debitColumn: 'Debit',
        creditColumn: 'Credit',
      },
      2,
    );
    expect(rows).toEqual([
      {
        day: '2026-02-01',
        reference: 'REF "002"',
        description: 'Rent; HQ',
        amount: '-1200.5',
      },
      {
        day: '2026-02-02',
        reference: 'INT',
        description: 'Interest',
        amount: '0.25',
      },
    ]);
  });
  it.each([
    '2026-02-29,R,1',
    '2026-02-01,R,1.001',
    '2026-02-01,R,0',
    '2026-02-01,"unterminated,12',
    '2026-02-01,R,4,55',
  ])('rejects invalid or ambiguous statement row %s', (row) => {
    expect(() =>
      statementRows({ csv: 'date,reference,amount\n' + row }, 2),
    ).toThrow();
  });
  it('checks the physical count against denominations', () => {
    expect(
      physicalCount(
        {
          amount: '100000000000000000000.01',
          denominations: '100000000000000000000 * 1\n0.01 * 1',
        },
        2,
      ).toFixed(),
    ).toBe('100000000000000000000.01');
    expect(
      physicalCount(
        { amount: '102000', denominations: '10000 * 10\n1000 * 2' },
        2,
      ).toFixed(),
    ).toBe('102000');
    expect(() =>
      physicalCount({ amount: '100000', denominations: '10000 * 9' }, 2),
    ).toThrow();
  });
  it('checks statement currency and accepts descriptions when the bank supplies no reference', () => {
    const csv =
      'date,description,amount,currency\n2026-02-10,Account fee,-2.50,TZS';
    expect(statementRows({ csv }, 2, 'TZS')[0]).toMatchObject({
      reference: 'Account fee',
      amount: '-2.5',
    });
    expect(() => statementRows({ csv }, 2, 'USD')).toThrow('must be USD');
  });
});
