import { TiramisBusinessRecordSyncService } from './tiramis-business-record-sync.service';

describe('TiramisBusinessRecordSyncService', () => {
  it('extracts motor callback references from a completed attempt response XML', () => {
    const service = new TiramisBusinessRecordSyncService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = (service as any).extractRegulatoryResponse({
      tiramisResponsePayload: {
        attempts: [
          {
            payloads: {
              responseXml: `
                <TiraMsg>
                  <MotorCoverNoteRefRes>
                    <CoverNoteReferenceNumber>11026-19427-56213</CoverNoteReferenceNumber>
                    <StickerNumber>26001-19481-73513</StickerNumber>
                  </MotorCoverNoteRefRes>
                </TiraMsg>
              `,
            },
          },
        ],
      },
    });

    expect(result).toEqual({
      coverNotes: [
        {
          coverNoteReferenceNumber: '11026-19427-56213',
          stickerNumber: '26001-19481-73513',
        },
      ],
      policy: null,
    });
  });
});
