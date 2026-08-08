import { TiramisXmlBuilderService } from '../../messaging/services/tiramis-xml-builder.service';
import { TiramisXmlParserService } from '../../messaging/services/tiramis-xml-parser.service';
import { TiramisCallbackService } from './tiramis-callback.service';
import { createHash } from 'crypto';

function createService(overrides: Record<string, any> = {}) {
  const tiramisConfigService = {
    getRuntimeConfigurationById: jest
      .fn()
      .mockResolvedValue({ id: 'config-from-transaction' }),
    getActiveConfiguration: jest.fn().mockResolvedValue({ id: 'active-config' }),
    getPfxPathsForConfiguration: jest.fn().mockResolvedValue({
      clientPrivateCertificatePath: 'client.pfx',
      clientPrivateCertificatePassword: 'secret',
      tiraPublicCertificatePath: 'tira-public.pfx',
      tiraPublicCertificatePassword: 'tira-secret',
    }),
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

  const service = new TiramisCallbackService(
    {} as any,
    {} as any,
    deadLetterRepository as any,
    {} as any,
    tiramisConfigService as any,
    tiramisSubmissionService as any,
    { generate: jest.fn().mockReturnValue('ACK-001') } as any,
    new TiramisXmlBuilderService(),
    new TiramisXmlParserService(),
    signatureService as any,
    {} as any,
    {} as any,
  );

  return {
    service,
    tiramisConfigService,
    tiramisSubmissionService,
    signatureService,
    deadLetterRepository,
  };
}

describe('TiramisCallbackService', () => {
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

    expect(tiramisConfigService.getRuntimeConfigurationById).toHaveBeenCalledWith(
      'config-from-transaction',
    );
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
    expect(tiramisConfigService.getRuntimeConfigurationById).toHaveBeenCalledWith(
      'config-from-transaction',
    );
    expect(tiramisConfigService.getActiveConfiguration).not.toHaveBeenCalled();
    expect(signatureService.verifyXmlContent).toHaveBeenCalledWith({
      contentXml: '<CoverNoteRefRes></CoverNoteRefRes>',
      signature: 'RESPONSE_SIGNATURE',
      publicCertificatePfxPath: 'tira-public.pfx',
      publicCertificatePfxPassword: 'tira-secret',
    });
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
        payloadHash: createHash('sha256')
          .update(rawXml, 'utf8')
          .digest('hex'),
        reason: 'Invalid callback',
      }),
    );
  });
});
