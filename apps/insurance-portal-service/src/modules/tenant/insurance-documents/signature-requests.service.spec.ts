import { createHash } from 'node:crypto';

import { SignatureRequestsService } from './signature-requests.service';

function makeRepository() {
  return {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    find: jest.fn(),
    findOne: jest.fn(),
  };
}

describe('SignatureRequestsService evidence crypto', () => {
  it('seals public signature evidence with an HMAC that can be verified later', async () => {
    const requestRepository = makeRepository();
    const participantRepository = makeRepository();
    const eventRepository = makeRepository();
    const evidenceRepository = makeRepository();
    const documentRepository = makeRepository();
    const versionRepository = makeRepository();
    const storageService = {};
    const configService = {
      get: jest.fn((key: string) =>
        key === 'SIGNATURE_EVIDENCE_SECRET'
          ? 'unit-test-signature-secret'
          : undefined,
      ),
    };
    const token = 'public-token';
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const participant = {
      id: 'participant-1',
      signature_request_id: 'request-1',
      participant_type: 'CUSTOMER',
      name: 'Ada Signer',
      email: 'ada@example.test',
      signing_order: 1,
      status: 'SENT',
      access_token_hash: tokenHash,
    };
    const request = {
      id: 'request-1',
      company_id: 'company-1',
      request_no: 'SIG-1',
      document_id: 'document-1',
      document_version_id: 'version-1',
      status: 'SENT',
      expires_at: null,
      signing_order_required: false,
      completion_document_version_id: null,
    };
    let savedEvidence: any;

    participantRepository.findOne.mockResolvedValue(participant);
    participantRepository.find.mockResolvedValue([
      participant,
      {
        id: 'participant-2',
        signing_order: 2,
        status: 'SENT',
      },
    ]);
    requestRepository.findOne.mockResolvedValue(request);
    documentRepository.findOne.mockResolvedValue({ id: 'document-1' });
    versionRepository.findOne.mockResolvedValue({
      id: 'version-1',
      sha256_hash: 'document-sha',
    });
    evidenceRepository.save.mockImplementation(async (value) => {
      savedEvidence = { id: 'evidence-1', ...value };
      return savedEvidence;
    });

    const service = new SignatureRequestsService(
      requestRepository as any,
      participantRepository as any,
      eventRepository as any,
      evidenceRepository as any,
      documentRepository as any,
      versionRepository as any,
      storageService as any,
      configService as any,
    );

    await service.respondPublic(token, {
      decision: 'SIGN',
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    });

    expect(savedEvidence.payload).toEqual(
      expect.objectContaining({
        algorithm: 'HMAC-SHA256',
        payloadHash: expect.any(String),
        signature: expect.any(String),
      }),
    );
    expect(savedEvidence.payload.canonicalPayload).toEqual(
      expect.objectContaining({
        documentSha256Hash: 'document-sha',
        decision: 'SIGN',
        participantId: 'participant-1',
      }),
    );

    evidenceRepository.findOne.mockResolvedValue(savedEvidence);
    const verification = await service.verifyEvidence(
      'company-1',
      'evidence-1',
    );

    expect(verification).toEqual(
      expect.objectContaining({
        evidence_id: 'evidence-1',
        verified: true,
        algorithm: 'HMAC-SHA256',
      }),
    );
  });
});
