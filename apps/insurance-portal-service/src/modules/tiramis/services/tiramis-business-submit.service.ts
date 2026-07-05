import { BadRequestException, Injectable } from '@nestjs/common';

import { SubmitTiramisDto } from '../dto/submit-tiramis.dto';
import { TiramisRequestType } from '../enums/tiramis-request-type.enum';
import { TiramisBusinessPayloadBuilderService } from './tiramis-business-payload-builder.service';
import { TiramisClientService } from './tiramis-client.service';

@Injectable()
export class TiramisBusinessSubmitService {
  constructor(
    private readonly tiramisClientService: TiramisClientService,
    private readonly payloadBuilderService: TiramisBusinessPayloadBuilderService,
  ) {}

  submitCoverNote(params: {
    id: string;
    requestType:
      | TiramisRequestType.NON_MOTOR
      | TiramisRequestType.MOTOR
      | TiramisRequestType.MOTOR_FLEET;
    payload?: Record<string, any> | null;
    businessReference?: string | null;
    authContext?: any;
    forceResubmit?: boolean;
    returnExisting?: boolean;
  }) {
    return this.submit({
      requestType: params.requestType,
      sourceModule: 'cover-notes',
      sourceRecordId: params.id,
      businessReference:
        params.businessReference ||
        params.payload?.coverNoteNumber ||
        params.payload?.coverNoteReferenceNumber ||
        params.payload?.fleet?.fleetId ||
        params.id,
      payload: params.payload,
      authContext: params.authContext,
      forceResubmit: params.forceResubmit,
      returnExisting: params.returnExisting,
    });
  }

  submitReinsurance(params: {
    id: string;
    payload?: Record<string, any> | null;
    businessReference?: string | null;
    authContext?: any;
    forceResubmit?: boolean;
    returnExisting?: boolean;
  }) {
    return this.submit({
      requestType: TiramisRequestType.REINSURANCE,
      sourceModule: 'reinsurance',
      sourceRecordId: params.id,
      businessReference:
        params.businessReference ||
        params.payload?.coverNoteReferenceNumber ||
        params.id,
      payload: params.payload,
      authContext: params.authContext,
      forceResubmit: params.forceResubmit,
      returnExisting: params.returnExisting,
    });
  }

  submitPolicy(params: {
    id: string;
    payload?: Record<string, any> | null;
    businessReference?: string | null;
    authContext?: any;
    forceResubmit?: boolean;
    returnExisting?: boolean;
  }) {
    return this.submit({
      requestType: TiramisRequestType.POLICY,
      sourceModule: 'policies',
      sourceRecordId: params.id,
      policyId: params.id,
      businessReference:
        params.businessReference || params.payload?.policyNumber || params.id,
      payload: params.payload,
      authContext: params.authContext,
      forceResubmit: params.forceResubmit,
      returnExisting: params.returnExisting,
    });
  }

  submitClaimNotification(params: {
    id: string;
    payload?: Record<string, any> | null;
    businessReference?: string | null;
    authContext?: any;
    forceResubmit?: boolean;
    returnExisting?: boolean;
  }) {
    return this.submit({
      requestType: TiramisRequestType.CLAIM_NOTIFICATION,
      sourceModule: 'claims',
      sourceRecordId: params.id,
      businessReference:
        params.businessReference ||
        params.payload?.claimNotificationNumber ||
        params.id,
      payload: params.payload,
      authContext: params.authContext,
      forceResubmit: params.forceResubmit,
      returnExisting: params.returnExisting,
    });
  }

  submitClaimIntimation(params: {
    id: string;
    payload?: Record<string, any> | null;
    businessReference?: string | null;
    authContext?: any;
    forceResubmit?: boolean;
    returnExisting?: boolean;
  }) {
    return this.submit({
      requestType: TiramisRequestType.CLAIM_INTIMATION,
      sourceModule: 'claims',
      sourceRecordId: params.id,
      businessReference:
        params.businessReference ||
        params.payload?.claimIntimationNumber ||
        params.id,
      payload: params.payload,
      authContext: params.authContext,
      forceResubmit: params.forceResubmit,
      returnExisting: params.returnExisting,
    });
  }

  submitClaimAssessment(params: {
    id: string;
    payload?: Record<string, any> | null;
    businessReference?: string | null;
    authContext?: any;
    forceResubmit?: boolean;
    returnExisting?: boolean;
  }) {
    return this.submit({
      requestType: TiramisRequestType.CLAIM_ASSESSMENT,
      sourceModule: 'claims',
      sourceRecordId: params.id,
      businessReference:
        params.businessReference ||
        params.payload?.claimAssessmentNumber ||
        params.id,
      payload: params.payload,
      authContext: params.authContext,
      forceResubmit: params.forceResubmit,
      returnExisting: params.returnExisting,
    });
  }

  submitDischargeVoucher(params: {
    id: string;
    payload?: Record<string, any> | null;
    businessReference?: string | null;
    authContext?: any;
    forceResubmit?: boolean;
    returnExisting?: boolean;
  }) {
    return this.submit({
      requestType: TiramisRequestType.DISCHARGE_VOUCHER,
      sourceModule: 'claims',
      sourceRecordId: params.id,
      businessReference:
        params.businessReference ||
        params.payload?.dischargeVoucherNumber ||
        params.id,
      payload: params.payload,
      authContext: params.authContext,
      forceResubmit: params.forceResubmit,
      returnExisting: params.returnExisting,
    });
  }

  submitClaimPayment(params: {
    id: string;
    payload?: Record<string, any> | null;
    businessReference?: string | null;
    authContext?: any;
    forceResubmit?: boolean;
    returnExisting?: boolean;
  }) {
    return this.submit({
      requestType: TiramisRequestType.CLAIM_PAYMENT,
      sourceModule: 'claims',
      sourceRecordId: params.id,
      businessReference:
        params.businessReference ||
        params.payload?.claimPaymentNumber ||
        params.id,
      payload: params.payload,
      authContext: params.authContext,
      forceResubmit: params.forceResubmit,
      returnExisting: params.returnExisting,
    });
  }

  submitClaimRejection(params: {
    id: string;
    payload?: Record<string, any> | null;
    businessReference?: string | null;
    authContext?: any;
    forceResubmit?: boolean;
    returnExisting?: boolean;
  }) {
    return this.submit({
      requestType: TiramisRequestType.CLAIM_REJECTION,
      sourceModule: 'claims',
      sourceRecordId: params.id,
      businessReference:
        params.businessReference ||
        params.payload?.claimRejectionNumber ||
        params.id,
      payload: params.payload,
      authContext: params.authContext,
      forceResubmit: params.forceResubmit,
      returnExisting: params.returnExisting,
    });
  }

  submitVerification(params: {
    requestType:
      | TiramisRequestType.COVER_NOTE_VERIFICATION
      | TiramisRequestType.MOTOR_VERIFICATION
      | TiramisRequestType.NIN_VERIFICATION
      | TiramisRequestType.COMPANY_VERIFICATION
      | TiramisRequestType.DETAILS_VERIFICATION;
    sourceRecordId?: string | null;
    payload?: Record<string, any> | null;
    businessReference?: string | null;
    authContext?: any;
    forceResubmit?: boolean;
    returnExisting?: boolean;
  }) {
    if (
      !params.sourceRecordId &&
      (!params.payload || Object.keys(params.payload).length === 0)
    ) {
      throw new BadRequestException(
        'Verification submissions require sourceRecordId or payload.',
      );
    }

    const businessReference =
      params.businessReference ||
      this.resolveBusinessReference(params.requestType, params.payload || {}) ||
      params.sourceRecordId ||
      `${params.requestType}-${Date.now()}`;

    return this.submit({
      requestType: params.requestType,
      sourceModule: 'verifications',
      sourceRecordId: params.sourceRecordId || businessReference,
      businessReference,
      payload: params.payload,
      authContext: params.authContext,
      forceResubmit: params.forceResubmit,
      returnExisting: params.returnExisting,
    });
  }

  private submit(params: {
    requestType: TiramisRequestType;
    sourceModule: string;
    sourceRecordId: string;
    payload?: Record<string, any> | null;
    businessReference?: string | null;
    policyId?: string | null;
    quotationId?: string | null;
    authContext?: any;
    forceResubmit?: boolean;
    returnExisting?: boolean;
  }) {
    return this.submitWithBuilder(params);
  }

  private async submitWithBuilder(params: {
    requestType: TiramisRequestType;
    sourceModule: string;
    sourceRecordId: string;
    payload?: Record<string, any> | null;
    businessReference?: string | null;
    policyId?: string | null;
    quotationId?: string | null;
    authContext?: any;
    forceResubmit?: boolean;
    returnExisting?: boolean;
  }) {
    const builtPayload = await this.payloadBuilderService.buildPayload({
      requestType: params.requestType,
      sourceModule: params.sourceModule,
      sourceRecordId: params.sourceRecordId,
      overridePayload: params.payload,
    });

    const dto: SubmitTiramisDto = {
      requestType: params.requestType,
      sourceService: 'insurance-portal-service',
      sourceCompanyId:
        params.authContext?.companyId ||
        params.authContext?.activeCompanyId ||
        null,
      sourceUserId: params.authContext?.userId || null,
      sourceModule: params.sourceModule,
      sourceRecordId: params.sourceRecordId,
      policyId: params.policyId || null,
      quotationId: params.quotationId || null,
      businessReference:
        params.businessReference ||
        this.resolveBusinessReference(params.requestType, builtPayload.payload) ||
        params.sourceRecordId,
      payload: builtPayload.payload,
      forceResubmit: !!params.forceResubmit,
      returnExisting: params.returnExisting !== false,
    };

    const result = await this.tiramisClientService.submit(dto, params.authContext);

    return {
      ...result,
      payloadSource: builtPayload.source,
      submittedPayload: builtPayload.payload,
    };
  }

  private resolveBusinessReference(
    requestType: TiramisRequestType,
    payload: Record<string, any>,
  ): string | null {
    switch (requestType) {
      case TiramisRequestType.REINSURANCE:
        return payload.coverNoteReferenceNumber || null;

      case TiramisRequestType.POLICY:
        return payload.policyNumber || null;

      case TiramisRequestType.CLAIM_NOTIFICATION:
        return payload.claimNotificationNumber || null;

      case TiramisRequestType.CLAIM_INTIMATION:
        return payload.claimIntimationNumber || null;

      case TiramisRequestType.CLAIM_ASSESSMENT:
        return payload.claimAssessmentNumber || null;

      case TiramisRequestType.DISCHARGE_VOUCHER:
        return payload.dischargeVoucherNumber || null;

      case TiramisRequestType.CLAIM_PAYMENT:
        return payload.claimPaymentNumber || null;

      case TiramisRequestType.CLAIM_REJECTION:
        return payload.claimRejectionNumber || null;

      case TiramisRequestType.NON_MOTOR:
      case TiramisRequestType.MOTOR:
      case TiramisRequestType.MOTOR_FLEET:
        return (
          payload.coverNoteNumber ||
          payload.coverNoteReferenceNumber ||
          payload.fleet?.fleetId ||
          null
        );

      case TiramisRequestType.COVER_NOTE_VERIFICATION:
        return (
          payload.coverNoteReferenceNumber ||
          payload.stickerNumber ||
          payload.motorRegistrationNumber ||
          payload.motorChassisNumber ||
          null
        );

      case TiramisRequestType.MOTOR_VERIFICATION:
        return (
          payload.motorRegistrationNumber ||
          payload.registration_no ||
          payload.registrationNumber ||
          payload.motorChassisNumber ||
          payload.chassisNumber ||
          null
        );

      case TiramisRequestType.NIN_VERIFICATION:
        return payload.nin || payload.NIN || null;

      case TiramisRequestType.COMPANY_VERIFICATION:
        return (
          payload.incorporationCertificateNumber ||
          payload.registrationNumber ||
          payload.tin ||
          payload.TIN ||
          payload.companyName ||
          null
        );

      case TiramisRequestType.DETAILS_VERIFICATION:
        return (
          payload.coverNoteReferenceNumber ||
          payload.stickerNumber ||
          payload.motorRegistrationNumber ||
          payload.registration_no ||
          payload.registrationNumber ||
          payload.motorChassisNumber ||
          payload.chassisNumber ||
          payload.nin ||
          payload.NIN ||
          payload.tin ||
          payload.TIN ||
          payload.policyNumber ||
          null
        );

      default:
        return null;
    }
  }

}
