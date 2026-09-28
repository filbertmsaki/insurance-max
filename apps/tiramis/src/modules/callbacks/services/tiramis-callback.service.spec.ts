import { TiramisXmlBuilderService } from '../../messaging/services/tiramis-xml-builder.service';
import { TiramisXmlParserService } from '../../messaging/services/tiramis-xml-parser.service';
import { TiramisCallbackService } from './tiramis-callback.service';
import { createHash } from 'crypto';

function createService(overrides: Record<string, any> = {}) {
  const tiramisConfigService = {
    getRuntimeConfigurationById: jest
      .fn()
      .mockResolvedValue({ id: 'config-from-transaction' }),
    getActiveConfiguration: jest
      .fn()
      .mockResolvedValue({ id: 'active-config' }),
    getPfxPathsForConfiguration: jest.fn().mockResolvedValue({
      clientPrivateCertificatePath: 'client.pfx',
      clientPrivateCertificatePassword: 'secret',
      tiraPublicCertificatePath: 'tira-public.pfx',
      tiraPublicCertificatePassword: 'tira-secret',
    }),
    isSuccessResponse: jest.fn().mockResolvedValue(false),
    ...overrides.tiramisConfigService,
  };

  const tiramisSubmissionService = {
    getTransactionForNotification: jest.fn().mockResolvedValue({
      clientConfigurationId: 'config-from-transaction',
    }),
    ...overrides.tiramisSubmissionService,
  };

  const signatureService = {
    signXmlContent: jest.fn().mockReturnValue('SIGNED_ACK'),
    verifyXmlContent: jest.fn().mockReturnValue(true),
    ...overrides.signatureService,
  };

  const deadLetterRepository = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    ...overrides.deadLetterRepository,
  };

  const requestLog = { append: jest.fn().mockResolvedValue(undefined) };
  const service = new TiramisCallbackService(
    {} as any,
    {} as any,
    deadLetterRepository,
    {} as any,
    tiramisConfigService,
    tiramisSubmissionService,
    { generate: jest.fn().mockReturnValue('ACK-001') },
    new TiramisXmlBuilderService(),
    new TiramisXmlParserService(),
    signatureService,
    {} as any,
    {} as any,
    requestLog as any,
  );

  return {
    service,
    tiramisConfigService,
    tiramisSubmissionService,
    signatureService,
    deadLetterRepository,
    requestLog,
  };
}

describe('TiramisCallbackService', () => {
  it('appends callback XML and returned acknowledgement under the TIRA request ID', async () => {
    const { service, requestLog } = createService();
    jest.spyOn(service as any, 'parseCallback').mockReturnValue({
      requestId: 'Aiic',
      responseId: 'RESP-1',
      responseStatusCode: 'TIRA001',
    });
    jest.spyOn(service as any, 'processParsedCallback').mockResolvedValue({
      acknowledgementStatusCode: 'TIRA001',
      acknowledgementXml: '<Ack/>',
    });
    await service.handleCallback({
      environment: 'live',
      rawXml: '<Callback/>',
    });
    expect(requestLog.append).toHaveBeenNthCalledWith(
      1,
      'Aiic',
      expect.objectContaining({
        event: 'tira.callback.received',
        xml: '<Callback/>',
        internalTest: false,
      }),
    );
    expect(requestLog.append).toHaveBeenNthCalledWith(
      2,
      'Aiic',
      expect.objectContaining({
        event: 'tira.callback.acknowledgement',
        xml: '<Ack/>',
      }),
    );
  });

  it('logs callback failures and propagates the original error', async () => {
    const { service, requestLog } = createService();
    const error = new Error('Callback failed');
    jest
      .spyOn(service as any, 'parseCallback')
      .mockReturnValue({ requestId: 'Aiic' });
    jest
      .spyOn(service as any, 'processParsedCallback')
      .mockRejectedValue(error);
    await expect(
      service.handleCallback({ environment: 'live', rawXml: '<Callback/>' }),
    ).rejects.toBe(error);
    expect(requestLog.append).toHaveBeenLastCalledWith('Aiic', {
      event: 'tira.callback.failed',
      message: 'Callback failed',
    });
  });

  it('parses documented nested callback headers and details', () => {
    const { service } = createService();

    const parsed = (service as any).parseCallback(`
      <TiraMsg>
        <CoverNoteRefRes>
          <CoverNoteHdr>
            <ResponseId>RESP-001</ResponseId>
            <RequestId>REQ-001</RequestId>
            <ResponseStatusCode>TIRA001</ResponseStatusCode>
            <ResponseStatusDesc>Successful</ResponseStatusDesc>
          </CoverNoteHdr>
          <CoverNoteDtl>
            <CoverNoteReferenceNumber>CN-REF-001</CoverNoteReferenceNumber>
            <StickerNumber>STICKER-001</StickerNumber>
          </CoverNoteDtl>
        </CoverNoteRefRes>
        <MsgSignature>RESPONSE_SIGNATURE</MsgSignature>
      </TiraMsg>
    `);

    expect(parsed.requestId).toBe('REQ-001');
    expect(parsed.responseId).toBe('RESP-001');
    expect(parsed.responseStatusCode).toBe('TIRA001');
    expect(parsed.responseStatusDesc).toBe('Successful');
    expect(parsed.coverNoteReferenceNumber).toBe('CN-REF-001');
    expect(parsed.stickerNumber).toBe('STICKER-001');
    expect(parsed.signature).toBe('RESPONSE_SIGNATURE');
  });

  it('parses the direct motor callback format from TIRA', () => {
    const { service } = createService();

    const parsed = (service as any).parseCallback(`
      <?xml version="1.0" encoding="UTF-8"?>
      <TiraMsg>
        <MotorCoverNoteRefRes>
          <ResponseId>202607191123294522872</ResponseId>
          <RequestId>AICCNRR19070658</RequestId>
          <CoverNoteReferenceNumber>11026-19427-56213</CoverNoteReferenceNumber>
          <StickerNumber>26001-19481-73513</StickerNumber>
          <ResponseStatusCode>TIRA001</ResponseStatusCode>
          <ResponseStatusDesc>Successful</ResponseStatusDesc>
        </MotorCoverNoteRefRes>
        <MsgSignature>RESPONSE_SIGNATURE</MsgSignature>
      </TiraMsg>
    `);

    expect(parsed.rootName).toBe('MotorCoverNoteRefRes');
    expect(parsed.requestId).toBe('AICCNRR19070658');
    expect(parsed.responseId).toBe('202607191123294522872');
    expect(parsed.responseStatusCode).toBe('TIRA001');
    expect(parsed.responseStatusDesc).toBe('Successful');
    expect(parsed.coverNoteReferenceNumber).toBe('11026-19427-56213');
    expect(parsed.stickerNumber).toBe('26001-19481-73513');
    expect(parsed.signature).toBe('RESPONSE_SIGNATURE');
  });

  it('treats TIRA214 transaction cancellation callbacks as successful final responses', async () => {
    const { service, tiramisConfigService } = createService({
      tiramisConfigService: {
        isSuccessResponse: jest.fn().mockResolvedValue(false),
      },
    });

    await expect(
      (service as any).isSuccessfulFinalResponse({
        responseStatusCode: 'TIRA214',
        responseStatusDesc: 'Transaction successfully cancelled',
      }),
    ).resolves.toBe(true);
    expect(tiramisConfigService.isSuccessResponse).toHaveBeenCalledWith(
      'TIRA214',
    );
  });

  it('parses a motor fleet callback header from TIRA', () => {
    const { service } = createService();

    const parsed = (service as any).parseCallback(`
      <TiraMsg>
        <MotorCoverNoteRefRes>
          <FleetResHdr>
            <ResponseId>TIRA22424232355</ResponseId>
            <RequestId>YOURS22424232355</RequestId>
            <FleetId>FL122340</FleetId>
            <FleetStatusCode>TIRA001</FleetStatusCode>
            <FleetStatusDesc>Successful</FleetStatusDesc>
          </FleetResHdr>
          <FleetResDtl>
            <FleetEntry>1</FleetEntry>
            <CoverNoteNumber>NIC00004</CoverNoteNumber>
            <CoverNoteReferenceNumber>23579-00033-25251</CoverNoteReferenceNumber>
            <StickerNumber>33245-24444-52533</StickerNumber>
            <ResponseStatusCode>TIRA001</ResponseStatusCode>
            <ResponseStatusDesc>Successful</ResponseStatusDesc>
          </FleetResDtl>
        </MotorCoverNoteRefRes>
        <MsgSignature>RESPONSE_SIGNATURE</MsgSignature>
      </TiraMsg>
    `);

    expect(parsed.requestId).toBe('YOURS22424232355');
    expect(parsed.responseId).toBe('TIRA22424232355');
    expect(parsed.responseStatusCode).toBe('TIRA001');
    expect(parsed.responseStatusDesc).toBe('Successful');
  });

  it('signs response acknowledgements with the original transaction configuration', async () => {
    const { service, tiramisConfigService, signatureService } = createService();

    const result = await (service as any).buildFinalResponseAcknowledgementXml({
      environment: 'test',
      finalResponse: {
        requestId: 'REQ-001',
        responseId: 'RESP-001',
        responseAckRoot: 'CoverNoteRefResAck',
      },
    });

    expect(
      tiramisConfigService.getRuntimeConfigurationById,
    ).toHaveBeenCalledWith('config-from-transaction');
    expect(tiramisConfigService.getActiveConfiguration).not.toHaveBeenCalled();
    expect(signatureService.signXmlContent).toHaveBeenCalledWith(
      expect.objectContaining({
        privateKeyPfxPath: 'client.pfx',
        privateKeyPfxPassword: 'secret',
      }),
    );
    expect(result.acknowledgementId).toBe('ACK-001');
    expect(result.responseId).toBe('RESP-001');
    expect(result.acknowledgementXml).toContain('<CoverNoteRefResAck>');
    expect(result.acknowledgementXml).toContain(
      '<MsgSignature>SIGNED_ACK</MsgSignature>',
    );
  });

  it('verifies callback signatures with the original transaction configuration', async () => {
    const { service, tiramisConfigService, signatureService } = createService();

    const result = await (service as any).verifyCallbackSignature({
      environment: 'test',
      parsedCallback: {
        requestId: 'REQ-001',
        contentXml: '<CoverNoteRefRes></CoverNoteRefRes>',
        signature: 'RESPONSE_SIGNATURE',
      },
    });

    expect(result).toEqual({ isValid: true });
    expect(
      tiramisConfigService.getRuntimeConfigurationById,
    ).toHaveBeenCalledWith('config-from-transaction');
    expect(tiramisConfigService.getActiveConfiguration).not.toHaveBeenCalled();
    expect(signatureService.verifyXmlContent).toHaveBeenCalledWith({
      contentXml: '<CoverNoteRefRes></CoverNoteRefRes>',
      signature: 'RESPONSE_SIGNATURE',
      publicCertificatePfxPath: 'tira-public.pfx',
      publicCertificatePfxPassword: 'tira-secret',
    });
  });

  it('processes authenticated internal live callback tests without verifying a TIRA signature', async () => {
    const { service, signatureService } = createService();
    const parsedCallback = {
      requestId: 'REQ-001',
      responseId: 'RESP-001',
      rawXml: '<TiraMsg />',
      signatureVerified: false,
    } as any;
    const acknowledgement = {
      acknowledgementXml: '<TiraMsg />',
    } as any;

    jest.spyOn(service as any, 'parseCallback').mockReturnValue(parsedCallback);
    jest
      .spyOn(service as any, 'handleCallbackReplayIfExists')
      .mockResolvedValue({ isReplay: true, acknowledgement });

    await expect(
      service.handleInternalLiveTestCallback('<TiraMsg />'),
    ).resolves.toBe(acknowledgement);

    expect(signatureService.verifyXmlContent).not.toHaveBeenCalled();
    expect(parsedCallback.signatureVerified).toBe(true);
    expect((service as any).handleCallbackReplayIfExists).toHaveBeenCalledWith(
      expect.objectContaining({ environment: 'live', parsedCallback }),
    );
  });

  it('stores a payload hash when quarantining callback XML', async () => {
    const { service, deadLetterRepository } = createService();
    const rawXml = '<TiraMsg><BadCallback /></TiraMsg>';

    await (service as any).quarantineCallback({
      environment: 'test',
      rawXml,
      reason: 'Invalid callback',
    });

    expect(deadLetterRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        rawXml,
        payloadHash: createHash('sha256').update(rawXml, 'utf8').digest('hex'),
        reason: 'Invalid callback',
      }),
    );
  });
});
