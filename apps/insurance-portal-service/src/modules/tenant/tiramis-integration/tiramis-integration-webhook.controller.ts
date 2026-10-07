import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';

import { ServiceEndpoint } from '@insurance-max/portal-shared';
import { RequireApiClientScopes } from '../../platform/api-clients/decorators/require-api-client-scopes.decorator';
import { ApiKeyGuard } from '../../platform/api-clients/guards/api-key.guard';

import type { TiramisNotificationEventDto } from './dto/tiramis-notification-event.dto';
import { TiramisNotificationReceipt } from './entities/tiramis-notification-receipt.entity';
import { TiramisIntegrationService } from './tiramis-integration.service';

@ApiExcludeController()
@ServiceEndpoint()
@UseGuards(ApiKeyGuard)
@RequireApiClientScopes('tiramis:notify')
@Controller('webhooks/tiramis')
export class TiramisIntegrationWebhookController {
  constructor(
    private readonly tiramisIntegrationService: TiramisIntegrationService,
    @InjectRepository(TiramisNotificationReceipt)
    private readonly receiptRepository: Repository<TiramisNotificationReceipt>,
  ) {}

  @Post('notifications')
  async receiveNotification(@Body() payload: TiramisNotificationEventDto) {
    if (!payload?.eventType || !payload?.requestId) {
      throw new BadRequestException(
        'eventType and requestId are required in the TIRAMIS webhook payload',
      );
    }

    if (payload.eventType === 'TIRAMIS_CONNECTION_TEST') {
      return {
        success: true,
        test: true,
        requestId: payload.requestId,
      };
    }

    const eventKey = this.buildEventKey(payload);
    const payloadHash = this.hashPayload(payload);
    const receipt = await this.claimReceipt(eventKey, payload, payloadHash);

    if (receipt.processingStatus === 'COMPLETED') {
      return {
        success: true,
        duplicate: true,
        requestId: payload.requestId,
        eventType: payload.eventType,
      };
    }

    if (
      receipt.processingStatus === 'PROCESSING' &&
      receipt.receiveCount > 1 &&
      !(receipt as any).retryingFailedReceipt
    ) {
      throw new ConflictException({
        code: 'TIRAMIS_NOTIFICATION_PROCESSING',
        message:
          'This TIRAMIS notification is already being processed; retry later.',
        requestId: payload.requestId,
        eventType: payload.eventType,
      });
    }

    try {
      await this.tiramisIntegrationService.handleTiramisNotification(payload);

      receipt.processingStatus = 'COMPLETED';
      receipt.lastError = null;
      await this.receiptRepository.save(receipt);
    } catch (error: any) {
      receipt.processingStatus = 'FAILED';
      receipt.lastError = error?.message || 'Unknown notification error';
      await this.receiptRepository.save(receipt);
      throw error;
    }

    return {
      success: true,
      requestId: payload.requestId,
      eventType: payload.eventType,
    };
  }

  private async claimReceipt(
    eventKey: string,
    payload: TiramisNotificationEventDto,
    payloadHash: string,
  ): Promise<TiramisNotificationReceipt> {
    const now = new Date();
    const receipt = this.receiptRepository.create({
      eventKey,
      requestId: payload.requestId,
      responseId: payload.responseId || null,
      eventType: payload.eventType,
      payloadHash,
      processingStatus: 'PROCESSING',
      receiveCount: 1,
      lastReceivedAt: now,
    });

    try {
      return await this.receiptRepository.save(receipt);
    } catch (error: any) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }

      const existing = await this.receiptRepository.findOne({
        where: { eventKey },
      });

      if (!existing) {
        throw error;
      }

      if (existing.payloadHash && existing.payloadHash !== payloadHash) {
        throw new BadRequestException(
          'Duplicate TIRAMIS notification key has a different payload hash',
        );
      }

      existing.receiveCount = Number(existing.receiveCount || 0) + 1;
      existing.lastReceivedAt = now;

      if (existing.processingStatus === 'FAILED') {
        (existing as any).retryingFailedReceipt = true;
        existing.processingStatus = 'PROCESSING';
        existing.lastError = null;
      }

      return this.receiptRepository.save(existing);
    }
  }

  private buildEventKey(payload: TiramisNotificationEventDto): string {
    return [
      payload.requestId,
      payload.responseId || 'none',
      payload.eventType,
    ].join(':');
  }

  private hashPayload(payload: TiramisNotificationEventDto): string {
    return createHash('sha256')
      .update(this.stableStringify(payload || {}), 'utf8')
      .digest('hex');
  }

  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${this.stableStringify(record[key])}`,
      )
      .join(',')}}`;
  }

  private isUniqueViolation(error: any): boolean {
    return (
      error?.code === '23505' ||
      String(error?.message || '')
        .toLowerCase()
        .includes('unique')
    );
  }
}
