import {
  resolveTiramisCallbackOutcome,
} from './tiramis-callback-outcome.util';

describe('resolveTiramisCallbackOutcome', () => {
  it('classifies the exact successful cancellation response', () => {
    expect(
      resolveTiramisCallbackOutcome(
        ' TIRA001 ',
        '  TRANSACTION SUCCESSFULLY CANCELLED  ',
      ),
    ).toBe('CANCELLED');
  });

  it('classifies the normal successful response', () => {
    expect(resolveTiramisCallbackOutcome('TIRA001', ' Successful ')).toBe(
      'COMPLETED',
    );
  });

  it('does not classify cancellation as normal completion', () => {
    expect(
      resolveTiramisCallbackOutcome(
        'TIRA001',
        'Transaction successfully cancelled',
      ),
    ).not.toBe('COMPLETED');
  });

  it('keeps non-success responses in the failure path', () => {
    expect(resolveTiramisCallbackOutcome('TIRA002', 'Successful')).toBe(
      'FAILED',
    );
  });
});
