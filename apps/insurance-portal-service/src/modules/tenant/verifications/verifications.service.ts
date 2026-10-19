import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { TiramisRequestType } from '../../tiramis/enums/tiramis-request-type.enum';
import { TiramisClientService } from '../../tiramis/services/tiramis-client.service';
import { TiramisSubmissionStatus } from '../../tiramis/enums/tiramis-submission-status.enum';
import { TiramisStatusSyncService } from '../../tiramis/services/tiramis-status-sync.service';
import {
  CoverNoteVerificationDto,
  MotorVerificationDto,
} from './dto/verify.dto';

@Injectable()
export class VerificationsService {
  constructor(
    private readonly tiramisClient: TiramisClientService,
    private readonly tiramisStatusSync: TiramisStatusSyncService,
  ) {}
  verifyMotor(user: AuthenticatedUser, dto: MotorVerificationDto) {
    const payload = this.clean(dto as unknown as Record<string, unknown>);
    if (!payload.motorRegistrationNumber && !payload.motorChassisNumber)
      throw new BadRequestException(
        'Either motorRegistrationNumber or motorChassisNumber is required',
      );
    return this.submit(
      user,
      TiramisRequestType.MOTOR_VERIFICATION,
      payload,
      payload.motorRegistrationNumber ||
        payload.motorChassisNumber ||
        'MOTOR_VERIFICATION',
    );
  }
  verifyCoverNote(user: AuthenticatedUser, dto: CoverNoteVerificationDto) {
    const payload = this.clean(dto as unknown as Record<string, unknown>);
    const reference =
      payload.coverNoteReferenceNumber ||
      payload.stickerNumber ||
      payload.motorRegistrationNumber ||
      payload.motorChassisNumber;
    if (!reference)
      throw new BadRequestException(
        'At least one verification value is required',
      );
    return this.submit(
      user,
      TiramisRequestType.COVER_NOTE_VERIFICATION,
      payload,
      reference,
    );
  }
  private async submit(
    user: AuthenticatedUser,
    requestType: TiramisRequestType,
    payload: Record<string, any>,
    businessReference: string,
  ) {
    const existing =
      await this.tiramisClient.findLatestSubmissionForSameBusiness({
        requestType,
        sourceCompanyId: user.companyId,
        sourceModule: 'verifications',
        businessReference,
      });
    if (existing?.status === TiramisSubmissionStatus.FINAL_SUCCESS) {
      // A successful verification must never be submitted to TIRA a second
      // time. Refresh its result by the original transaction/request ID and
      // let status sync update the linked local record before returning it.
      const sync = await this.tiramisStatusSync.syncOne(existing.id, user);
      const refreshed = await this.tiramisClient.getLocalTrackingById(
        existing.id,
      );
      return this.toVerificationResult(requestType, payload, refreshed, sync);
    }
    const stalePending =
      existing?.status === 'PENDING' &&
      !existing.tiramisRequestId &&
      !existing.submittedAt;
    const result: any = await this.tiramisClient.submit(
      {
        requestType,
        payload,
        sourceService: 'insurance-portal-service',
        sourceCompanyId: user.companyId,
        sourceUserId: user.id,
        sourceModule: 'verifications',
        businessReference,
        forceResubmit: stalePending,
        returnExisting: !stalePending,
      },
      user,
    );
    return this.toVerificationResult(requestType, payload, result);
  }

  private toVerificationResult(
    requestType: TiramisRequestType,
    payload: Record<string, any>,
    result: any,
    sync?: any,
  ) {
    const liveResponse = result?.tiramis ?? {};
    const tira = liveResponse.tira ?? {};
    const tracking = result?.tracking ?? {};
    const storedPayload = tracking.tiramisResponsePayload ?? {};
    const storedSummary = storedPayload.summary ?? {};
    const storedAttempt =
      storedPayload.attempts?.[storedPayload.attempts.length - 1] ??
      storedPayload.currentAttempt ??
      {};
    const storedFinalResponse = storedAttempt.finalResponse ?? {};
    const normalizedVerification =
      liveResponse.verification ??
      storedPayload.verification ??
      storedSummary.verification ??
      null;
    const verifiedRecordDetails =
      normalizedVerification?.details ??
      liveResponse.verifiedRecordDetails ??
      null;
    const xml =
      liveResponse.xml ??
      storedPayload.xml ??
      storedAttempt.responseXml ??
      storedAttempt.payloads?.responseXml ??
      storedFinalResponse.rawXml ??
      storedFinalResponse.xml ??
      null;
    const responseCode =
      normalizedVerification?.responseCode ??
      tira.statusCode ??
      storedSummary.finalResponseStatusCode ??
      storedFinalResponse.statusCode ??
      tracking.finalResponseStatusCode ??
      tracking.acknowledgementStatusCode ??
      null;
    return {
      success:
        (liveResponse.success === true || result?.success === true) &&
        (responseCode === null || responseCode === 'TIRA001'),
      verificationType:
        requestType === TiramisRequestType.MOTOR_VERIFICATION
          ? 'MOTOR'
          : 'COVER_NOTE',
      requestId:
        liveResponse.request?.requestId ?? tracking.tiramisRequestId ?? null,
      transactionId: tracking.tiramisTransactionId ?? null,
      status:
        normalizedVerification?.status ??
        (responseCode === 'TIRA001'
          ? 'VERIFIED'
          : responseCode
            ? 'NOT_VERIFIED'
            : 'PENDING'),
      responseCode,
      responseMessage:
        normalizedVerification?.responseMessage ??
        tira.message ??
        storedSummary.finalResponseStatusDesc ??
        storedFinalResponse.statusDesc ??
        tracking.finalResponseStatusDesc ??
        tracking.acknowledgementStatusDesc ??
        null,
      registrationNumber: payload.motorRegistrationNumber ?? null,
      coverNoteReferenceNumber: payload.coverNoteReferenceNumber ?? null,
      verifiedRecordDetails,
      xml,
      respondedAt:
        tira.receivedAt ??
        tracking.finalResponseReceivedAt ??
        tracking.lastSyncedAt ??
        new Date().toISOString(),
      fullResponse: {
        success: liveResponse.success === true,
        service: liveResponse.service ?? null,
        request: liveResponse.request ?? {
          requestId: tracking.tiramisRequestId ?? null,
          status: tracking.status ?? null,
        },
        tira: {
          responseId: tira.responseId ?? null,
          statusCode:
            normalizedVerification?.responseCode ?? tira.statusCode ?? null,
          message:
            normalizedVerification?.responseMessage ?? tira.message ?? null,
          signatureVerified:
            normalizedVerification?.signatureVerified ??
            tira.signatureVerified ??
            null,
          receivedAt:
            normalizedVerification?.respondedAt ?? tira.receivedAt ?? null,
        },
        verifiedRecordDetails,
        xml,
        sync: sync
          ? {
              status: sync.status ?? tracking.status ?? null,
              changed: sync.changed ?? false,
              businessRecordSync: sync.businessRecordSync ?? null,
            }
          : undefined,
      },
    };
  }
  private clean<T extends Record<string, unknown>>(
    dto: T,
  ): Record<string, any> {
    return Object.fromEntries(
      Object.entries(dto)
        .map(([key, value]) => [
          key,
          typeof value === 'string'
            ? ['motorRegistrationNumber', 'motorChassisNumber'].includes(key)
              ? value.trim().toUpperCase()
              : value.trim()
            : value,
        ])
        .filter(
          ([, value]) => value !== undefined && value !== null && value !== '',
        ),
    );
  }
}
