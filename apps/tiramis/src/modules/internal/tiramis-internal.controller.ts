import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';

import { TiramisClaimService } from '../claims/services/tiramis-claim.service';
import { TiramisDischargeVoucherService } from '../claims/services/tiramis-discharge-voucher.service';
import { TiramisCoverNoteService } from '../cover-notes/services/tiramis-cover-note.service';
import { TiramisMotorService } from '../motor/services/tiramis-motor.service';
import { TiramisPolicyService } from '../policies/services/tiramis-policy.service';
import { TiramisReinsuranceService } from '../reinsurance/services/tiramis-reinsurance.service';
import { TiramisSubmissionService } from '../submissions/services/tiramis-submission.service';
import type {
  SubmitTiramisCommandDto,
  TiramisSubmissionQueryCommandDto,
} from './dto/submit-tiramis-command.dto';

@Controller()
export class TiramisInternalController {
  private readonly logger = new Logger(TiramisInternalController.name);

  constructor(
    private readonly coverNoteService: TiramisCoverNoteService,
    private readonly motorService: TiramisMotorService,
    private readonly reinsuranceService: TiramisReinsuranceService,
    private readonly policyService: TiramisPolicyService,
    private readonly claimService: TiramisClaimService,
    private readonly dischargeVoucherService: TiramisDischargeVoucherService,
    private readonly submissionService: TiramisSubmissionService,
  ) {}

  @MessagePattern('tiramis.non_motor.submit')
  async submitNonMotor(@Payload() command: SubmitTiramisCommandDto) {
    return this.executeSubmit(command, 'NON_MOTOR', () =>
      this.coverNoteService.submit(
        command.payload as any,
        this.buildSourceMetadata(command),
      ),
    );
  }

  @MessagePattern('tiramis.motor.submit')
  async submitMotor(@Payload() command: SubmitTiramisCommandDto) {
    return this.executeSubmit(command, ['MOTOR', 'MOTOR_FLEET'], () => {
      const payload: Record<string, any> = {
        ...command.payload,
        isFleet: command.requestType === 'MOTOR_FLEET',
      };

      return this.motorService.submit(
        payload as any,
        this.buildSourceMetadata(command),
      );
    });
  }

  @MessagePattern('tiramis.reinsurance.submit')
  async submitReinsurance(@Payload() command: SubmitTiramisCommandDto) {
    return this.executeSubmit(command, 'REINSURANCE', () =>
      this.reinsuranceService.submit(
        command.payload as any,
        this.buildSourceMetadata(command),
      ),
    );
  }

  @MessagePattern('tiramis.policy.submit')
  async submitPolicy(@Payload() command: SubmitTiramisCommandDto) {
    return this.executeSubmit(command, 'POLICY', () =>
      this.policyService.submit(
        command.payload as any,
        this.buildSourceMetadata(command),
      ),
    );
  }

  @MessagePattern('tiramis.claim.notification.submit')
  async submitClaimNotification(@Payload() command: SubmitTiramisCommandDto) {
    return this.executeSubmit(command, 'CLAIM_NOTIFICATION', () =>
      this.claimService.submitClaimNotification(
        command.payload as any,
        this.buildSourceMetadata(command),
      ),
    );
  }

  @MessagePattern('tiramis.claim.intimation.submit')
  async submitClaimIntimation(@Payload() command: SubmitTiramisCommandDto) {
    return this.executeSubmit(command, 'CLAIM_INTIMATION', () =>
      this.claimService.submitClaimIntimation(
        command.payload as any,
        this.buildSourceMetadata(command),
      ),
    );
  }

  @MessagePattern('tiramis.claim.assessment.submit')
  async submitClaimAssessment(@Payload() command: SubmitTiramisCommandDto) {
    return this.executeSubmit(command, 'CLAIM_ASSESSMENT', () =>
      this.claimService.submitClaimAssessment(
        command.payload as any,
        this.buildSourceMetadata(command),
      ),
    );
  }

  @MessagePattern('tiramis.claim.payment.submit')
  async submitClaimPayment(@Payload() command: SubmitTiramisCommandDto) {
    return this.executeSubmit(command, 'CLAIM_PAYMENT', () =>
      this.claimService.submitClaimPayment(
        command.payload as any,
        this.buildSourceMetadata(command),
      ),
    );
  }

  @MessagePattern('tiramis.claim.rejection.submit')
  async submitClaimRejection(@Payload() command: SubmitTiramisCommandDto) {
    return this.executeSubmit(command, 'CLAIM_REJECTION', () =>
      this.claimService.submitClaimRejection(
        command.payload as any,
        this.buildSourceMetadata(command),
      ),
    );
  }

  @MessagePattern('tiramis.claim.discharge_voucher.submit')
  async submitClaimDischargeVoucher(
    @Payload() command: SubmitTiramisCommandDto,
  ) {
    return this.executeSubmit(command, 'DISCHARGE_VOUCHER', () =>
      this.dischargeVoucherService.submitDischargeVoucher(
        command.payload as any,
        this.buildSourceMetadata(command),
      ),
    );
  }

  @MessagePattern('tiramis.discharge_voucher.submit')
  async submitDischargeVoucher(@Payload() command: SubmitTiramisCommandDto) {
    return this.executeSubmit(command, 'DISCHARGE_VOUCHER', () =>
      this.dischargeVoucherService.submitDischargeVoucher(
        command.payload as any,
        this.buildSourceMetadata(command),
      ),
    );
  }

  @MessagePattern('tiramis.submission.status')
  async getSubmissionStatus(
    @Payload() query: TiramisSubmissionQueryCommandDto,
  ) {
    try {
      return await this.submissionService.getSubmissionStatus({
        transactionId: query.transactionId || undefined,
        requestId: query.requestId || undefined,
        businessReference: query.businessReference || undefined,
        includePayload: !!query.includePayload,
      });
    } catch (error: any) {
      throw new RpcException({
        ok: false,
        message: error?.message || 'Failed to get TIRAMIS status',
      });
    }
  }

  @MessagePattern('tiramis.submission.trace')
  async getSubmissionTrace(
    @Payload() query: TiramisSubmissionQueryCommandDto,
  ) {
    try {
      return await this.submissionService.getSubmissionTrace({
        transactionId: query.transactionId || undefined,
        requestId: query.requestId || undefined,
        businessReference: query.businessReference || undefined,
        includePayload: !!query.includePayload,
      });
    } catch (error: any) {
      throw new RpcException({
        ok: false,
        message: error?.message || 'Failed to get TIRAMIS trace',
      });
    }
  }

  private async executeSubmit(
    command: SubmitTiramisCommandDto,
    expectedType: string | string[],
    handler: () => Promise<any>,
  ) {
    try {
      this.assertCommand(command, expectedType);

      this.logger.log(
        `Received ${command.requestType} submission from portal: ${
          command.businessReference || this.resolveBusinessReference(command)
        }`,
      );

      const result = await handler();

      return this.formatSubmitResponse(result);
    } catch (error: any) {
      this.logger.error(
        `${command?.requestType || 'TIRAMIS'} submission failed: ${
          error?.message || 'Unknown error'
        }`,
        error?.stack,
      );

      const response = error?.response || error?.error || null;

      throw new RpcException({
        ok: false,
        message: error?.message || 'TIRAMIS submission failed',
        details: response,
        ...(Array.isArray(response?.validation_errors)
          ? { validation_errors: response.validation_errors }
          : {}),
        ...(Array.isArray(response?.errors) ? { errors: response.errors } : {}),
      });
    }
  }

  private assertCommand(
    command: SubmitTiramisCommandDto,
    expectedType: string | string[],
  ) {
    if (!command) {
      throw new Error('command payload is required');
    }

    const expectedTypes = Array.isArray(expectedType)
      ? expectedType
      : [expectedType];

    if (!expectedTypes.includes(command.requestType)) {
      throw new Error(
        `Invalid requestType. Expected ${expectedTypes.join(
          ' or ',
        )}, received ${command.requestType}`,
      );
    }

    if (!command.payload) {
      throw new Error('payload is required');
    }
  }

  private buildSourceMetadata(command: SubmitTiramisCommandDto) {
    return {
      sourceService: command.sourceService || 'insurance-portal-service',
      sourceCompanyId: command.sourceCompanyId || null,
      sourceUserId: command.sourceUserId || null,
      sourceModule: command.sourceModule || null,
      sourceRecordId:
        command.sourceRecordId ||
        command.policyId ||
        command.quotationId ||
        null,
      policyId: command.policyId || null,
      quotationId: command.quotationId || null,
      businessReference:
        command.businessReference || this.resolveBusinessReference(command),
      requestId: command.requestId || null,
      requestType: command.requestType,
    };
  }

  private resolveBusinessReference(command: SubmitTiramisCommandDto) {
    const payload = command.payload || {};

    return (
      payload.coverNoteNumber ||
      payload.fleet?.fleetId ||
      payload.coverNoteReferenceNumber ||
      payload.policyNumber ||
      payload.claimNotificationNumber ||
      payload.claimIntimationNumber ||
      payload.claimAssessmentNumber ||
      payload.dischargeVoucherNumber ||
      payload.claimPaymentNumber ||
      payload.claimRejectionNumber ||
      null
    );
  }

  private formatSubmitResponse(result: any) {
    const coverNote = this.mapCoverNote(result?.coverNote || result?.motorCoverNote || null);
    const reinsurance = this.mapShallowRecord(result?.reinsurance || null);
    const policy = this.mapShallowRecord(result?.policy || null);
    const record = this.mapShallowRecord(result?.record || null);
    const attempt = this.mapAttempt(result?.attempt || null);
    const transaction = this.mapTransaction(result?.transaction || null);

    return {
      ok: true,
      transaction,
      coverNote,
      reinsurance,
      policy,
      record,
      attempt,
      requestId:
        coverNote?.requestId ||
        reinsurance?.requestId ||
        policy?.requestId ||
        record?.requestId ||
        attempt?.requestId ||
        transaction?.currentRequestId ||
        null,
      tiramisTransactionId:
        transaction?.id ||
        coverNote?.transactionId ||
        reinsurance?.transactionId ||
        policy?.transactionId ||
        record?.transactionId ||
        attempt?.transactionId ||
        null,
      serviceType: transaction?.serviceType || null,
      rootElement: attempt?.rootElement || null,
      acknowledgementStatusCode: attempt?.acknowledgementStatusCode || null,
      acknowledgementStatusDesc: attempt?.acknowledgementStatusDesc || null,
      tiraResponse: result?.tiraResponse || null,
    };
  }

  private mapTransaction(transaction: any) {
    if (!transaction) {
      return null;
    }

    return {
      id: transaction.id || null,
      createdAt: transaction.createdAt || null,
      updatedAt: transaction.updatedAt || null,
      clientConfigurationId: transaction.clientConfigurationId || null,
      serviceType: transaction.serviceType || null,
      sourceService: transaction.sourceService || null,
      sourceModule: transaction.sourceModule || null,
      sourceRecordId: transaction.sourceRecordId || null,
      sourceCompanyId: transaction.sourceCompanyId || null,
      sourceUserId: transaction.sourceUserId || null,
      businessReference: transaction.businessReference || null,
      status: transaction.status || null,
      originalRequestId: transaction.originalRequestId || null,
      currentRequestId: transaction.currentRequestId || null,
      successfulRequestId: transaction.successfulRequestId || null,
      totalAttempts: transaction.totalAttempts ?? null,
      lastAttemptAt: transaction.lastAttemptAt || null,
      successfulAt: transaction.successfulAt || null,
      lastError: transaction.lastError || null,
    };
  }

  private mapAttempt(attempt: any) {
    if (!attempt) {
      return null;
    }

    return {
      id: attempt.id || null,
      createdAt: attempt.createdAt || null,
      updatedAt: attempt.updatedAt || null,
      transactionId: attempt.transactionId || null,
      attemptNo: attempt.attemptNo ?? null,
      requestId: attempt.requestId || null,
      previousRequestId: attempt.previousRequestId || null,
      rootElement: attempt.rootElement || null,
      resubmissionReason: attempt.resubmissionReason || null,
      status: attempt.status || null,
      requestXml: attempt.requestXml || null,
      requestSignature: attempt.requestSignature || null,
      acknowledgementId: attempt.acknowledgementId || null,
      acknowledgementStatusCode: attempt.acknowledgementStatusCode || null,
      acknowledgementStatusDesc: attempt.acknowledgementStatusDesc || null,
      acknowledgementXml: attempt.acknowledgementXml || null,
      ackReceivedAt: attempt.ackReceivedAt || null,
      responseId: attempt.responseId || null,
      responseStatusCode: attempt.responseStatusCode || null,
      responseStatusDesc: attempt.responseStatusDesc || null,
      responseXml: attempt.responseXml || null,
      responseSignature: attempt.responseSignature || null,
      finalResponseReceivedAt: attempt.finalResponseReceivedAt || null,
      responseAcknowledgementId: attempt.responseAcknowledgementId || null,
      responseAckStatusCode: attempt.responseAckStatusCode || null,
      responseAckStatusDesc: attempt.responseAckStatusDesc || null,
      responseAckXml: attempt.responseAckXml || null,
      responseAckSentAt: attempt.responseAckSentAt || null,
      sentAt: attempt.sentAt || null,
      errorMessage: attempt.errorMessage || null,
      retryCount: attempt.retryCount ?? null,
      maxRetries: attempt.maxRetries ?? null,
      isRetryable: attempt.isRetryable ?? null,
      nextRetryAt: attempt.nextRetryAt || null,
      lastRetryAt: attempt.lastRetryAt || null,
      finalCallbackDeadlineAt: attempt.finalCallbackDeadlineAt || null,
      finalCallbackOverdueNotified: attempt.finalCallbackOverdueNotified ?? null,
    };
  }

  private mapCoverNote(coverNote: any) {
    if (!coverNote) {
      return null;
    }

    return {
      id: coverNote.id || null,
      createdAt: coverNote.createdAt || null,
      updatedAt: coverNote.updatedAt || null,
      transactionId: coverNote.transactionId || null,
      currentAttemptId: coverNote.currentAttemptId || null,
      insuranceType: coverNote.insuranceType || null,
      isFleet: coverNote.isFleet ?? null,
      requestId: coverNote.requestId || null,
      companyCode: coverNote.companyCode || null,
      systemCode: coverNote.systemCode || null,
      callbackUrl: coverNote.callbackUrl || null,
      insurerCompanyCode: coverNote.insurerCompanyCode || null,
      tranCompanyCode: coverNote.tranCompanyCode || null,
      coverNoteType: coverNote.coverNoteType ?? null,
      coverNoteNumber: coverNote.coverNoteNumber || null,
      prevCoverNoteReferenceNumber:
        coverNote.prevCoverNoteReferenceNumber || null,
      coverNoteReferenceNumber: coverNote.coverNoteReferenceNumber || null,
      stickerNumber: coverNote.stickerNumber || null,
      salePointCode: coverNote.salePointCode || null,
      coverNoteStartDate: coverNote.coverNoteStartDate || null,
      coverNoteEndDate: coverNote.coverNoteEndDate || null,
      coverNoteDesc: coverNote.coverNoteDesc || null,
      operativeClause: coverNote.operativeClause || null,
      paymentMode: coverNote.paymentMode ?? null,
      currencyCode: coverNote.currencyCode || null,
      exchangeRate: coverNote.exchangeRate || null,
      totalPremiumExcludingTax: coverNote.totalPremiumExcludingTax || null,
      totalPremiumIncludingTax: coverNote.totalPremiumIncludingTax || null,
      commissionPaid: coverNote.commissionPaid || null,
      commissionRate: coverNote.commissionRate || null,
      officerName: coverNote.officerName || null,
      officerTitle: coverNote.officerTitle || null,
      productCode: coverNote.productCode || null,
      endorsementType: coverNote.endorsementType ?? null,
      endorsementReason: coverNote.endorsementReason || null,
      endorsementPremiumEarned: coverNote.endorsementPremiumEarned || null,
      risks: Array.isArray(coverNote.risks)
        ? coverNote.risks.map((risk: any) => ({
            id: risk.id || null,
            createdAt: risk.createdAt || null,
            updatedAt: risk.updatedAt || null,
            coverNoteId: risk.coverNoteId || null,
            motorFleetItemId: risk.motorFleetItemId || null,
            riskCode: risk.riskCode || null,
            sumInsured: risk.sumInsured || null,
            sumInsuredEquivalent: risk.sumInsuredEquivalent || null,
            premiumRate: risk.premiumRate || null,
            premiumBeforeDiscount: risk.premiumBeforeDiscount || null,
            premiumAfterDiscount: risk.premiumAfterDiscount || null,
            premiumExcludingTaxEquivalent:
              risk.premiumExcludingTaxEquivalent || null,
            premiumIncludingTax: risk.premiumIncludingTax || null,
            discounts: Array.isArray(risk.discounts)
              ? risk.discounts.map((discount: any) => ({
                  id: discount.id || null,
                  createdAt: discount.createdAt || null,
                  updatedAt: discount.updatedAt || null,
                  coverNoteRiskId: discount.coverNoteRiskId || null,
                  discountType: discount.discountType || null,
                  discountRate: discount.discountRate || null,
                  discountAmount: discount.discountAmount || null,
                }))
              : [],
            taxes: Array.isArray(risk.taxes)
              ? risk.taxes.map((tax: any) => ({
                  id: tax.id || null,
                  createdAt: tax.createdAt || null,
                  updatedAt: tax.updatedAt || null,
                  coverNoteRiskId: tax.coverNoteRiskId || null,
                  coverNoteAddonId: tax.coverNoteAddonId || null,
                  taxCode: tax.taxCode || null,
                  isTaxExempted: tax.isTaxExempted || null,
                  taxExemptionType: tax.taxExemptionType || null,
                  taxExemptionReference: tax.taxExemptionReference || null,
                  taxRate: tax.taxRate || null,
                  taxAmount: tax.taxAmount || null,
                }))
              : [],
          }))
        : [],
      subjectMatters: Array.isArray(coverNote.subjectMatters)
        ? coverNote.subjectMatters.map((subject: any) => ({
            id: subject.id || null,
            createdAt: subject.createdAt || null,
            updatedAt: subject.updatedAt || null,
            coverNoteId: subject.coverNoteId || null,
            subjectMatterReference: subject.subjectMatterReference || null,
            subjectMatterDesc: subject.subjectMatterDesc || null,
          }))
        : [],
      addons: Array.isArray(coverNote.addons)
        ? coverNote.addons.map((addon: any) => ({
            id: addon.id || null,
            createdAt: addon.createdAt || null,
            updatedAt: addon.updatedAt || null,
            coverNoteId: addon.coverNoteId || null,
            addonReference: addon.addonReference || null,
            addonDesc: addon.addonDesc || null,
            addonAmount: addon.addonAmount || null,
            addonPremiumRate: addon.addonPremiumRate || null,
            premiumExcludingTax: addon.premiumExcludingTax || null,
            premiumExcludingTaxEquivalent:
              addon.premiumExcludingTaxEquivalent || null,
            premiumIncludingTax: addon.premiumIncludingTax || null,
            taxes: Array.isArray(addon.taxes)
              ? addon.taxes.map((tax: any) => ({
                  id: tax.id || null,
                  createdAt: tax.createdAt || null,
                  updatedAt: tax.updatedAt || null,
                  coverNoteRiskId: tax.coverNoteRiskId || null,
                  coverNoteAddonId: tax.coverNoteAddonId || null,
                  taxCode: tax.taxCode || null,
                  isTaxExempted: tax.isTaxExempted || null,
                  taxExemptionType: tax.taxExemptionType || null,
                  taxExemptionReference: tax.taxExemptionReference || null,
                  taxRate: tax.taxRate || null,
                  taxAmount: tax.taxAmount || null,
                }))
              : [],
          }))
        : [],
      policyHolders: Array.isArray(coverNote.policyHolders)
        ? coverNote.policyHolders.map((holder: any) => ({
            id: holder.id || null,
            createdAt: holder.createdAt || null,
            updatedAt: holder.updatedAt || null,
            coverNoteId: holder.coverNoteId || null,
            policyHolderName: holder.policyHolderName || null,
            policyHolderBirthDate: holder.policyHolderBirthDate || null,
            policyHolderType: holder.policyHolderType ?? null,
            policyHolderIdNumber: holder.policyHolderIdNumber || null,
            policyHolderIdType: holder.policyHolderIdType ?? null,
            gender: holder.gender || null,
            countryCode: holder.countryCode || null,
            region: holder.region || null,
            district: holder.district || null,
            street: holder.street || null,
            phoneNumber: holder.phoneNumber || null,
            fax: holder.fax || null,
            postalAddress: holder.postalAddress || null,
            emailAddress: holder.emailAddress || null,
          }))
        : [],
    };
  }

  private mapShallowRecord(record: any) {
    if (!record) {
      return null;
    }

    return {
      ...record,
      createdAt: record.createdAt || null,
      updatedAt: record.updatedAt || null,
    };
  }
}
