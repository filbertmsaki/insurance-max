import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';

import {
  TiramisIntegrationCommand,
  TiramisIntegrationSchemaVersion,
  TiramisIntegrationStatus,
  type TiramisSubmissionAcceptance,
  type TiramisSubmissionEnvelope,
} from '@insurance-max/contracts';
import { ProductDefinitionHashService, RequestContextService } from '@insurance-max/shared-kernel';

import { TiramisRequestIdService } from '../../submissions/services/tiramis-request-id.service';
import { TiramisSubmissionService } from '../../submissions/services/tiramis-submission.service';
import { TiramisTransactionRepository } from '../../submissions/repositories/tiramis-transaction.repository';
import { TiramisIngressRequestRepository } from '../repositories/tiramis-ingress-request.repository';
import { TiramisConfigService } from '../../config/services/tiramis-config.service';

@Injectable()
export class TiramisIntegrationService {
  constructor(
    private readonly hashService: ProductDefinitionHashService,
    private readonly requestContextService: RequestContextService,
    private readonly requestIdService: TiramisRequestIdService,
    private readonly submissionService: TiramisSubmissionService,
    private readonly transactionRepository: TiramisTransactionRepository,
    private readonly ingressRequestRepository: TiramisIngressRequestRepository,
    private readonly tiramisConfigService: TiramisConfigService,
  ) {}

  async acceptSubmission(
    envelope: TiramisSubmissionEnvelope,
  ): Promise<TiramisSubmissionAcceptance> {
    this.assertEnvelope(envelope);

    const principal = this.requestContextService.getServicePrincipal();

    if (!principal?.tenant?.companyId) {
      throw new UnauthorizedException('Signed tenant context is required.');
    }

    if (principal.tenant.companyId !== envelope.source.companyId) {
      throw new UnauthorizedException(
        'The signed company context does not match the submission source company.',
      );
    }

    const runtimeConfiguration =
      await this.tiramisConfigService.getActiveRuntimeConfiguration();

    const existing = await this.ingressRequestRepository.findByIdempotency({
      sourceCompanyId: envelope.source.companyId,
      requestType: envelope.requestType,
      idempotencyKey: envelope.idempotencyKey,
    });

    if (existing) {
      if (existing.envelopeHash !== envelope.hashes.envelopeHash) {
        throw new ConflictException({
          code: 'TIRAMIS_ENVELOPE_IDEMPOTENCY_CONFLICT',
          message:
            'The idempotency key is already in use for a different canonical envelope.',
        });
      }

      return {
        ...((existing.acceptancePayload as unknown) as TiramisSubmissionAcceptance),
        duplicate: true,
      };
    }

    const serviceType = envelope.requestType;
    const rootElement = this.resolveRootElement(envelope.requestType);
    const requestId = this.requestIdService.generate('IMX');

    const transaction = await this.submissionService.createTransaction({
      clientConfigurationId: runtimeConfiguration.id,
      serviceType,
      sourceService: envelope.source.service,
      sourceCompanyId: envelope.source.companyId,
      sourceUserId: envelope.source.userId,
      sourceModule: envelope.source.module,
      sourceRecordId: envelope.source.recordId,
      businessReference: envelope.source.businessReference,
      originalRequestId: requestId,
      policyId: envelope.source.policyId,
      quotationId: envelope.source.quotationId,
      workflowRevision: envelope.source.workflowRevision,
      schemaVersion: envelope.schemaVersion,
      contractVersion: envelope.contractVersion,
      command: envelope.command,
      requestType: envelope.requestType,
      canonicalStatus: TiramisIntegrationStatus.ACCEPTED_BY_TIRAMIS_SERVICE,
      idempotencyKey: envelope.idempotencyKey,
      correlationId: envelope.correlationId,
      causationId: envelope.causationId,
      envelope: envelope as unknown as Record<string, unknown>,
      payloadHash: envelope.hashes.payloadHash,
      contextHash: envelope.hashes.contextHash,
      envelopeHash: envelope.hashes.envelopeHash,
    });

    await this.submissionService.createAttempt({
      transactionId: transaction.id,
      requestId,
      rootElement,
      previousRequestId: null,
      resubmissionReason: null,
    });

    transaction.canonicalStatus =
      TiramisIntegrationStatus.ACCEPTED_BY_TIRAMIS_SERVICE;
    transaction.currentRequestId = requestId;
    transaction.resourceVersion = (transaction.resourceVersion || 0) + 1;
    await this.transactionRepository.save(transaction);

    const acceptance: TiramisSubmissionAcceptance = {
      schemaVersion: TiramisIntegrationSchemaVersion.V1,
      transactionId: transaction.id,
      requestId,
      status: TiramisIntegrationStatus.ACCEPTED_BY_TIRAMIS_SERVICE,
      serviceType,
      rootElement,
      idempotencyKey: envelope.idempotencyKey,
      correlationId: envelope.correlationId,
      duplicate: false,
      acceptedAt: new Date().toISOString(),
      resourceVersion: transaction.resourceVersion,
    };

    await this.ingressRequestRepository.save(
      this.ingressRequestRepository.create({
        sourceCompanyId: envelope.source.companyId,
        sourceModule: envelope.source.module,
        sourceRecordId: envelope.source.recordId,
        workflowRevision: envelope.source.workflowRevision,
        command: envelope.command,
        requestType: envelope.requestType,
        schemaVersion: envelope.schemaVersion,
        contractVersion: envelope.contractVersion,
        idempotencyKey: envelope.idempotencyKey,
        correlationId: envelope.correlationId,
        causationId: envelope.causationId,
        transactionId: transaction.id,
        requestId,
        resourceVersion: acceptance.resourceVersion,
        payloadHash: envelope.hashes.payloadHash,
        contextHash: envelope.hashes.contextHash,
        envelopeHash: envelope.hashes.envelopeHash,
        envelope: envelope as unknown as Record<string, unknown>,
        acceptancePayload: acceptance as unknown as Record<string, unknown>,
      }),
    );

    return acceptance;
  }

  private assertEnvelope(envelope: TiramisSubmissionEnvelope) {
    if (envelope.schemaVersion !== TiramisIntegrationSchemaVersion.V1) {
      throw new ConflictException({
        code: 'TIRAMIS_SCHEMA_VERSION_UNSUPPORTED',
        message: 'Unsupported TIRAMIS canonical submission schema version.',
      });
    }

    if (envelope.contractVersion !== '1.0') {
      throw new ConflictException({
        code: 'TIRAMIS_CONTRACT_VERSION_UNSUPPORTED',
        message: 'Unsupported TIRAMIS canonical submission contract version.',
      });
    }

    if (envelope.command !== TiramisIntegrationCommand.SUBMIT) {
      throw new ConflictException({
        code: 'TIRAMIS_COMMAND_UNSUPPORTED',
        message: 'Only canonical SUBMIT commands are currently accepted.',
      });
    }

    const payloadHash = this.hashService.hashDefinition(envelope.payload);
    const contextHash = this.hashService.hashDefinition(
      envelope.context as unknown as Record<string, unknown>,
    );
    const envelopeHash = this.hashService.hashDefinition({
      ...envelope,
      hashes: {
        payloadHash,
        contextHash,
      },
    });

    if (payloadHash !== envelope.hashes.payloadHash) {
      throw new ConflictException({
        code: 'TIRAMIS_PAYLOAD_HASH_MISMATCH',
        message: 'The canonical submission payload hash is invalid.',
      });
    }

    if (contextHash !== envelope.hashes.contextHash) {
      throw new ConflictException({
        code: 'TIRAMIS_CONTEXT_HASH_MISMATCH',
        message: 'The canonical submission context hash is invalid.',
      });
    }

    if (envelopeHash !== envelope.hashes.envelopeHash) {
      throw new ConflictException({
        code: 'TIRAMIS_ENVELOPE_HASH_MISMATCH',
        message: 'The canonical submission envelope hash is invalid.',
      });
    }
  }

  private resolveRootElement(requestType: string): string {
    switch (requestType) {
      case 'NON_MOTOR_COVER_NOTE':
      case 'MOTOR_COVER_NOTE':
      case 'MOTOR_FLEET_COVER_NOTE':
        return 'CoverNote';
      case 'POLICY':
        return 'Policy';
      case 'CLAIM_NOTIFICATION':
        return 'ClaimNotification';
      case 'CLAIM_INTIMATION':
        return 'ClaimIntimation';
      case 'CLAIM_ASSESSMENT':
        return 'ClaimAssessment';
      case 'CLAIM_PAYMENT':
        return 'ClaimPayment';
      case 'CLAIM_REJECTION':
        return 'ClaimRejection';
      case 'DISCHARGE_VOUCHER':
        return 'DischargeVoucher';
      case 'REINSURANCE':
        return 'Reinsurance';
      default:
        return requestType;
    }
  }
}
