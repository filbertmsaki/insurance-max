import { Injectable } from '@nestjs/common';

import { NotificationBusService } from './notification-bus.service';

@Injectable()
export class NotificationPublisherService {
  constructor(private readonly notificationBus: NotificationBusService) {}

  publishQuotationTiramisUpdated(params: {
    companyId: string;
    quotationId: string;
    requestId: string;
    eventType: string;
    statusCode?: string | null;
    statusDescription?: string | null;
    coverNoteReferenceNumber?: string | null;
    policyReferenceNumber?: string | null;
    stickerNumber?: string | null;
    occurredAt?: string | null;
  }) {
    return this.notificationBus.publish({
      type: 'quotation.tiramis.updated',
      companyId: params.companyId,
      targetRecordType: 'quotation',
      targetRecordId: params.quotationId,
      occurredAt: params.occurredAt ?? undefined,
      payload: {
        quotationId: params.quotationId,
        requestId: params.requestId,
        eventType: params.eventType,
        statusCode: params.statusCode ?? null,
        statusDescription: params.statusDescription ?? null,
        coverNoteReferenceNumber: params.coverNoteReferenceNumber ?? null,
        policyReferenceNumber: params.policyReferenceNumber ?? null,
        stickerNumber: params.stickerNumber ?? null,
      },
    });
  }

  publishPolicyTransactionTiramisUpdated(params: {
    companyId: string;
    transactionId: string;
    transactionType: string;
    policyId: string;
    requestId: string;
    eventType: string;
    statusCode?: string | null;
    statusDescription?: string | null;
  }) {
    return this.notificationBus.publish({
      type: 'policy-transaction.tiramis.updated',
      companyId: params.companyId,
      targetRecordType: 'policy-transaction',
      targetRecordId: params.transactionId,
      payload: {
        transactionId: params.transactionId,
        transactionType: params.transactionType,
        policyId: params.policyId,
        requestId: params.requestId,
        eventType: params.eventType,
        statusCode: params.statusCode ?? null,
        statusDescription: params.statusDescription ?? null,
      },
    });
  }
}
