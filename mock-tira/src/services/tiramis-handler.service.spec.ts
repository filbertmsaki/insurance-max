const {
  isCoverCancellationEndorsement,
  resolveFinalResponseStatus,
} = require('./tiramis-handler.service.js');

describe('tiramis-handler cancellation endorsements', () => {
  it('recognizes cover cancellation endorsements only when both fields match', () => {
    expect(
      isCoverCancellationEndorsement(
        '<CoverNoteRefReq><CoverNoteType>3</CoverNoteType><EndorsementType>4</EndorsementType></CoverNoteRefReq>',
      ),
    ).toBe(true);

    expect(
      isCoverCancellationEndorsement(
        '<CoverNoteRefReq><CoverNoteType>3</CoverNoteType><EndorsementType>1</EndorsementType></CoverNoteRefReq>',
      ),
    ).toBe(false);

    expect(
      isCoverCancellationEndorsement(
        '<CoverNoteRefReq><CoverNoteType>1</CoverNoteType><EndorsementType>4</EndorsementType></CoverNoteRefReq>',
      ),
    ).toBe(false);
  });

  it('returns the cancellation success description for cancellation endorsements', () => {
    expect(
      resolveFinalResponseStatus({
        xml: '<MotorCoverNoteRefReq><CoverNoteType>3</CoverNoteType><EndorsementType>4</EndorsementType></MotorCoverNoteRefReq>',
        finalStatus: {
          code: 'TIRA001',
          desc: 'Successful',
        },
      }),
    ).toEqual({
      code: 'TIRA001',
      desc: 'Transaction successfully cancelled',
    });
  });

  it('keeps the existing success description for other endorsements and new business', () => {
    expect(
      resolveFinalResponseStatus({
        xml: '<CoverNoteRefReq><CoverNoteType>3</CoverNoteType><EndorsementType>2</EndorsementType></CoverNoteRefReq>',
        finalStatus: {
          code: 'TIRA001',
          desc: 'Successful',
        },
      }),
    ).toEqual({
      code: 'TIRA001',
      desc: 'Successful',
    });

    expect(
      resolveFinalResponseStatus({
        xml: '<CoverNoteRefReq><CoverNoteType>1</CoverNoteType></CoverNoteRefReq>',
        finalStatus: {
          code: 'TIRA001',
          desc: 'Successful',
        },
      }),
    ).toEqual({
      code: 'TIRA001',
      desc: 'Successful',
    });
  });
});
