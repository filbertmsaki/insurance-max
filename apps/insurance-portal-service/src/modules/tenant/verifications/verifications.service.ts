import { BadRequestException, Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
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
  private readonly xmlParser = new XMLParser({ ignoreAttributes: true });
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
    const responseXml =
      liveResponse.xml ?? storedAttempt.payloads?.responseXml ?? null;
    const verifiedRecordDetails = this.parseSafeXml(responseXml);
    const responseCode =
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
        responseCode === 'TIRA001'
          ? 'VERIFIED'
          : responseCode
            ? 'NOT_VERIFIED'
            : 'PENDING',
      responseCode,
      responseMessage:
        tira.message ??
        storedSummary.finalResponseStatusDesc ??
        storedFinalResponse.statusDesc ??
        tracking.finalResponseStatusDesc ??
        tracking.acknowledgementStatusDesc ??
        null,
      registrationNumber: payload.motorRegistrationNumber ?? null,
      coverNoteReferenceNumber: payload.coverNoteReferenceNumber ?? null,
      verifiedRecordDetails,
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
          statusCode: tira.statusCode ?? null,
          message: tira.message ?? null,
          signatureVerified: tira.signatureVerified ?? null,
          receivedAt: tira.receivedAt ?? null,
        },
        verifiedRecordDetails,
      },
    };
  }

  private parseSafeXml(xml?: string): unknown {
    if (!xml) return null;
    try {
      const parsed = this.xmlParser.parse(xml);
      const root = parsed?.TiraMsg ?? parsed;
      if (root && typeof root === 'object') delete root.MsgSignature;
      const response =
        root?.MotorVerificationRes ?? root?.CoverNoteVerificationRes ?? root;
      return {
        responseHeader:
          response?.VerificationHdr ?? response?.CoverNoteHdr ?? null,
        details: response?.VerificationDtl ?? response?.CoverNoteDtl ?? null,
      };
    } catch {
      return null;
    }
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
