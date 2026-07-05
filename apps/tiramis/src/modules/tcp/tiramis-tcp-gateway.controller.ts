import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';

import { TiramisMotorService } from '../motor/services/tiramis-motor.service';
import { TiramisVerificationService } from '../verifications/services/tiramis-verification.service';

type TiramisPortalCommand = {
  sourceService?: string;
  sourceCompanyId?: string | null;
  sourceUserId?: string | null;
  sourceModule?: string | null;
  sourceRecordId?: string | null;
  policyId?: string | null;
  quotationId?: string | null;
  businessReference?: string | null;
  requestType?: string;
  payload?: Record<string, any> | null;
};

const PATTERNS = {
  HEALTH: 'tiramis.health',
  SUBMIT_MOTOR_FLEET: 'tiramis.motor_fleet.submit',
  SUBMIT_COVER_NOTE_VERIFICATION: 'tiramis.verification.cover_note.submit',
  SUBMIT_MOTOR_VERIFICATION: 'tiramis.verification.motor.submit',
  SUBMIT_NIN_VERIFICATION: 'tiramis.verification.nin.submit',
  SUBMIT_COMPANY_VERIFICATION: 'tiramis.verification.company.submit',
  SUBMIT_DETAILS_VERIFICATION: 'tiramis.verification.details.submit',
};

@Controller()
export class TiramisTcpGatewayController {
  private readonly logger = new Logger(TiramisTcpGatewayController.name);

  constructor(
    private readonly motorService: TiramisMotorService,
    private readonly verificationService: TiramisVerificationService,
  ) {}

  @MessagePattern(PATTERNS.HEALTH)
  health(@Payload() payload: Record<string, any>) {
    return {
      success: true,
      service: 'tiramis-service',
      transport: 'tcp',
      status: 'UP',
      receivedPayload: payload || null,
      time: new Date().toISOString(),
    };
  }

  @MessagePattern(PATTERNS.SUBMIT_MOTOR_FLEET)
  async submitMotorFleet(@Payload() command: TiramisPortalCommand) {
    return this.handleSubmit(PATTERNS.SUBMIT_MOTOR_FLEET, command, async () => {
      return this.motorService.submit(
        {
          ...this.toDto(command),
          isFleet: true,
        } as any,
        this.buildSourceMetadata(command),
      );
    });
  }

  @MessagePattern(PATTERNS.SUBMIT_COVER_NOTE_VERIFICATION)
  async submitCoverNoteVerification(@Payload() command: TiramisPortalCommand) {
    return this.handleSubmit(
      PATTERNS.SUBMIT_COVER_NOTE_VERIFICATION,
      command,
      async () => this.verificationService.verifyCoverNote(command.payload as any),
    );
  }

  @MessagePattern(PATTERNS.SUBMIT_MOTOR_VERIFICATION)
  async submitMotorVerification(@Payload() command: TiramisPortalCommand) {
    return this.handleSubmit(
      PATTERNS.SUBMIT_MOTOR_VERIFICATION,
      command,
      async () => this.verificationService.verifyMotor(command.payload as any),
    );
  }

  @MessagePattern(PATTERNS.SUBMIT_NIN_VERIFICATION)
  async submitNinVerification(@Payload() command: TiramisPortalCommand) {
    return this.handleSubmit(
      PATTERNS.SUBMIT_NIN_VERIFICATION,
      command,
      async () => this.verificationService.verifyNin(command.payload as any),
    );
  }

  @MessagePattern(PATTERNS.SUBMIT_COMPANY_VERIFICATION)
  async submitCompanyVerification(@Payload() command: TiramisPortalCommand) {
    return this.handleSubmit(
      PATTERNS.SUBMIT_COMPANY_VERIFICATION,
      command,
      async () => this.verificationService.verifyCompany(command.payload as any),
    );
  }

  @MessagePattern(PATTERNS.SUBMIT_DETAILS_VERIFICATION)
  async submitDetailsVerification(@Payload() command: TiramisPortalCommand) {
    return this.handleSubmit(
      PATTERNS.SUBMIT_DETAILS_VERIFICATION,
      command,
      async () => this.verificationService.verifyDetails(command.payload as any),
    );
  }

  private async handleSubmit(
    pattern: string,
    command: TiramisPortalCommand,
    action: () => Promise<any>,
  ) {
    try {
      this.logger.log(
        `Received portal submission pattern=${pattern}, requestType=${
          command?.requestType || 'unknown'
        }`,
      );

      const result = await action();
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

  private toDto(command: TiramisPortalCommand): any {
    const payload = command?.payload || {};

    return {
      ...payload,
      sourceService: command?.sourceService || payload.sourceService,
      sourceCompanyId: command?.sourceCompanyId || payload.sourceCompanyId,
      sourceUserId: command?.sourceUserId || payload.sourceUserId,
      sourceModule: command?.sourceModule || payload.sourceModule,
      sourceRecordId: command?.sourceRecordId || payload.sourceRecordId,
      policyId: command?.policyId || payload.policyId,
      quotationId: command?.quotationId || payload.quotationId,
      businessReference:
        command?.businessReference || payload.businessReference,
    };
  }

  private buildSourceMetadata(command: TiramisPortalCommand) {
    return {
      sourceService: command?.sourceService || 'insurance-portal-service',
      sourceCompanyId: command?.sourceCompanyId || null,
      sourceUserId: command?.sourceUserId || null,
      sourceModule: command?.sourceModule || null,
      sourceRecordId:
        command?.sourceRecordId ||
        command?.policyId ||
        command?.quotationId ||
        null,
      policyId: command?.policyId || null,
      quotationId: command?.quotationId || null,
      businessReference:
        command?.businessReference || this.resolveBusinessReference(command),
      requestType: command?.requestType,
    };
  }

  private resolveBusinessReference(command: TiramisPortalCommand) {
    const payload = command?.payload || {};

    return (
      payload.coverNoteNumber ||
      payload.coverNoteReferenceNumber ||
      payload.fleet?.fleetId ||
      payload.policyNumber ||
      payload.claimNotificationNumber ||
      payload.claimIntimationNumber ||
      payload.claimAssessmentNumber ||
      payload.dischargeVoucherNumber ||
      payload.claimPaymentNumber ||
      payload.claimRejectionNumber ||
      payload.reinsuranceReferenceNumber ||
      payload.nin ||
      payload.NIN ||
      payload.tin ||
      payload.TIN ||
      payload.companyName ||
      payload.registrationNumber ||
      payload.incorporationCertificateNumber ||
      payload.motorRegistrationNumber ||
      payload.motorChassisNumber ||
      payload.chassisNumber ||
      null
    );
  }

  private formatSubmitResponse(result: any) {
    const coverNote = this.mapShallowRecord(
      result?.coverNote || result?.motorCoverNote || null,
    );
    const reinsurance = this.mapShallowRecord(result?.reinsurance || null);
    const policy = this.mapShallowRecord(result?.policy || null);
    const record = this.mapShallowRecord(result?.record || null);
    const attempt = this.mapShallowRecord(result?.attempt || null);
    const transaction = this.mapShallowRecord(result?.transaction || null);
    const responseRecord = this.mapShallowRecord(result?.response || null);

    const acknowledgementStatusCode =
      attempt?.acknowledgementStatusCode ||
      responseRecord?.responseStatusCode ||
      result?.tiraHttpResponse?.statusCode ||
      null;

    const acknowledgementStatusDesc =
      attempt?.acknowledgementStatusDesc ||
      responseRecord?.responseStatusDesc ||
      result?.tiraHttpResponse?.statusText ||
      null;

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
        responseRecord?.requestId ||
        attempt?.requestId ||
        transaction?.currentRequestId ||
        null,
      tiramisTransactionId:
        transaction?.id ||
        coverNote?.transactionId ||
        reinsurance?.transactionId ||
        policy?.transactionId ||
        record?.transactionId ||
        responseRecord?.transactionId ||
        attempt?.transactionId ||
        null,
      serviceType: transaction?.serviceType || null,
      rootElement: attempt?.rootElement || null,
      acknowledgement: {
        statusCode: acknowledgementStatusCode,
        statusDesc: acknowledgementStatusDesc,
      },
      acknowledgementStatusCode,
      acknowledgementStatusDesc,
      tiraResponse:
        result?.tiraResponse ||
        result?.tiraHttpResponse ||
        (responseRecord
          ? {
              acknowledgementStatusCode: responseRecord.responseStatusCode || null,
              acknowledgementStatusDesc:
                responseRecord.responseStatusDesc || null,
              rawXml: responseRecord.rawResponseXml || null,
            }
          : null),
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
