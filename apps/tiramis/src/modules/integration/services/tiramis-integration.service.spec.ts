import { ConflictException, UnauthorizedException } from '@nestjs/common';
import {
  TiramisIntegrationCommand,
  TiramisIntegrationSchemaVersion,
  TiramisIntegrationStatus,
  type TiramisSubmissionEnvelope,
} from '@insurance-max/contracts';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { TiramisIntegrationService } from './tiramis-integration.service';

describe('TiramisIntegrationService', () => {
  const hashService = new ProductDefinitionHashService();

  function buildEnvelope(
    overrides: Partial<TiramisSubmissionEnvelope> = {},
  ): TiramisSubmissionEnvelope {
    const base = {
      schemaVersion: TiramisIntegrationSchemaVersion.V1,
      contractVersion: '1.0',
      command: TiramisIntegrationCommand.SUBMIT,
      requestType: 'MOTOR_COVER_NOTE',
      idempotencyKey: 'idem-1',
      correlationId: 'corr-1',
      causationId: 'cause-1',
      source: {
        service: 'insurance-portal-service',
        companyId: 'company-1',
        userId: 'user-1',
        module: 'quotations',
        recordId: 'quotation-1',
        businessReference: 'Q-1',
        policyId: null,
        quotationId: 'quotation-1',
        workflowRevision: 1,
      },
      context: { tenant: 'company-1' },
      payload: { CoverNote: { CoverNoteNo: 'CN-1' } },
    } as Omit<TiramisSubmissionEnvelope, 'hashes'>;

    const withOverrides = { ...base, ...overrides };
    const payloadHash = hashService.hashDefinition(withOverrides.payload);
    const contextHash = hashService.hashDefinition(
      withOverrides.context as unknown as Record<string, unknown>,
    );
    const envelopeHash = hashService.hashDefinition({
      ...withOverrides,
      hashes: { payloadHash, contextHash },
    });

    return {
      ...withOverrides,
      hashes: { payloadHash, contextHash, envelopeHash },
    } as TiramisSubmissionEnvelope;
  }

  function makeService(overrides: Record<string, unknown> = {}) {
    const transaction = {
      id: 'transaction-1',
      resourceVersion: 0,
      canonicalStatus: null,
      currentRequestId: null,
    };
    const deps = {
      requestContextService: {
        getServicePrincipal: jest.fn(() => ({
          tenant: { companyId: 'company-1' },
        })),
      },
      requestIdService: { generate: jest.fn(() => 'REQ-1') },
      submissionService: {
        createTransaction: jest.fn(async () => transaction),
        createAttempt: jest.fn(async () => ({ id: 'attempt-1' })),
      },
      transactionRepository: { save: jest.fn(async (entity) => entity) },
      ingressRequestRepository: {
        findByIdempotency: jest.fn(async () => null),
        create: jest.fn((entity) => entity),
        save: jest.fn(async (entity) => entity),
      },
      tiramisConfigService: {
        getActiveRuntimeConfiguration: jest.fn(async () => ({ id: 'cfg-1' })),
      },
      ...overrides,
    };

    return {
      deps,
      service: new TiramisIntegrationService(
        hashService,
        deps.requestContextService as never,
        deps.requestIdService as never,
        deps.submissionService as never,
        deps.transactionRepository as never,
        deps.ingressRequestRepository as never,
        deps.tiramisConfigService as never,
      ),
    };
  }

  it('creates a transaction, attempt, and ingress record for a valid envelope', async () => {
    const envelope = buildEnvelope();
    const { deps, service } = makeService();

    const result = await service.acceptSubmission(envelope);

    expect(result).toMatchObject({
      transactionId: 'transaction-1',
      requestId: 'REQ-1',
      status: TiramisIntegrationStatus.ACCEPTED_BY_TIRAMIS_SERVICE,
      rootElement: 'CoverNote',
      duplicate: false,
      resourceVersion: 1,
    });
    expect(deps.submissionService.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        clientConfigurationId: 'cfg-1',
        payloadHash: envelope.hashes.payloadHash,
        envelopeHash: envelope.hashes.envelopeHash,
      }),
    );
    expect(deps.submissionService.createAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: 'transaction-1',
        requestId: 'REQ-1',
        rootElement: 'CoverNote',
      }),
    );
    expect(deps.ingressRequestRepository.save).toHaveBeenCalled();
  });

  it('rejects a signed tenant context that does not match the envelope source', async () => {
    const envelope = buildEnvelope();
    const { service } = makeService({
      requestContextService: {
        getServicePrincipal: jest.fn(() => ({
          tenant: { companyId: 'other-company' },
        })),
      },
    });

    await expect(service.acceptSubmission(envelope)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects idempotency reuse with a different envelope hash', async () => {
    const envelope = buildEnvelope();
    const { service } = makeService({
      ingressRequestRepository: {
        findByIdempotency: jest.fn(async () => ({
          envelopeHash: 'different-hash',
        })),
        create: jest.fn((entity) => entity),
        save: jest.fn(async (entity) => entity),
      },
    });

    await expect(service.acceptSubmission(envelope)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('returns duplicate acceptance when the same envelope is replayed', async () => {
    const envelope = buildEnvelope();
    const acceptancePayload = {
      transactionId: 'transaction-1',
      requestId: 'REQ-1',
      status: TiramisIntegrationStatus.ACCEPTED_BY_TIRAMIS_SERVICE,
      duplicate: false,
    };
    const { service } = makeService({
      ingressRequestRepository: {
        findByIdempotency: jest.fn(async () => ({
          envelopeHash: envelope.hashes.envelopeHash,
          acceptancePayload,
        })),
        create: jest.fn((entity) => entity),
        save: jest.fn(async (entity) => entity),
      },
    });

    await expect(service.acceptSubmission(envelope)).resolves.toEqual({
      ...acceptancePayload,
      duplicate: true,
    });
  });
});
