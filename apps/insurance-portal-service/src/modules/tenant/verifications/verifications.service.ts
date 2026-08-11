import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { TiramisRequestType } from '../../tiramis/enums/tiramis-request-type.enum';
import { TiramisClientService } from '../../tiramis/services/tiramis-client.service';
import {
  CoverNoteVerificationDto,
  MotorVerificationDto,
} from './dto/verify.dto';

@Injectable()
export class VerificationsService {
  constructor(private readonly tiramisClient: TiramisClientService) {}
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
    const duplicate = await this.tiramisClient.checkDuplicate({
      requestType,
      sourceCompanyId: user.companyId,
      sourceModule: 'verifications',
      businessReference,
    });
    const existing = duplicate.existingTracking as any;
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
      { companyId: user.companyId, userId: user.id },
    );
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
      respondedAt: tira.receivedAt ?? new Date().toISOString(),
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
