import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';

import { TiramisConfigService } from '../../config/services/tiramis-config.service';
import { TiramisCoverNoteEntity } from '../../cover-notes/entities/tiramis-cover-note.entity';
import { TiramisSignatureService } from '../../messaging/services/tiramis-signature.service';
import { TiramisXmlBuilderService } from '../../messaging/services/tiramis-xml-builder.service';
import { TiramisXmlParserService } from '../../messaging/services/tiramis-xml-parser.service';
import { TiramisPortalNotificationService } from '../../portal-notifications/services/tiramis-portal-notification.service';
import { TiramisPolicyEntity } from '../../policies/entities/tiramis-policy.entity';
import { TiramisRequestIdService } from '../../submissions/services/tiramis-request-id.service';
import { TiramisSubmissionService } from '../../submissions/services/tiramis-submission.service';
import {
  TIRAMIS_CALLBACK_ACK_ROOTS,
  TIRAMIS_CALLBACK_ACK_STATUS,
  TIRAMIS_CALLBACK_ROOTS,
} from '../constants/tiramis-callback.constants';
import {
  ParsedTiramisCallbackDto,
  TiramisCallbackAckResultDto,
} from '../dto/tiramis-callback.dto';
import { TiramisCallbackDeadLetterEntity } from '../entities/tiramis-callback-dead-letter.entity';
import { TiramisCallbackReceiptEntity } from '../entities/tiramis-callback-receipt.entity';

@Injectable()
export class TiramisCallbackService {
  private readonly logger = new Logger(TiramisCallbackService.name);

  constructor(
    @InjectRepository(TiramisCoverNoteEntity)
    private readonly coverNoteRepository: Repository<TiramisCoverNoteEntity>,
    @InjectRepository(TiramisPolicyEntity)
    private readonly policyRepository: Repository<TiramisPolicyEntity>,
    @InjectRepository(TiramisCallbackDeadLetterEntity)
    private readonly deadLetterRepository: Repository<TiramisCallbackDeadLetterEntity>,
    @InjectRepository(TiramisCallbackReceiptEntity)
    private readonly callbackReceiptRepository: Repository<TiramisCallbackReceiptEntity>,
    private readonly tiramisConfigService: TiramisConfigService,
    private readonly tiramisSubmissionService: TiramisSubmissionService,
    private readonly tiramisRequestIdService: TiramisRequestIdService,
    private readonly xmlBuilder: TiramisXmlBuilderService,
    private readonly xmlParser: TiramisXmlParserService,
    private readonly signatureService: TiramisSignatureService,
    private readonly portalNotificationService: TiramisPortalNotificationService,
  ) {}

  async handleCallback(params: {
    environment: string;
    rawXml: string;
  }): Promise<TiramisCallbackAckResultDto> {
    let parsedCallback: ParsedTiramisCallbackDto;

    try {
      parsedCallback = this.parseCallback(params.rawXml);
    } catch (error: any) {
      await this.quarantineCallback({
        environment: params.environment,
        rawXml: params.rawXml,
        reason:
          error?.message ||
          'Unable to parse TIRAMIS callback XML before signature verification',
      });

      throw error;
    }

    const signatureVerification = await this.verifyCallbackSignature({
      environment: params.environment,
      parsedCallback,
    });

    if (!signatureVerification.isValid) {
      const reason =
        signatureVerification.reason || 'Invalid TIRAMIS callback signature';

      await this.quarantineCallback({
        environment: params.environment,
        parsedCallback,
        rawXml: params.rawXml,
        reason,
      });

      this.logger.warn(
        `Rejected TIRAMIS callback for requestId ${parsedCallback.requestId}: ${reason}`,
      );

      try {
        await this.tiramisSubmissionService.markFailed({
          requestId: parsedCallback.requestId,
          errorMessage: reason,
          rawPayload: params.rawXml,
        });
      } catch (error: any) {
        this.logger.warn(
          `Could not mark callback request as failed for requestId ${parsedCallback.requestId}: ${error?.message || 'Unknown error'}`,
        );
      }

      const acknowledgement = await this.buildAcknowledgement({
        environment: params.environment,
        parsedCallback: {
          ...parsedCallback,
          signatureVerified: false,
        },
        isSuccess: false,
      });

      await this.notifyPortalAfterCallback({
        eventType: 'TIRAMIS_CALLBACK_REJECTED',
        parsedCallback,
        transactionStatus: 'FAILED',
        attemptStatus: 'FAILED',
        errorMessage: reason,
      });

      try {
        await this.tiramisSubmissionService.markResponseAcknowledgementSent({
          requestId: parsedCallback.requestId,
          acknowledgementId: acknowledgement.acknowledgementId,
          statusCode: acknowledgement.acknowledgementStatusCode,
          statusDesc: acknowledgement.acknowledgementStatusDesc,
          rawXml: acknowledgement.acknowledgementXml,
        });
      } catch (error: any) {
        this.logger.warn(
          `Could not store failed callback acknowledgement for requestId ${parsedCallback.requestId}: ${error?.message || 'Unknown error'}`,
        );
      }

      return acknowledgement;
    }

    parsedCallback.signatureVerified = true;

    const replayResult = await this.handleCallbackReplayIfExists({
      environment: params.environment,
      parsedCallback,
    });

    if (replayResult.isReplay) {
      return replayResult.acknowledgement;
    }

    const receiptResult = await this.createCallbackReceipt({
      environment: params.environment,
      parsedCallback,
    });

    if (receiptResult.isReplay) {
      return receiptResult.acknowledgement;
    }

    const callbackReceipt = receiptResult.receipt;

    try {
      const isSuccess = await this.tiramisConfigService.isSuccessResponse(
        parsedCallback.responseStatusCode,
      );

      await this.tiramisSubmissionService.markFinalResponseReceived({
        requestId: parsedCallback.requestId,
        responseId: parsedCallback.responseId,
        statusCode: parsedCallback.responseStatusCode,
        statusDesc: parsedCallback.responseStatusDesc,
        rawXml: parsedCallback.rawXml,
        responseSignature: parsedCallback.signature || undefined,
        isSuccess,
      });

      await this.updateBusinessRecords(parsedCallback);

      const acknowledgement = await this.buildAcknowledgement({
        environment: params.environment,
        parsedCallback,
        isSuccess: true,
      });

      await this.tiramisSubmissionService.markResponseAcknowledgementSent({
        requestId: parsedCallback.requestId,
        acknowledgementId: acknowledgement.acknowledgementId,
        statusCode: acknowledgement.acknowledgementStatusCode,
        statusDesc: acknowledgement.acknowledgementStatusDesc,
        rawXml: acknowledgement.acknowledgementXml,
      });

      await this.markCallbackReceiptCompleted({
        receipt: callbackReceipt,
        acknowledgement,
      });

      await this.notifyPortalAfterCallback({
        eventType: isSuccess ? 'TIRAMIS_FINAL_SUCCESS' : 'TIRAMIS_FINAL_FAILED',
        parsedCallback,
        transactionStatus: isSuccess ? 'SUCCESS' : 'FAILED',
        attemptStatus: isSuccess ? 'FINAL_SUCCESS' : 'FINAL_FAILED',
      });

      return acknowledgement;
    } catch (error: any) {
      this.logger.error(
        `Failed to process TIRAMIS callback for requestId ${parsedCallback.requestId}: ${error?.message || 'Unknown error'}`,
        error?.stack,
      );

      await this.markCallbackReceiptFailed({
        receipt: callbackReceipt,
        errorMessage:
          error?.message ||
          'TIRAMIS callback signature was valid, but processing failed',
      });

      await this.quarantineCallback({
        environment: params.environment,
        parsedCallback,
        rawXml: params.rawXml,
        reason:
          error?.message ||
          'TIRAMIS callback signature was valid, but processing failed',
      });

      const acknowledgement = await this.buildAcknowledgement({
        environment: params.environment,
        parsedCallback,
        isSuccess: false,
      });

      await this.notifyPortalAfterCallback({
        eventType: 'TIRAMIS_FINAL_FAILED',
        parsedCallback,
        transactionStatus: 'FAILED',
        attemptStatus: 'FAILED',
        errorMessage:
          error?.message ||
          'TIRAMIS callback signature was valid, but processing failed',
      });

      try {
        await this.tiramisSubmissionService.markResponseAcknowledgementSent({
          requestId: parsedCallback.requestId,
          acknowledgementId: acknowledgement.acknowledgementId,
          statusCode: acknowledgement.acknowledgementStatusCode,
          statusDesc: acknowledgement.acknowledgementStatusDesc,
          rawXml: acknowledgement.acknowledgementXml,
        });
      } catch (ackError: any) {
        this.logger.warn(
          `Could not store failed processing acknowledgement for requestId ${parsedCallback.requestId}: ${ackError?.message || 'Unknown error'}`,
        );
      }

      return acknowledgement;
    }
  }

  private parseCallback(rawXml: string): ParsedTiramisCallbackDto {
    const parsedMessage = this.xmlParser.parseTiraMessage(rawXml);

    if (!parsedMessage.rootName || !parsedMessage.content) {
      throw new BadRequestException(
        'Invalid TIRAMIS callback message: root payload missing',
      );
    }

    if (!TIRAMIS_CALLBACK_ACK_ROOTS[parsedMessage.rootName]) {
      throw new BadRequestException(
        `Unsupported TIRAMIS callback root: ${parsedMessage.rootName}`,
      );
    }

    const content = parsedMessage.content;
    const requestId = this.getStringValue(content, 'RequestId');
    const responseId = this.getStringValue(content, 'ResponseId');
    const responseStatusCode = this.getStringValue(
      content,
      'ResponseStatusCode',
    );
    const responseStatusDesc = this.getStringValue(
      content,
      'ResponseStatusDesc',
    );

    if (
      !requestId ||
      !responseId ||
      !responseStatusCode ||
      !responseStatusDesc
    ) {
      throw new BadRequestException(
        'Invalid TIRAMIS callback payload: RequestId, ResponseId, ResponseStatusCode, and ResponseStatusDesc are required',
      );
    }

    return {
      rootName: parsedMessage.rootName,
      requestId,
      responseId,
      responseStatusCode,
      responseStatusDesc,
      coverNoteReferenceNumber: this.getOptionalStringValue(
        content,
        'CoverNoteReferenceNumber',
      ),
      policyReferenceNumber: this.getOptionalStringValue(
        content,
        'PolicyReferenceNumber',
      ),
      stickerNumber: this.getOptionalStringValue(content, 'StickerNumber'),
      rawXml,
      signature: parsedMessage.signature,
      content,
      contentXml: this.xmlBuilder.buildContentXml(parsedMessage.rootName, content),
      signatureVerified: false,
    };
  }

  private async verifyCallbackSignature(params: {
    environment: string;
    parsedCallback: ParsedTiramisCallbackDto;
  }): Promise<{ isValid: boolean; reason?: string }> {
    if (!params.parsedCallback.signature) {
      return {
        isValid: false,
        reason: 'TIRAMIS callback MsgSignature is missing',
      };
    }

    const pfxPaths = await this.tiramisConfigService.getPfxPaths(
      params.environment,
    );

    if (!pfxPaths.tiraPublicCertificatePath) {
      return {
        isValid: false,
        reason:
          'TIRA public certificate path is not configured for callback verification',
      };
    }

    const isValid = this.signatureService.verifyXmlContent({
      contentXml: params.parsedCallback.contentXml,
      signature: params.parsedCallback.signature,
      publicCertificatePfxPath: pfxPaths.tiraPublicCertificatePath,
      publicCertificatePfxPassword: pfxPaths.tiraPublicCertificatePassword,
    });

    if (!isValid) {
      return {
        isValid: false,
        reason: 'TIRAMIS callback signature verification failed',
      };
    }

    return {
      isValid: true,
    };
  }

  private async quarantineCallback(params: {
    environment: string;
    rawXml: string;
    reason: string;
    parsedCallback?: ParsedTiramisCallbackDto;
  }) {
    const deadLetter = this.deadLetterRepository.create({
      environment: params.environment,
      rootName: params.parsedCallback?.rootName || null,
      requestId: params.parsedCallback?.requestId || null,
      responseId: params.parsedCallback?.responseId || null,
      statusCode: params.parsedCallback?.responseStatusCode || null,
      statusDesc: params.parsedCallback?.responseStatusDesc || null,
      signature: params.parsedCallback?.signature || null,
      rawXml: params.rawXml || null,
      reason: params.reason,
      isProcessed: 0,
    });

    await this.deadLetterRepository.save(deadLetter);
  }

  private async updateBusinessRecords(
    parsedCallback: ParsedTiramisCallbackDto,
  ) {
    if (
      parsedCallback.rootName === TIRAMIS_CALLBACK_ROOTS.COVER_NOTE_RESPONSE ||
      parsedCallback.rootName ===
        TIRAMIS_CALLBACK_ROOTS.MOTOR_COVER_NOTE_RESPONSE
    ) {
      const coverNote = await this.coverNoteRepository.findOne({
        where: {
          requestId: parsedCallback.requestId,
        },
      });

      if (!coverNote) {
        return;
      }

      if (parsedCallback.coverNoteReferenceNumber) {
        coverNote.coverNoteReferenceNumber =
          parsedCallback.coverNoteReferenceNumber;
      }

      if (parsedCallback.stickerNumber) {
        coverNote.stickerNumber = parsedCallback.stickerNumber;
      }

      await this.coverNoteRepository.save(coverNote);
      return;
    }

    if (parsedCallback.rootName !== TIRAMIS_CALLBACK_ROOTS.POLICY_RESPONSE) {
      return;
    }

    const policy = await this.policyRepository.findOne({
      where: {
        requestId: parsedCallback.requestId,
      },
    });

    if (!policy) {
      return;
    }

    if (parsedCallback.policyReferenceNumber) {
      policy.policyReferenceNumber = parsedCallback.policyReferenceNumber;
    }

    await this.policyRepository.save(policy);
  }

  private async buildAcknowledgement(params: {
    environment: string;
    parsedCallback: ParsedTiramisCallbackDto;
    isSuccess: boolean;
  }): Promise<TiramisCallbackAckResultDto> {
    const acknowledgementId = this.tiramisRequestIdService.generate('ACK');
    const acknowledgementRoot =
      TIRAMIS_CALLBACK_ACK_ROOTS[params.parsedCallback.rootName];

    if (!acknowledgementRoot) {
      throw new BadRequestException(
        `TIRAMIS callback acknowledgement root not found for ${params.parsedCallback.rootName}`,
      );
    }

    const acknowledgementStatusCode = params.isSuccess
      ? TIRAMIS_CALLBACK_ACK_STATUS.SUCCESS_CODE
      : TIRAMIS_CALLBACK_ACK_STATUS.FAILED_CODE;

    const acknowledgementStatusDesc = params.isSuccess
      ? TIRAMIS_CALLBACK_ACK_STATUS.SUCCESS_DESC
      : TIRAMIS_CALLBACK_ACK_STATUS.FAILED_DESC;

    const acknowledgementPayload = {
      AcknowledgementId: acknowledgementId,
      ResponseId: params.parsedCallback.responseId,
      AcknowledgementStatusCode: acknowledgementStatusCode,
      AcknowledgementStatusDesc: acknowledgementStatusDesc,
    };

    const contentXml = this.xmlBuilder.buildContentXml(
      acknowledgementRoot,
      acknowledgementPayload,
    );

    const pfxPaths = await this.tiramisConfigService.getPfxPaths(
      params.environment,
    );

    const signature = pfxPaths.clientPrivateCertificatePath
      ? this.signatureService.signXmlContent({
          contentXml,
          privateKeyPfxPath: pfxPaths.clientPrivateCertificatePath,
          privateKeyPfxPassword: pfxPaths.clientPrivateCertificatePassword,
        })
      : '';

    const acknowledgementXml = this.xmlBuilder.buildAcknowledgementMessage({
      rootName: acknowledgementRoot,
      acknowledgementId,
      responseId: params.parsedCallback.responseId,
      acknowledgementStatusCode,
      acknowledgementStatusDesc,
      signature,
    });

    return {
      acknowledgementId,
      responseId: params.parsedCallback.responseId,
      acknowledgementStatusCode,
      acknowledgementStatusDesc,
      acknowledgementXml,
    };
  }

  private async handleCallbackReplayIfExists(params: {
    environment: string;
    parsedCallback: ParsedTiramisCallbackDto;
  }): Promise<{
    isReplay: boolean;
    acknowledgement: TiramisCallbackAckResultDto;
  }> {
    const existingReceipt = await this.callbackReceiptRepository.findOne({
      where: {
        environment: params.environment,
        requestId: params.parsedCallback.requestId,
        responseId: params.parsedCallback.responseId,
      },
    });

    if (!existingReceipt) {
      return {
        isReplay: false,
        acknowledgement: null as any,
      };
    }

    existingReceipt.receiveCount = Number(existingReceipt.receiveCount || 0) + 1;
    existingReceipt.lastReceivedAt = new Date();

    await this.callbackReceiptRepository.save(existingReceipt);

    const incomingPayloadHash = this.hashPayload(params.parsedCallback.rawXml);

    if (
      existingReceipt.payloadHash &&
      incomingPayloadHash &&
      existingReceipt.payloadHash !== incomingPayloadHash
    ) {
      await this.quarantineCallback({
        environment: params.environment,
        parsedCallback: params.parsedCallback,
        rawXml: params.parsedCallback.rawXml,
        reason:
          'Callback replay detected with same RequestId/ResponseId but different payload hash',
      });

      const failedAck = await this.buildAcknowledgement({
        environment: params.environment,
        parsedCallback: params.parsedCallback,
        isSuccess: false,
      });

      return {
        isReplay: true,
        acknowledgement: failedAck,
      };
    }

    if (
      existingReceipt.processingStatus === 'COMPLETED' &&
      existingReceipt.acknowledgementXml
    ) {
      this.logger.log(
        `Duplicate TIRAMIS callback ignored for requestId ${params.parsedCallback.requestId}, responseId ${params.parsedCallback.responseId}`,
      );

      return {
        isReplay: true,
        acknowledgement: {
          acknowledgementId: existingReceipt.acknowledgementId!,
          responseId: existingReceipt.responseId,
          acknowledgementStatusCode:
            existingReceipt.acknowledgementStatusCode || 'TIRA001',
          acknowledgementStatusDesc:
            existingReceipt.acknowledgementStatusDesc || 'Successful',
          acknowledgementXml: existingReceipt.acknowledgementXml,
        },
      };
    }

    const failedAck = await this.buildAcknowledgement({
      environment: params.environment,
      parsedCallback: params.parsedCallback,
      isSuccess: false,
    });

    return {
      isReplay: true,
      acknowledgement: failedAck,
    };
  }

  private async createCallbackReceipt(params: {
    environment: string;
    parsedCallback: ParsedTiramisCallbackDto;
  }): Promise<{
    receipt: TiramisCallbackReceiptEntity;
    isReplay: boolean;
    acknowledgement: TiramisCallbackAckResultDto;
  }> {
    const receipt = this.callbackReceiptRepository.create({
      environment: params.environment,
      requestId: params.parsedCallback.requestId,
      responseId: params.parsedCallback.responseId,
      rootName: params.parsedCallback.rootName,
      responseStatusCode: params.parsedCallback.responseStatusCode,
      responseStatusDesc: params.parsedCallback.responseStatusDesc,
      payloadHash: this.hashPayload(params.parsedCallback.rawXml),
      signatureVerified: params.parsedCallback.signatureVerified ? 1 : 0,
      processingStatus: 'PROCESSING',
      receiveCount: 1,
      lastReceivedAt: new Date(),
    });

    try {
      const savedReceipt = await this.callbackReceiptRepository.save(receipt);

      return {
        receipt: savedReceipt,
        isReplay: false,
        acknowledgement: null as any,
      };
    } catch (error: any) {
      const existingReceipt = await this.callbackReceiptRepository.findOne({
        where: {
          environment: params.environment,
          requestId: params.parsedCallback.requestId,
          responseId: params.parsedCallback.responseId,
        },
      });

      if (!existingReceipt) {
        throw error;
      }

      existingReceipt.receiveCount =
        Number(existingReceipt.receiveCount || 0) + 1;
      existingReceipt.lastReceivedAt = new Date();

      await this.callbackReceiptRepository.save(existingReceipt);

      const incomingPayloadHash = this.hashPayload(params.parsedCallback.rawXml);

      if (
        existingReceipt.payloadHash &&
        incomingPayloadHash &&
        existingReceipt.payloadHash !== incomingPayloadHash
      ) {
        const failedAck = await this.buildAcknowledgement({
          environment: params.environment,
          parsedCallback: params.parsedCallback,
          isSuccess: false,
        });

        return {
          receipt: existingReceipt,
          isReplay: true,
          acknowledgement: failedAck,
        };
      }

      if (
        existingReceipt.processingStatus === 'COMPLETED' &&
        existingReceipt.acknowledgementXml
      ) {
        return {
          receipt: existingReceipt,
          isReplay: true,
          acknowledgement: {
            acknowledgementId: existingReceipt.acknowledgementId!,
            responseId: existingReceipt.responseId,
            acknowledgementStatusCode:
              existingReceipt.acknowledgementStatusCode || 'TIRA001',
            acknowledgementStatusDesc:
              existingReceipt.acknowledgementStatusDesc || 'Successful',
            acknowledgementXml: existingReceipt.acknowledgementXml,
          },
        };
      }

      return {
        receipt: existingReceipt,
        isReplay: true,
        acknowledgement: await this.buildAcknowledgement({
          environment: params.environment,
          parsedCallback: params.parsedCallback,
          isSuccess: false,
        }),
      };
    }
  }

  private async markCallbackReceiptCompleted(params: {
    receipt: TiramisCallbackReceiptEntity;
    acknowledgement: TiramisCallbackAckResultDto;
  }) {
    params.receipt.processingStatus = 'COMPLETED';
    params.receipt.acknowledgementId = params.acknowledgement.acknowledgementId;
    params.receipt.acknowledgementStatusCode =
      params.acknowledgement.acknowledgementStatusCode;
    params.receipt.acknowledgementStatusDesc =
      params.acknowledgement.acknowledgementStatusDesc;
    params.receipt.acknowledgementXml = params.acknowledgement.acknowledgementXml;
    params.receipt.lastError = null;

    await this.callbackReceiptRepository.save(params.receipt);
  }

  private async markCallbackReceiptFailed(params: {
    receipt: TiramisCallbackReceiptEntity;
    errorMessage: string;
  }) {
    params.receipt.processingStatus = 'FAILED';
    params.receipt.lastError = params.errorMessage;

    await this.callbackReceiptRepository.save(params.receipt);
  }

  private async notifyPortalAfterCallback(params: {
    eventType:
      | 'TIRAMIS_FINAL_RESPONSE_RECEIVED'
      | 'TIRAMIS_FINAL_SUCCESS'
      | 'TIRAMIS_FINAL_FAILED'
      | 'TIRAMIS_RESPONSE_ACK_SENT'
      | 'TIRAMIS_CALLBACK_REJECTED';
    parsedCallback: ParsedTiramisCallbackDto;
    transactionStatus?: string | null;
    attemptStatus?: string | null;
    errorMessage?: string | null;
  }) {
    try {
      const transaction =
        await this.tiramisSubmissionService.getTransactionForNotification({
          requestId: params.parsedCallback.requestId,
        });

      await this.portalNotificationService.publish({
        eventType: params.eventType,
        sourceService: 'tiramis-service',
        sourceCompanyId: transaction?.sourceCompanyId || null,
        sourceModule: transaction?.sourceModule || null,
        sourceRecordId: transaction?.sourceRecordId || null,
        businessReference: transaction?.businessReference || null,
        tiramisTransactionId: transaction?.id || null,
        requestId: params.parsedCallback.requestId,
        responseId: params.parsedCallback.responseId,
        serviceType: transaction?.serviceType || null,
        rootElement: params.parsedCallback.rootName,
        statusCode: params.parsedCallback.responseStatusCode,
        statusDescription: params.parsedCallback.responseStatusDesc,
        transactionStatus: params.transactionStatus || transaction?.status || null,
        attemptStatus: params.attemptStatus || null,
        coverNoteReferenceNumber:
          params.parsedCallback.coverNoteReferenceNumber || null,
        policyReferenceNumber: params.parsedCallback.policyReferenceNumber || null,
        stickerNumber: params.parsedCallback.stickerNumber || null,
        errorMessage: params.errorMessage || null,
        occurredAt: new Date().toISOString(),
      });
    } catch (error: any) {
      this.logger.warn(
        `Portal notification skipped for requestId ${params.parsedCallback.requestId}: ${
          error?.message || 'Unknown error'
        }`,
      );
    }
  }

  private hashPayload(rawXml: string): string {
    return createHash('sha256').update(rawXml || '', 'utf8').digest('hex');
  }

  private getStringValue(
    content: Record<string, unknown>,
    key: string,
  ): string | null {
    const value = content[key];
    return typeof value === 'string' && value.trim() ? value : null;
  }

  private getOptionalStringValue(
    content: Record<string, unknown>,
    key: string,
  ): string | null {
    const value = content[key];
    return typeof value === 'string' && value.trim() ? value : null;
  }
}
