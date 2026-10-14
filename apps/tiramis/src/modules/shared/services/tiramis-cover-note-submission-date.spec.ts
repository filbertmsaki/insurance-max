import { TiramisCoverNoteService } from '../../cover-notes/services/tiramis-cover-note.service';
import { TiramisMotorService } from '../../motor/services/tiramis-motor.service';
import { TiramisCoverPeriodService } from './tiramis-cover-period.service';

describe('initial cover note submissions', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-14T07:53:11.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each(['motor', 'non-motor'])(
    'adjusts %s dates before signing and sending, preserving 30 full days',
    async (kind) => {
      const dto = {
        coverNoteNumber: 'CN-001',
        coverNoteStartDate: '2026-10-13T10:53:11',
        coverNoteEndDate: '2026-11-12T10:53:11',
        isFleet: false,
        companyCode: 'TEST',
        clientConfigurationId: 'config-1',
      };
      const config = {
        resolveSubmissionContext: jest.fn().mockResolvedValue({
          configuration: { id: 'config-1' },
          dto: { ...dto },
        }),
        getTiraCallbackUrlForServiceType: jest
          .fn()
          .mockReturnValue('https://callback.example'),
        getPfxPathsForConfiguration: jest.fn().mockResolvedValue({
          clientPrivateCertificatePath: 'client.pfx',
          clientPrivateCertificatePassword: 'secret',
        }),
        getFullEndpointUrlForConfiguration: jest
          .fn()
          .mockResolvedValue('https://tira.example'),
        getRequestHeadersForConfiguration: jest.fn().mockResolvedValue({}),
      };
      const coverNoteRepository = {
        setSubmittedCoverPeriod: jest.fn().mockResolvedValue(undefined),
        setCurrentAttempt: jest.fn().mockResolvedValue(undefined),
      };
      const submission = {
        findByIdempotencyKey: jest.fn().mockResolvedValue(null),
        createAttempt: jest.fn().mockResolvedValue({ id: 'attempt-1' }),
        recordCoverPeriodValidation: jest.fn().mockResolvedValue(undefined),
        markSent: jest.fn().mockResolvedValue(undefined),
        markFailed: jest.fn().mockResolvedValue({ status: 'FAILED' }),
      };
      const payload = {
        buildMotorCoverNotePayload: jest.fn(({ dto: value }) => ({
          CoverNoteStartDate: value.coverNoteStartDate,
          CoverNoteEndDate: value.coverNoteEndDate,
        })),
        buildFromDto: jest.fn(({ dto: value }) => ({
          CoverNoteStartDate: value.coverNoteStartDate,
          CoverNoteEndDate: value.coverNoteEndDate,
        })),
      };
      const xmlBuilder = {
        buildContentXml: jest.fn((_root, value) => JSON.stringify(value)),
        buildSignedTiraMessageFromContent: jest.fn(
          ({ contentXml }) => contentXml,
        ),
      };
      const signature = {
        signXmlContent: jest.fn().mockReturnValue('signature'),
      };
      const httpClient = {
        postXml: jest.fn().mockResolvedValue({ statusCode: 500, rawXml: '' }),
      };
      const coverPeriod = new TiramisCoverPeriodService();
      const wording = { assertCoverNoteWording: jest.fn() };
      const noop = {} as any;
      const service =
        kind === 'motor'
          ? new TiramisMotorService(
              coverNoteRepository as any,
              noop,
              payload as any,
              config as any,
              noop,
              submission as any,
              xmlBuilder as any,
              noop,
              signature as any,
              httpClient as any,
              noop,
              wording as any,
              coverPeriod,
            )
          : new TiramisCoverNoteService(
              coverNoteRepository as any,
              payload as any,
              config as any,
              noop,
              submission as any,
              xmlBuilder as any,
              noop,
              signature as any,
              httpClient as any,
              noop,
              wording as any,
              coverPeriod,
            );
      jest.spyOn(service, 'createDraft').mockResolvedValue({
        transaction: { id: 'txn-1' },
        coverNote: { id: 'cover-1', requestId: 'REQ-1' },
      } as any);

      await service.submit(dto as any, {
        portalWebhookUrl:
          'https://portal.example/api/v1/webhooks/tiramis/notifications',
      });

      expect(httpClient.postXml).toHaveBeenCalledWith(
        expect.objectContaining({
          xml: expect.stringContaining('2026-11-13T10:53:17'),
        }),
      );
      expect(submission.recordCoverPeriodValidation).toHaveBeenCalledWith(
        expect.objectContaining({
          originalStartDateTime: '2026-10-13T10:53:11',
          startDateTime: '2026-10-14T10:53:17',
          endDateTime: '2026-11-13T10:53:17',
          durationMilliseconds: 30 * 24 * 60 * 60 * 1000,
          adjusted: true,
        }),
      );
      expect(coverNoteRepository.setSubmittedCoverPeriod).toHaveBeenCalled();
    },
  );
});
