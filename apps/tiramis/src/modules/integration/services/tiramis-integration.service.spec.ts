import { BadRequestException, ConflictException } from '@nestjs/common';
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
      environment: 'test',
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
        portalWebhookUrl:
          'http://localhost:9090/api/v1/webhooks/tiramis/notifications',
      },
      context: {
        organization: {
          insurerCompanyId: 'company-1',
          operatingCompanyId: 'company-1',
          branchId: 'branch-1',
          branchCode: 'BR-1',
          departmentId: null,
          salePointId: 'sale-point-1',
          salePointCode: 'SP-1',
          companyMembershipId: 'membership-1',
        },
        distribution: {
          relationshipId: null,
          distributionChannelId: 'DIRECT',
          channelType: 'DIRECT',
          intermediaryCompanyId: null,
          intermediaryAgentId: null,
          transactionCompanyCode: 'COMP-A',
          commissionRate: null,
          commissionAmount: null,
        },
        product: {
          productId: 'product-1',
          productVersionId: 'product-version-1',
          productCode: 'MOTOR',
          productDefinitionHash: 'hash-1',
          insuranceCategoryCode: 'MOTOR',
          insuranceSubClassCode: null,
          riskCodes: [],
        },
        pricing: null,
        insuredData: null,
        quotationGate: null,
        finance: null,
        policyTransaction: null,
        claim: null,
        reinsurance: null,
      },
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
    };
  }

  function makeService(overrides: Record<string, unknown> = {}) {
    const transaction = {
      id: 'transaction-1',
      resourceVersion: 0,
      canonicalStatus: null,
      currentRequestId: null,
    };
    const deps = {
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
        deps.requestIdService,
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
        portalWebhookUrl:
          'http://localhost:9090/api/v1/webhooks/tiramis/notifications',
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

  it('rejects an envelope without a portal webhook URL', async () => {
    const base = buildEnvelope();
    const envelope = buildEnvelope({
      source: { ...base.source, portalWebhookUrl: '' },
    });
    const { deps, service } = makeService();

    await expect(service.acceptSubmission(envelope)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(deps.submissionService.createTransaction).not.toHaveBeenCalled();
  });

  it('accepts an envelope regardless of tenant context because API key is the only TIRAMIS auth gate', async () => {
    const envelope = buildEnvelope();
    const { service } = makeService();

    await expect(service.acceptSubmission(envelope)).resolves.toMatchObject({
      transactionId: 'transaction-1',
      status: TiramisIntegrationStatus.ACCEPTED_BY_TIRAMIS_SERVICE,
    });
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
