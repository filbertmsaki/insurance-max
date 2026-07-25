import {
  normalizeTiramisResponseDescription,
  resolveTiramisCallbackOutcome,
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

    expect(
      resolveTiramisCallbackOutcome(
        ' TIRA001 ',
        '  TRANSACTION SUCCESSFULLY CANCELLED  ',
      ),
    ).toBe('CANCELLED');
  });

  it('treats the standard successful description as completion', () => {
    expect(
      resolveTiramisSuccessOutcome({
        statusCode: 'TIRA001',
        statusDescription: 'Successful',
      }),
    ).toBe('COMPLETED');

    expect(resolveTiramisCallbackOutcome('TIRA001', ' Successful ')).toBe(
      'COMPLETED',
    );
  });

  it('keeps unrecognized success descriptions in the generic success path', () => {
    expect(
      resolveTiramisSuccessOutcome({
        statusCode: 'TIRA001',
        statusDescription: 'Processed successfully by partner',
      }),
    ).toBe('OTHER_SUCCESS');

    expect(
      resolveTiramisCallbackOutcome(
        'TIRA001',
        'Processed successfully by partner',
      ),
    ).toBe('SUCCESS');
  });

  it('does not classify non-success response codes as successful outcomes', () => {
    expect(
      resolveTiramisSuccessOutcome({
        statusCode: 'TIRA005',
        statusDescription: 'Transaction successfully cancelled',
      }),
    ).toBe('NOT_SUCCESS');

    expect(resolveTiramisCallbackOutcome('TIRA002', 'Successful')).toBe(
      'FAILED',
    );
  });
});
