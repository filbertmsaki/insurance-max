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
    getSubmittedRequestXml: jest.fn().mockResolvedValue('<SubmittedRequest/>'),
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

  const callbackReceiptRepository = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    ...overrides.callbackReceiptRepository,
  };

  const portalNotificationService = {
    publish: jest.fn().mockResolvedValue(undefined),
    ...overrides.portalNotificationService,
  };

  const callbackBusinessUpdater = {
    updateBusinessRecord: jest.fn().mockResolvedValue(null),
    ...overrides.callbackBusinessUpdater,
  };

  const xmlParser = new TiramisXmlParserService();

  const requestLog = {
    append: jest.fn().mockResolvedValue(undefined),
    sanitizeXml: jest.fn((xml?: string | null) =>
      xml
        ? xml.replace(
            /<MsgSignature>[\s\S]*?<\/MsgSignature>/gi,
            '<MsgSignature>[redacted]</MsgSignature>',
          )
        : (xml ?? null),
    ),
  };
  const configService = {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === 'tiramisService.callbackDeadLetterRawXmlMode') {
        return overrides.callbackDeadLetterRawXmlMode ?? fallback;
      }
      return fallback;
    }),
  };
  const service = new TiramisCallbackService(
    {} as any,
    {} as any,
    deadLetterRepository,
    callbackReceiptRepository,
    tiramisConfigService,
    tiramisSubmissionService,
    { generate: jest.fn().mockReturnValue('ACK-001') },
    new TiramisXmlBuilderService(),
    xmlParser,
    signatureService,
    portalNotificationService,
    callbackBusinessUpdater,
    requestLog as any,
    configService as any,
  );

  return {
    service,
    tiramisConfigService,
    tiramisSubmissionService,
    signatureService,
    deadLetterRepository,
    callbackReceiptRepository,
    portalNotificationService,
    callbackBusinessUpdater,
    xmlParser,
    requestLog,
    configService,
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

  it('returns one cover-note reference per fleet vehicle', () => {
    const { service } = createService();
    const vehicle = (entry: number, coverNote: string, reference: string) => `
          <FleetResDtl>
            <FleetEntry>${entry}</FleetEntry>
            <CoverNoteNumber>${coverNote}</CoverNoteNumber>
            <CoverNoteReferenceNumber>${reference}</CoverNoteReferenceNumber>
            <StickerNumber>STK-${entry}</StickerNumber>
            <ResponseStatusCode>TIRA001</ResponseStatusCode>
            <ResponseStatusDesc>Successful</ResponseStatusDesc>
          </FleetResDtl>`;

    const parsed = (service as any).parseCallback(`
      <TiraMsg>
        <MotorCoverNoteRefRes>
          <FleetResHdr>
            <ResponseId>RESP-1</ResponseId>
            <RequestId>REQ-1</RequestId>
            <FleetId>FL1</FleetId>
            <FleetStatusCode>TIRA001</FleetStatusCode>
            <FleetStatusDesc>Successful</FleetStatusDesc>
          </FleetResHdr>
          ${vehicle(1, 'CN-1', 'REF-1')}
          ${vehicle(2, 'CN-2', 'REF-2')}
        </MotorCoverNoteRefRes>
        <MsgSignature>SIG</MsgSignature>
      </TiraMsg>
    `);

    const response = (service as any).buildRegulatoryResponse(
      parsed,
      {
        requestId: 'REQ-1',
        responseId: 'RESP-1',
        responseStatusCode: 'TIRA001',
        responseStatusDesc: 'Successful',
      },
      'MotorCoverNoteRefReq',
      'Q-1',
    );

    expect(response.coverNotes).toEqual([
      expect.objectContaining({
        fleetEntry: 1,
        sourceCoverNoteNumber: 'CN-1',
        coverNoteReferenceNumber: 'REF-1',
        stickerNumber: 'STK-1',
      }),
      expect.objectContaining({
        fleetEntry: 2,
        sourceCoverNoteNumber: 'CN-2',
        coverNoteReferenceNumber: 'REF-2',
        stickerNumber: 'STK-2',
      }),
    ]);
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

  it('notifies the portal immediately after persisting the final response', async () => {
    const order: string[] = [];
    const { service, xmlParser, portalNotificationService } = createService({
      tiramisConfigService: {
        isSuccessResponse: jest.fn().mockResolvedValue(true),
      },
      tiramisSubmissionService: {
        getTransactionForNotification: jest.fn().mockResolvedValue({
          id: 'transaction-1',
          clientConfigurationId: 'config-from-transaction',
          portalWebhookUrl:
            'https://portal.example.test/api/v1/webhooks/tiramis/notifications',
          serviceType: 'CLAIM_NOTIFICATION',
          businessReference: 'CLM-001',
        }),
        markFinalResponseReceived: jest.fn().mockImplementation(async () => {
          order.push('final-response');
        }),
        markResponseAcknowledgementSent: jest
          .fn()
          .mockImplementation(async () => {
            order.push('acknowledgement-saved');
          }),
      },
      portalNotificationService: {
        publish: jest.fn().mockImplementation(async () => {
          order.push('portal-notified');
        }),
      },
      callbackBusinessUpdater: {
        updateBusinessRecord: jest.fn().mockImplementation(async () => {
          order.push('business-updated');
        }),
      },
    });

    jest.spyOn(xmlParser, 'extractFinalResponse').mockReturnValue({
      rootElement: 'ClaimNotificationRefRes',
      responseAckRoot: 'ClaimNotificationRefResAck',
      requestId: 'REQ-001',
      responseId: 'RESP-001',
      responseStatusCode: 'TIRA001',
      responseStatusDesc: 'Successful',
      serviceType: 'CLAIM_NOTIFICATION',
      payload: {},
    } as any);

    await (service as any).processParsedCallback(
      {
        environment: 'live',
        rawXml: '<TiraMsg />',
        bypassSignatureVerification: true,
      },
      {
        rootName: 'ClaimNotificationRefRes',
        requestId: 'REQ-001',
        responseId: 'RESP-001',
        responseStatusCode: 'TIRA001',
        responseStatusDesc: 'Successful',
        rawXml: '<TiraMsg />',
        contentXml: '<ClaimNotificationRefRes />',
      },
    );

    expect(portalNotificationService.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'TIRAMIS_FINAL_SUCCESS',
        requestId: 'REQ-001',
        submittedRequestXml: '<SubmittedRequest/>',
      }),
      expect.objectContaining({
        webhookUrl:
          'https://portal.example.test/api/v1/webhooks/tiramis/notifications',
        clientConfigurationId: 'config-from-transaction',
      }),
    );
    expect(order).toEqual([
      'final-response',
      'portal-notified',
      'business-updated',
      'acknowledgement-saved',
    ]);
  });

  it('processes authenticated internal production callback tests without verifying a TIRA signature', async () => {
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
      expect.objectContaining({ environment: 'production', parsedCallback }),
    );
  });

  it('stores a payload hash and redacted XML when quarantining callback XML', async () => {
    const { service, deadLetterRepository } = createService();
    const rawXml =
      '<TiraMsg><BadCallback /><MsgSignature>secret-signature</MsgSignature></TiraMsg>';

    await (service as any).quarantineCallback({
      environment: 'test',
      rawXml,
      reason: 'Invalid callback',
    });

    expect(deadLetterRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        rawXml:
          '<TiraMsg><BadCallback /><MsgSignature>[redacted]</MsgSignature></TiraMsg>',
        payloadHash: createHash('sha256').update(rawXml, 'utf8').digest('hex'),
        reason: 'Invalid callback',
      }),
    );
  });

  it('can disable raw XML storage in callback dead letters', async () => {
    const { service, deadLetterRepository } = createService({
      callbackDeadLetterRawXmlMode: 'off',
    });
    const rawXml = '<TiraMsg><MsgSignature>secret</MsgSignature></TiraMsg>';

    await (service as any).quarantineCallback({
      environment: 'test',
      rawXml,
      reason: 'Invalid callback',
    });

    expect(deadLetterRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        rawXml: null,
        payloadHash: createHash('sha256').update(rawXml, 'utf8').digest('hex'),
      }),
    );
  });
});

describe('TiramisCallbackService callback configuration resolution', () => {
  it('rejects a callback whose URL environment differs from the transaction environment', async () => {
    const { service } = createService({
      tiramisConfigService: {
        getRuntimeConfigurationById: jest
          .fn()
          .mockResolvedValue({ id: 'config-test', environment: 'test' }),
      },
    });

    await expect(
      (service as any).verifyCallbackSignature({
        environment: 'live',
        parsedCallback: {
          requestId: 'REQ-1',
          signature: 'sig',
          contentXml: '<Content/>',
        },
      }),
    ).resolves.toEqual({
      isValid: false,
      reason:
        'TIRAMIS callback environment live does not match the test environment of request REQ-1',
    });
  });

  it("verifies an unknown request with the environment's system identity, never another company's configuration", async () => {
    const systemConfiguration = { id: undefined, environment: 'live' };
    const { service, tiramisConfigService } = createService({
      tiramisSubmissionService: {
        getTransactionForNotification: jest.fn().mockResolvedValue(null),
      },
      tiramisConfigService: {
        getSystemRuntimeConfiguration: jest
          .fn()
          .mockReturnValue(systemConfiguration),
      },
    });

    await expect(
      (service as any).resolveCallbackConfiguration({
        environment: 'live',
        requestId: 'UNKNOWN',
      }),
    ).resolves.toBe(systemConfiguration);
    expect(
      tiramisConfigService.getSystemRuntimeConfiguration,
    ).toHaveBeenCalledWith('live');
    expect(tiramisConfigService.getActiveConfiguration).not.toHaveBeenCalled();
  });
});
