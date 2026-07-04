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

      throw new RpcException({
        ok: false,
        message: error?.message || 'TIRAMIS submission failed',
        details: error?.response || null,
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
    const coverNote = result?.coverNote || null;
    const motorCoverNote = result?.motorCoverNote || null;
    const reinsurance = result?.reinsurance || null;
    const policy = result?.policy || null;
    const record = result?.record || null;
    const attempt = result?.attempt || null;
    const transaction = result?.transaction || null;

    return {
      ok: true,
      transaction,
      coverNote: coverNote || motorCoverNote || null,
      reinsurance,
      policy,
      record,
      attempt,
      requestId:
        coverNote?.requestId ||
        motorCoverNote?.requestId ||
        reinsurance?.requestId ||
        policy?.requestId ||
        record?.requestId ||
        attempt?.requestId ||
        transaction?.currentRequestId ||
        null,
      tiramisTransactionId:
        transaction?.id ||
        coverNote?.transactionId ||
        motorCoverNote?.transactionId ||
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
}
