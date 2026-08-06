import { BadRequestException, Injectable } from '@nestjs/common';

import type {
  ServicePricingContext,
  ServiceProductContext,
} from '@insurance-max/contracts';
import { TiramisPermissions } from '../auth/tiramis-permissions.constant';
import { SubmitTiramisDto } from '../dto/submit-tiramis.dto';
import { TiramisAuditAction } from '../enums/tiramis-audit-action.enum';
import { TiramisRequestType } from '../enums/tiramis-request-type.enum';
import { TiramisSubmissionTrackingRepository } from '../repositories/tiramis-submission-tracking.repository';
import { TiramisAccessScopeService } from './tiramis-access-scope.service';
import { TiramisAuditService } from './tiramis-audit.service';
import { TiramisBusinessPayloadBuilderService } from './tiramis-business-payload-builder.service';
import { TiramisBusinessValidationService } from './tiramis-business-validation.service';
import { TiramisClientService } from './tiramis-client.service';
import { TiramisNotificationService } from './tiramis-notification.service';

@Injectable()
export class TiramisBusinessSubmitService {
  constructor(
    private readonly tiramisClientService: TiramisClientService,
    private readonly payloadBuilderService: TiramisBusinessPayloadBuilderService,
    private readonly validationService: TiramisBusinessValidationService,
    private readonly trackingRepository: TiramisSubmissionTrackingRepository,
    private readonly auditService: TiramisAuditService,
    private readonly notificationService: TiramisNotificationService,
    private readonly accessScopeService: TiramisAccessScopeService,
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

  submitAnyBusinessRecord(params: {
    requestType: TiramisRequestType;
    sourceModule: string;
    sourceRecordId: string;
    businessReference?: string | null;
    payload?: Record<string, any> | null;
    authContext?: any;
    forceResubmit?: boolean;
    returnExisting?: boolean;
    productContext?: ServiceProductContext;
    pricingContext?: ServicePricingContext;
  }) {
    return this.submitWithBuilder({
      requestType: params.requestType,
      sourceModule: params.sourceModule,
      sourceRecordId: params.sourceRecordId,
      businessReference: params.businessReference,
      payload: params.payload,
      authContext: params.authContext,
      forceResubmit: params.forceResubmit,
      returnExisting: params.returnExisting,
      productContext: params.productContext,
      pricingContext: params.pricingContext,
    });
  }

  async getBusinessRecordStatus(params: {
    sourceModule: string;
    sourceRecordId: string;
    requestType?: TiramisRequestType | null;
    authContext?: any;
    includePayload?: boolean;
    includeHistory?: boolean;
  }) {
    const scope = this.accessScopeService.resolveScope(params.authContext);

    this.accessScopeService.assertHasPermission(
      scope,
      TiramisPermissions.VIEW_TRACKING,
    );

    const sourceCompanyId = scope.companyId;
    const canAccessAllCompanies = scope.canAccessAllCompanies;

    const latest = await this.trackingRepository.findLatestByBusinessRecord({
      sourceModule: params.sourceModule,
      sourceRecordId: params.sourceRecordId,
      requestType: params.requestType || null,
      sourceCompanyId,
      canAccessAllCompanies,
    });

    let history: any[] = [];

    if (params.includeHistory) {
      history = await this.trackingRepository.findHistoryByBusinessRecord({
        sourceModule: params.sourceModule,
        sourceRecordId: params.sourceRecordId,
        requestType: params.requestType || null,
        sourceCompanyId,
        canAccessAllCompanies,
        includePayload: !!params.includePayload,
      });
    }

    return {
      found: !!latest,
      sourceModule: params.sourceModule,
      sourceRecordId: params.sourceRecordId,
      requestType: params.requestType || null,
      latest: params.includePayload ? latest : this.hidePayload(latest),
      history,
    };
  }

  findDuplicateForBusinessRecord(params: {
    sourceCompanyId?: string | null;
    requestType: TiramisRequestType;
    sourceModule: string;
    sourceRecordId: string;
    businessReference?: string | null;
    businessFingerprint?: string | null;
  }) {
    return this.trackingRepository.findActiveDuplicateCandidate({
      sourceCompanyId: params.sourceCompanyId,
      businessFingerprint: params.businessFingerprint,
      requestType: params.requestType,
      sourceModule: params.sourceModule,
      sourceRecordId: params.sourceRecordId,
      businessReference: params.businessReference,
    });
  }

  async getBusinessRecordHistory(params: {
    sourceModule: string;
    sourceRecordId: string;
    requestType?: TiramisRequestType | null;
    authContext?: any;
    includePayload?: boolean;
  }) {
    const scope = this.accessScopeService.resolveScope(params.authContext);

    this.accessScopeService.assertHasPermission(
      scope,
      TiramisPermissions.VIEW_TRACKING,
    );

    const sourceCompanyId = scope.companyId;
    const canAccessAllCompanies = scope.canAccessAllCompanies;

    const history = await this.trackingRepository.findHistoryByBusinessRecord({
      sourceModule: params.sourceModule,
      sourceRecordId: params.sourceRecordId,
      requestType: params.requestType || null,
      sourceCompanyId,
      canAccessAllCompanies,
      includePayload: !!params.includePayload,
      limit: 100,
    });

    return {
      found: history.length > 0,
      sourceModule: params.sourceModule,
      sourceRecordId: params.sourceRecordId,
      requestType: params.requestType || null,
      count: history.length,
      history,
    };
  }

  submitVerification(params: {
    requestType:
      | TiramisRequestType.COVER_NOTE_VERIFICATION
      | TiramisRequestType.MOTOR_VERIFICATION
      | TiramisRequestType.NIN_VERIFICATION
      | TiramisRequestType.COMPANY_VERIFICATION;
    sourceRecordId?: string | null;
    payload?: Record<string, any> | null;
    businessReference?: string | null;
    authContext?: any;
    forceResubmit?: boolean;
    returnExisting?: boolean;
  }) {
    if (!params.sourceRecordId) {
      throw new BadRequestException(
        'Verification submissions require sourceRecordId for company-scoped access.',
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
      sourceRecordId: params.sourceRecordId || null,
      businessReference,
      payload: params.payload,
      authContext: params.authContext,
      forceResubmit: params.forceResubmit,
      returnExisting: params.returnExisting,
    });
  }

  async validateBusinessSubmission(params: {
    requestType: TiramisRequestType;
    sourceModule: string;
    sourceRecordId: string;
    payload?: Record<string, any> | null;
    authContext?: any;
  }) {
    const scope = this.accessScopeService.resolveScope(params.authContext);

    this.accessScopeService.assertHasPermission(
      scope,
      TiramisPermissions.VALIDATE,
    );

    const accessCheck =
      await this.accessScopeService.assertCanAccessBusinessRecord({
        scope,
        requestType: params.requestType,
        sourceModule: params.sourceModule,
        sourceRecordId: params.sourceRecordId,
      });

    const sourceCompanyId = accessCheck.businessCompanyId;
    const sourceBranchId =
      accessCheck.businessBranchId ??
      params.authContext?.branchId ??
      params.authContext?.activeBranchId ??
      params.authContext?.active_branch_id ??
      null;

    const builtPayload = await this.payloadBuilderService.buildPayload({
      requestType: params.requestType,
      sourceModule: params.sourceModule,
      sourceRecordId: params.sourceRecordId,
      sourceCompanyId,
      sourceBranchId,
      overridePayload: params.payload,
    });

    const validation = await this.validationService.validateBeforeSubmit({
      requestType: params.requestType,
      payload: builtPayload.payload,
      sourceCompanyId,
      sourceBranchId,
      sourceModule: params.sourceModule,
      sourceRecordId: params.sourceRecordId,
    });

    return {
      success: validation.isValid,
      requestType: params.requestType,
      sourceModule: params.sourceModule,
      sourceRecordId: params.sourceRecordId,
      payloadSource: builtPayload.source,
      payload: builtPayload.payload,
      validation,
    };
  }

  private submit(params: {
    requestType: TiramisRequestType;
    sourceModule: string;
    sourceRecordId: string | null;
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
    sourceRecordId: string | null;
    payload?: Record<string, any> | null;
    businessReference?: string | null;
    policyId?: string | null;
    quotationId?: string | null;
    authContext?: any;
    forceResubmit?: boolean;
    returnExisting?: boolean;
    productContext?: ServiceProductContext;
    pricingContext?: ServicePricingContext;
  }) {
    if (!params.sourceRecordId) {
      throw new BadRequestException(
        'Business submission requires sourceRecordId for company-scoped access.',
      );
    }

    const scope = this.accessScopeService.resolveScope(params.authContext);

    this.accessScopeService.assertHasPermission(
      scope,
      TiramisPermissions.SUBMIT,
    );

    const accessCheck =
      await this.accessScopeService.assertCanAccessBusinessRecord({
        scope,
        requestType: params.requestType,
        sourceModule: params.sourceModule,
        sourceRecordId: params.sourceRecordId,
      });

    const sourceCompanyId = accessCheck.businessCompanyId;
    const sourceBranchId =
      accessCheck.businessBranchId ??
      params.authContext?.branchId ??
      params.authContext?.activeBranchId ??
      params.authContext?.active_branch_id ??
      null;

    const builtPayload = await this.payloadBuilderService.buildPayload({
      requestType: params.requestType,
      sourceModule: params.sourceModule,
      sourceRecordId: params.sourceRecordId,
      sourceCompanyId,
      sourceBranchId,
      overridePayload: params.payload,
    });

    await this.auditService.log({
      action: TiramisAuditAction.PAYLOAD_BUILD_SUCCESS,
      requestType: params.requestType,
      sourceModule: params.sourceModule,
      sourceRecordId: params.sourceRecordId,
      businessReference: params.businessReference,
      sourceCompanyId,
      success: true,
      authContext: params.authContext,
      metadata: {
        payloadSource: builtPayload.source,
        payloadKeys: Object.keys(builtPayload.payload || {}),
      },
      requestPayloadSnapshot: builtPayload.payload,
    });

    let validation: any;

    try {
      validation = await this.validationService.assertValidBeforeSubmit({
        requestType: params.requestType,
        payload: builtPayload.payload,
        sourceCompanyId,
        sourceBranchId,
        sourceModule: params.sourceModule,
        sourceRecordId: params.sourceRecordId,
      });

      await this.auditService.log({
        action: TiramisAuditAction.VALIDATION_SUCCESS,
        requestType: params.requestType,
        sourceModule: params.sourceModule,
        sourceRecordId: params.sourceRecordId,
        businessReference: params.businessReference,
        sourceCompanyId,
        success: true,
        authContext: params.authContext,
        metadata: {
          warnings: validation.warnings,
        },
      });
    } catch (error) {
      await this.auditService.log({
        action: TiramisAuditAction.VALIDATION_FAILED,
        requestType: params.requestType,
        sourceModule: params.sourceModule,
        sourceRecordId: params.sourceRecordId,
        businessReference: params.businessReference,
        sourceCompanyId,
        success: false,
        error,
        authContext: params.authContext,
        metadata: {
          payloadSource: builtPayload.source,
        },
      });

      await this.notificationService.notifyValidationFailed({
        requestType: params.requestType,
        sourceCompanyId,
        sourceUserId: params.authContext?.userId || null,
        sourceModule: params.sourceModule,
        sourceRecordId: params.sourceRecordId,
        businessReference:
          params.businessReference ||
          this.resolveBusinessReference(
            params.requestType,
            builtPayload.payload,
          ) ||
          params.sourceRecordId,
        errors: error?.response?.errors || [],
        metadata: {
          payloadSource: builtPayload.source,
          warnings: error?.response?.warnings || [],
        },
      });

      throw error;
    }

    const dto: SubmitTiramisDto = {
      requestType: params.requestType,
      sourceService: 'insurance-portal-service',
      sourceCompanyId,
      sourceUserId: params.authContext?.userId || null,
      sourceModule: params.sourceModule,
      sourceRecordId: params.sourceRecordId,
      policyId: params.policyId || null,
      quotationId: params.quotationId || null,
      businessReference:
        params.businessReference ||
        this.resolveBusinessReference(
          params.requestType,
          builtPayload.payload,
        ) ||
        params.sourceRecordId,
      payload: builtPayload.payload,
      forceResubmit: !!params.forceResubmit,
      returnExisting: !!params.returnExisting,
      productContext: params.productContext,
      pricingContext: params.pricingContext,
    };

    const result = await this.tiramisClientService.submit(
      dto,
      params.authContext,
    );

    return {
      ...result,
      payloadSource: builtPayload.source,
      submittedPayload: builtPayload.payload,
      validation,
    };
  }

  private hidePayload(record: any) {
    if (!record) {
      return null;
    }

    return {
      ...record,
      requestPayload: record.requestPayload ? '[hidden]' : null,
      tiramisResponsePayload: record.tiramisResponsePayload ? '[hidden]' : null,
      finalResponsePayload: record.finalResponsePayload ? '[hidden]' : null,
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

      default:
        return null;
    }
  }
}
