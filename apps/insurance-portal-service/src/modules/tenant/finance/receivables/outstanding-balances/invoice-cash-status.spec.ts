import { invoiceCashStatus } from './invoice-cash-status';
describe('policy premium cash settlement', () => {
  it.each([
    ['0', '0', 'ISSUED'],
    ['10000000', '0', 'PARTIALLY_PAID'],
    ['15000000', '0', 'PAID'],
    ['16000000', '0', 'OVERPAID'],
    ['15000000', '200000', 'PARTIALLY_PAID'],
  ])(
    'uses collected %s and adjusted outstanding %s for cover and commission',
    (paid, balance, expected) => {
      expect(
        invoiceCashStatus({
          status: 'PAID',
          total_amount: '15000000',
          paid_amount: paid,
          balance_amount: balance,
        }),
      ).toBe(expected);
    },
  );
});
