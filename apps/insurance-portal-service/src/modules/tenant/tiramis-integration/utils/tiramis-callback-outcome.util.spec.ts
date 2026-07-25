import {
  normalizeTiramisResponseDescription,
  resolveTiramisSuccessOutcome,
} from './tiramis-callback-outcome.util';

describe('tiramis callback outcome util', () => {
  it('matches cancellation descriptions case-insensitively after trimming whitespace', () => {
    expect(
      normalizeTiramisResponseDescription(
        '  Transaction Successfully Cancelled  ',
      ),
    ).toBe('transaction successfully cancelled');

    expect(
      resolveTiramisSuccessOutcome({
        statusCode: 'TIRA001',
        statusDescription: '  Transaction Successfully Cancelled  ',
      }),
    ).toBe('CANCELLED');
  });

  it('treats the standard successful description as completion', () => {
    expect(
      resolveTiramisSuccessOutcome({
        statusCode: 'TIRA001',
        statusDescription: 'Successful',
      }),
    ).toBe('COMPLETED');
  });

  it('does not classify non-success response codes as successful outcomes', () => {
    expect(
      resolveTiramisSuccessOutcome({
        statusCode: 'TIRA005',
        statusDescription: 'Transaction successfully cancelled',
      }),
    ).toBe('NOT_SUCCESS');
  });
});
