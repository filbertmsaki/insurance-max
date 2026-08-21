import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { appendFile } from 'fs/promises';
import { join } from 'path';
import { Repository } from 'typeorm';
import type { RegulatoryFinalResponse } from '@insurance-max/contracts';
import { environment } from '@insurance-max/shared-config';

import { TiramisConfigService } from '../../config/services/tiramis-config.service';
import { TiramisCoverNoteEntity } from '../../cover-notes/entities/tiramis-cover-note.entity';
import { TiramisSignatureService } from '../../messaging/services/tiramis-signature.service';
import { TiramisXmlBuilderService } from '../../messaging/services/tiramis-xml-builder.service';
import { TiramisXmlParserService } from '../../messaging/services/tiramis-xml-parser.service';
import { TiramisPortalNotificationService } from '../../portal-notifications/services/tiramis-portal-notification.service';
import { TiramisPolicyEntity } from '../../policies/entities/tiramis-policy.entity';
import { TiramisRequestIdService } from '../../submissions/services/tiramis-request-id.service';
import { TiramisSubmissionService } from '../../submissions/services/tiramis-submission.service';
import { TiramisCallbackBusinessUpdaterService } from './tiramis-callback-business-updater.service';
import {
  TIRAMIS_CALLBACK_ACK_STATUS,
  TIRAMIS_CALLBACK_ROOTS,
} from '../constants/tiramis-callback.constants';
import { getTiramisCallbackRootDefinition } from '../constants/tiramis-callback-root-map.constant';
import {
  ParsedTiramisCallbackDto,
  TiramisCallbackAckResultDto,
} from '../dto/tiramis-callback.dto';
import { TiramisFinalResponseDto } from '../dto/tiramis-final-response.dto';
import { TiramisCallbackDeadLetterEntity } from '../entities/tiramis-callback-dead-letter.entity';
import { TiramisCallbackReceiptEntity } from '../entities/tiramis-callback-receipt.entity';

@Injectable()
export class TiramisCallbackService {
  private readonly logger = new Logger(TiramisCallbackService.name);
  // Defaults to cwd for local dev; PM2 runs the app from a per-release
  // directory that gets replaced on every deploy, so production must set
  // TIRAMIS_CALLBACK_ERROR_LOG_DIR to a persistent path (e.g. the shared dir)
  // or this file resets on every release.
  private readonly callbackErrorLogPath = join(
    environment.TIRAMIS_CALLBACK_ERROR_LOG_DIR || process.cwd(),
    'tiramis_callback_error.log',
  );
  private readonly responseHeaderKeys = [
    'CoverNoteHdr',
    'MotorCoverNoteHdr',
    'ReinsuranceHdr',
    'PolicyHdr',
    'ClaimNotificationHdr',
    'ClaimIntimationHdr',
    'ClaimAssessmentHdr',
    'DischargeVoucherHdr',
    'ClaimPaymentHdr',
    'ClaimRejectionHdr',
    'VerificationHdr',
  ];

  private readonly responseDetailKeys = [
    'CoverNoteDtl',
    'MotorCoverNoteDtl',
    'ReinsuranceDtl',
    'PolicyDtl',
    'ClaimNotificationDtl',
    'ClaimIntimationDtl',
    'ClaimAssessmentDtl',
    'DischargeVoucherDtl',
    'ClaimPaymentDtl',
    'ClaimRejectionDtl',
    'VerificationDtl',
  ];

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
    private readonly callbackBusinessUpdater: TiramisCallbackBusinessUpdaterService,
  ) {}

  async handleCallback(params: {
    environment: string;
    rawXml: string;
  }): Promise<TiramisCallbackAckResultDto> {
    return this.processCallback({
      ...params,
      bypassSignatureVerification: false,
    });
  }

  /**
   * Processes an authenticated, explicitly enabled internal live test callback.
   * The controller is responsible for enforcing the API-key scope and feature gate.
   */
  async handleInternalLiveTestCallback(
    rawXml: string,
  ): Promise<TiramisCallbackAckResultDto> {
    return this.processCallback({
      environment: 'live',
      rawXml,
      bypassSignatureVerification: true,
    });
  }

  private async processCallback(params: {
    environment: string;
    rawXml: string;
    bypassSignatureVerification: boolean;
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

    const signatureVerification = params.bypassSignatureVerification
      ? { isValid: true }
      : await this.verifyCallbackSignature({
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

    if (params.bypassSignatureVerification) {
      this.logger.warn(
        `Processing authenticated internal live callback test for requestId ${parsedCallback.requestId}; TIRA signature verification was bypassed`,
      );
    }

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

      const finalResponse = this.xmlParser.extractFinalResponse(params.rawXml);

      await this.callbackBusinessUpdater.updateBusinessRecord(finalResponse);

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
        finalResponse,
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

    if (!getTiramisCallbackRootDefinition(parsedMessage.rootName)) {
      throw new BadRequestException(
        `Unsupported TIRAMIS callback root: ${parsedMessage.rootName}`,
      );
    }

    const content = parsedMessage.content;
    const requestId = this.getResponseValue(content, 'RequestId');
    const responseId = this.getResponseValue(content, 'ResponseId');
    const responseStatusCode = this.getResponseValue(
      content,
      'ResponseStatusCode',
    );
    const responseStatusDesc = this.getResponseValue(
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
      claimReferenceNumber: this.getBusinessValue(
        content,
        'ClaimReferenceNumber',
      ),
      coverNoteReferenceNumber: this.getBusinessValue(
        content,
        'CoverNoteReferenceNumber',
      ),
      policyReferenceNumber: this.getBusinessValue(
        content,
        'PolicyReferenceNumber',
      ),
      stickerNumber: this.getBusinessValue(content, 'StickerNumber'),
      rawXml,
      signature: parsedMessage.signature,
      content,
      contentXml: parsedMessage.contentXml,
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

    const configuration = await this.resolveCallbackConfiguration({
      environment: params.environment,
      requestId: params.parsedCallback.requestId,
    });

    const pfxPaths =
      await this.tiramisConfigService.getPfxPathsForConfiguration(
        configuration,
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
      payloadHash: params.rawXml ? this.hashPayload(params.rawXml) : null,
      reason: params.reason,
      isProcessed: 0,
    });

    await this.deadLetterRepository.save(deadLetter);

    await this.logCallbackErrorToFile({
      environment: params.environment,
      reason: params.reason,
      parsedCallback: params.parsedCallback,
    });
  }

  private async logCallbackErrorToFile(params: {
    environment: string;
    reason: string;
    parsedCallback?: ParsedTiramisCallbackDto;
  }) {
    const entry = {
      timestamp: new Date().toISOString(),
      environment: params.environment,
      requestId: params.parsedCallback?.requestId || null,
      responseId: params.parsedCallback?.responseId || null,
      rootName: params.parsedCallback?.rootName || null,
      statusCode: params.parsedCallback?.responseStatusCode || null,
      statusDesc: params.parsedCallback?.responseStatusDesc || null,
      reason: params.reason,
    };

    try {
      await appendFile(
        this.callbackErrorLogPath,
        `${JSON.stringify(entry)}\n`,
        'utf8',
      );
    } catch (error: any) {
      this.logger.warn(
        `Could not write to ${this.callbackErrorLogPath}: ${error?.message || 'Unknown error'}`,
      );
    }
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
    const acknowledgementStatusCode = params.isSuccess
      ? TIRAMIS_CALLBACK_ACK_STATUS.SUCCESS_CODE
      : TIRAMIS_CALLBACK_ACK_STATUS.FAILED_CODE;

    const acknowledgementStatusDesc = params.isSuccess
      ? TIRAMIS_CALLBACK_ACK_STATUS.SUCCESS_DESC
      : TIRAMIS_CALLBACK_ACK_STATUS.FAILED_DESC;

    const finalResponse = this.xmlParser.extractFinalResponse(
      params.parsedCallback.rawXml,
    );

    return this.buildFinalResponseAcknowledgementXml({
      environment: params.environment,
      finalResponse,
      acknowledgementStatusCode,
      acknowledgementStatusDesc,
    });
  }

  private async buildFinalResponseAcknowledgementXml(params: {
    environment: string;
    finalResponse: TiramisFinalResponseDto;
    acknowledgementStatusCode?: string;
    acknowledgementStatusDesc?: string;
  }): Promise<TiramisCallbackAckResultDto> {
    const acknowledgementPayload = {
      AcknowledgementId: this.tiramisRequestIdService.generate('ACK'),
      ResponseId: params.finalResponse.responseId,
      AcknowledgementStatusCode: params.acknowledgementStatusCode || 'TIRA001',
      AcknowledgementStatusDesc:
        params.acknowledgementStatusDesc || 'Successful',
    };

    const contentXml = this.xmlBuilder.buildContentXml(
      params.finalResponse.responseAckRoot,
      acknowledgementPayload,
    );

    const configuration = await this.resolveCallbackConfiguration({
      environment: params.environment,
      requestId: params.finalResponse.requestId,
    });

    const pfxPaths =
      await this.tiramisConfigService.getPfxPathsForConfiguration(
        configuration,
      );

    const signature = this.signatureService.signXmlContent({
      contentXml,
      privateKeyPfxPath: pfxPaths.clientPrivateCertificatePath!,
      privateKeyPfxPassword: pfxPaths.clientPrivateCertificatePassword,
    });

    const acknowledgementXml =
      this.xmlBuilder.buildSignedTiraMessageFromContent({
        contentXml,
        signature,
      });

    return {
      acknowledgementId: acknowledgementPayload.AcknowledgementId,
      responseId: params.finalResponse.responseId,
      acknowledgementStatusCode:
        acknowledgementPayload.AcknowledgementStatusCode,
      acknowledgementStatusDesc:
        acknowledgementPayload.AcknowledgementStatusDesc,
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

    await this.logCallbackErrorToFile({
      environment: params.environment,
      parsedCallback: params.parsedCallback,
      reason:
        existingReceipt.lastError ||
        `Callback receipt for requestId ${params.parsedCallback.requestId} is stuck in status ${existingReceipt.processingStatus}`,
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

      const incomingPayloadHash = this.hashPayload(
        params.parsedCallback.rawXml,
      );

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

      await this.logCallbackErrorToFile({
        environment: params.environment,
        parsedCallback: params.parsedCallback,
        reason:
          existingReceipt.lastError ||
          `Callback receipt for requestId ${params.parsedCallback.requestId} is stuck in status ${existingReceipt.processingStatus}`,
      });

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
    params.receipt.acknowledgementXml =
      params.acknowledgement.acknowledgementXml;
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
    finalResponse?: TiramisFinalResponseDto | null;
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
      const regulatoryResponse = params.finalResponse
        ? this.buildRegulatoryResponse(
            params.parsedCallback,
            params.finalResponse,
            transaction?.requestType || transaction?.serviceType || null,
            transaction?.businessReference || null,
          )
        : null;

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
        transactionStatus:
          params.transactionStatus || transaction?.status || null,
        attemptStatus: params.attemptStatus || null,
        coverNoteReferenceNumber:
          params.parsedCallback.coverNoteReferenceNumber || null,
        policyReferenceNumber:
          params.parsedCallback.policyReferenceNumber || null,
        stickerNumber: params.parsedCallback.stickerNumber || null,
        regulatoryResponse,
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
    return createHash('sha256')
      .update(rawXml || '', 'utf8')
      .digest('hex');
  }

  private buildRegulatoryResponse(
    parsedCallback: ParsedTiramisCallbackDto,
    finalResponse: TiramisFinalResponseDto,
    requestType: string | null,
    businessReference: string | null,
  ): RegulatoryFinalResponse {
    const coverNoteReferences =
      parsedCallback.coverNoteReferenceNumber ||
      finalResponse.coverNoteReferenceNumber
        ? [
            {
              sourceCoverNoteNumber: businessReference,
              quotationEntryId: null,
              fleetEntry: null,
              coverNoteReferenceNumber:
                parsedCallback.coverNoteReferenceNumber ||
                finalResponse.coverNoteReferenceNumber ||
                '',
              stickerNumber:
                parsedCallback.stickerNumber ||
                finalResponse.stickerNumber ||
                null,
              registrationNumber: null,
              chassisNumber: null,
            },
          ]
        : [];

    return {
      transactionId: businessReference || parsedCallback.requestId,
      requestId: finalResponse.requestId,
      responseId: finalResponse.responseId,
      requestType: requestType || finalResponse.serviceType,
      responseRoot: finalResponse.rootElement,
      success: finalResponse.responseStatusCode === 'TIRA001',
      statusCode: finalResponse.responseStatusCode,
      statusDescription: finalResponse.responseStatusDesc,
      coverNotes: coverNoteReferences,
      policy: parsedCallback.policyReferenceNumber
        ? {
            policyNumber: businessReference || parsedCallback.requestId,
            policyReferenceNumber: parsedCallback.policyReferenceNumber,
            coverNoteReferenceNumbers: coverNoteReferences.map(
              (item) => item.coverNoteReferenceNumber,
            ),
          }
        : null,
      signatureVerified: parsedCallback.signatureVerified === true,
      responsePayloadHash: this.hashPayload(
        JSON.stringify(finalResponse.payload || {}),
      ),
      receivedAt: new Date().toISOString(),
    };
  }

  private getStringValue(
    content: Record<string, unknown>,
    key: string,
  ): string | null {
    const value = content[key];
    return typeof value === 'string' && value.trim() ? value : null;
  }

  private getResponseValue(
    content: Record<string, unknown>,
    key: string,
  ): string | null {
    return (
      this.getStringValue(content, key) ||
      this.getNestedStringFromAny(content, this.responseHeaderKeys, key)
    );
  }

  private getBusinessValue(
    content: Record<string, unknown>,
    key: string,
  ): string | null {
    return (
      this.getStringValue(content, key) ||
      this.getNestedStringFromAny(content, this.responseDetailKeys, key) ||
      this.getNestedStringFromAny(content, this.responseHeaderKeys, key)
    );
  }

  private getNestedStringFromAny(
    content: Record<string, unknown>,
    parentKeys: string[],
    childKey: string,
  ): string | null {
    for (const parentKey of parentKeys) {
      const parent = content[parentKey];

      if (
        typeof parent === 'object' &&
        parent !== null &&
        !Array.isArray(parent)
      ) {
        const value = this.getStringValue(
          parent as Record<string, unknown>,
          childKey,
        );

        if (value) {
          return value;
        }
      }
    }

    return null;
  }

  private async resolveCallbackConfiguration(params: {
    environment: string;
    requestId: string;
  }) {
    const transaction =
      await this.tiramisSubmissionService.getTransactionForNotification({
        requestId: params.requestId,
      });

    if (transaction?.clientConfigurationId) {
      return this.tiramisConfigService.getRuntimeConfigurationById(
        transaction.clientConfigurationId,
      );
    }

    return this.tiramisConfigService.getActiveConfiguration(params.environment);
  }
}
