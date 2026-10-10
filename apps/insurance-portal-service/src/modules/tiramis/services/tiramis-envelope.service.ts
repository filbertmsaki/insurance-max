import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  TiramisIntegrationSchemaVersion,
  type TiramisIntegrationCommand,
  type TiramisIntegrationRequestType,
  type TiramisSubmissionContext,
  type TiramisSubmissionEnvelope,
  type TiramisSubmissionSource,
} from '@insurance-max/contracts';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';

@Injectable()
export class TiramisEnvelopeService {
  constructor(
    private readonly hashService: ProductDefinitionHashService,
    private readonly configService: ConfigService,
  ) {}

  build(params: {
    command: TiramisIntegrationCommand;
    requestType: TiramisIntegrationRequestType;
    idempotencyKey: string;
    correlationId?: string;
    causationId?: string | null;
    source: TiramisSubmissionSource;
    context: TiramisSubmissionContext;
    payload: Record<string, unknown>;
    /** The environment the submission is sent to (company/platform active). */
    environment?: 'uat' | 'production';
  }): TiramisSubmissionEnvelope {
    const payloadHash = this.hashService.hashDefinition(params.payload);
    const contextHash = this.hashService.hashDefinition(
      params.context as unknown as Record<string, unknown>,
    );
    const environment: 'uat' | 'production' =
      params.environment ??
      this.configService.get<'uat' | 'production'>('tiramisClient.tiraEnv') ??
      'uat';

    const unsigned = {
      schemaVersion: TiramisIntegrationSchemaVersion.V1,
      contractVersion: '1.0' as const,
      command: params.command,
      requestType: params.requestType,
      environment,
      idempotencyKey: params.idempotencyKey,
      correlationId: params.correlationId ?? randomUUID(),
      causationId: params.causationId ?? null,
      source: params.source,
      context: params.context,
      payload: params.payload,
      hashes: {
        payloadHash,
        contextHash,
        envelopeHash: '',
      },
      createdAt: new Date().toISOString(),
    };

    const envelopeHash = this.hashService.hashDefinition({
      ...unsigned,
      hashes: {
        payloadHash,
        contextHash,
      },
    });

    return {
      ...unsigned,
      hashes: {
        payloadHash,
        contextHash,
        envelopeHash,
      },
    };
  }
}
