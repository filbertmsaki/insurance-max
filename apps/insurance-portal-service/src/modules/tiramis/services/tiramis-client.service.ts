import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { catchError, firstValueFrom, timeout } from 'rxjs';

import { SubmitTiramisDto } from '../dto/submit-tiramis.dto';
import { TiramisStatusQueryDto } from '../dto/tiramis-status-query.dto';
import { TiramisRequestType } from '../enums/tiramis-request-type.enum';
import { TiramisSubmissionTrackingRepository } from '../repositories/tiramis-submission-tracking.repository';
import { TiramisSubmissionStatus } from '../enums/tiramis-submission-status.enum';

export const TIRAMIS_CLIENT = 'TIRAMIS_CLIENT';

@Injectable()
export class TiramisClientService {
  private readonly logger = new Logger(TiramisClientService.name);

  private readonly submitPatternMap: Record<TiramisRequestType, string> = {
    [TiramisRequestType.NON_MOTOR]: 'tiramis.non_motor.submit',
    [TiramisRequestType.MOTOR]: 'tiramis.motor.submit',
    [TiramisRequestType.MOTOR_FLEET]: 'tiramis.motor.submit',
    [TiramisRequestType.REINSURANCE]: 'tiramis.reinsurance.submit',
    [TiramisRequestType.POLICY]: 'tiramis.policy.submit',
    [TiramisRequestType.CLAIM_NOTIFICATION]:
      'tiramis.claim.notification.submit',
    [TiramisRequestType.CLAIM_INTIMATION]: 'tiramis.claim.intimation.submit',
    [TiramisRequestType.CLAIM_ASSESSMENT]: 'tiramis.claim.assessment.submit',
    [TiramisRequestType.DISCHARGE_VOUCHER]:
      'tiramis.claim.discharge_voucher.submit',
    [TiramisRequestType.CLAIM_PAYMENT]: 'tiramis.claim.payment.submit',
    [TiramisRequestType.CLAIM_REJECTION]: 'tiramis.claim.rejection.submit',
  };

  constructor(
    @Inject(TIRAMIS_CLIENT)
    private readonly tiramisClient: ClientProxy,
    private readonly trackingRepository: TiramisSubmissionTrackingRepository,
  ) {}

  async submit(dto: SubmitTiramisDto, authContext?: any) {
    const pattern = this.submitPatternMap[dto.requestType];

    if (!pattern) {
      throw new BadRequestException(
        `Unsupported TIRAMIS request type: ${dto.requestType}`,
      );
    }

    const command = {
      sourceService: dto.sourceService || 'insurance-portal-service',
      sourceCompanyId:
        dto.sourceCompanyId ||
        authContext?.companyId ||
        authContext?.activeCompanyId ||
        authContext?.active_company_id ||
        null,
      sourceUserId: dto.sourceUserId || authContext?.userId || authContext?.id || null,
      sourceModule: dto.sourceModule || this.resolveSourceModule(dto),
      sourceRecordId: dto.sourceRecordId || null,
      policyId: dto.policyId || null,
      quotationId: dto.quotationId || null,
      businessReference:
        dto.businessReference || this.resolveBusinessReference(dto),
      requestType: dto.requestType,
      payload: dto.payload,
    };

    const tracking = await this.trackingRepository.save(
      this.trackingRepository.create({
        requestType: dto.requestType,
        status: TiramisSubmissionStatus.PENDING,
        sourceService: command.sourceService,
        sourceCompanyId: command.sourceCompanyId,
        sourceUserId: command.sourceUserId,
        sourceModule: command.sourceModule,
        sourceRecordId: command.sourceRecordId,
        policyId: command.policyId,
        quotationId: command.quotationId,
        businessReference: command.businessReference,
        requestPayload: dto.payload,
      }),
    );

    try {
      this.logger.log(
        `Submitting ${dto.requestType} to tiramis-service using pattern ${pattern}`,
      );

      const response = await this.send(pattern, command);

      await this.trackingRepository.markSent(tracking.id, response);

      const acknowledgementCode =
        response?.acknowledgement?.statusCode ||
        response?.tiraResponse?.acknowledgementStatusCode ||
        response?.tiraResponse?.AcknowledgementStatusCode ||
        null;

      if (acknowledgementCode) {
        await this.trackingRepository.markAcknowledged(tracking.id, response);
      }

      return {
        localTrackingId: tracking.id,
        localStatus: acknowledgementCode
          ? TiramisSubmissionStatus.ACKNOWLEDGED
          : TiramisSubmissionStatus.SENT_TO_TIRAMIS_SERVICE,
        tiramis: response,
      };
    } catch (error) {
      await this.trackingRepository.markFailed(tracking.id, error);

      throw error;
    }
  }

  async getStatus(query: TiramisStatusQueryDto) {
    this.assertStatusQuery(query);

    return this.send('tiramis.submission.status', {
      transactionId: query.transactionId || null,
      requestId: query.requestId || null,
      businessReference: query.businessReference || null,
      includePayload: !!query.includePayload,
    });
  }

  async getTrace(query: TiramisStatusQueryDto) {
    this.assertStatusQuery(query);

    return this.send('tiramis.submission.trace', {
      transactionId: query.transactionId || null,
      requestId: query.requestId || null,
      businessReference: query.businessReference || null,
      includePayload: !!query.includePayload,
    });
  }

  async getLocalTrackingById(id: string) {
    const tracking = await this.trackingRepository.findById(id);

    if (!tracking) {
      throw new BadRequestException('TIRAMIS local tracking record not found');
    }

    return tracking;
  }

  async getLocalTrackingByBusinessReference(businessReference: string) {
    return this.trackingRepository.findByBusinessReference(businessReference);
  }

  async getRecentLocalTracking(limit = 50) {
    return this.trackingRepository.findRecent(limit);
  }

  private async send(pattern: string, payload: Record<string, any>) {
    try {
      return await firstValueFrom(
        this.tiramisClient.send(pattern, payload).pipe(
          timeout(Number(process.env.TIRAMIS_TCP_TIMEOUT_MS || 60000)),
          catchError((error) => {
            throw error;
          }),
        ),
      );
    } catch (error: any) {
      if (error?.name === 'TimeoutError') {
        throw new RequestTimeoutException(
          'TIRAMIS service request timeout. Please check tiramis-service connection.',
        );
      }

      const message =
        error?.message ||
        error?.response?.message ||
        error?.error?.message ||
        'Failed to communicate with tiramis-service';

      throw new BadRequestException({
        message,
        details: error?.response || error?.error || null,
      });
    }
  }

  private assertStatusQuery(query: TiramisStatusQueryDto) {
    if (!query.transactionId && !query.requestId && !query.businessReference) {
      throw new BadRequestException(
        'Provide transactionId, requestId, or businessReference',
      );
    }
  }

  private resolveSourceModule(dto: SubmitTiramisDto): string {
    switch (dto.requestType) {
      case TiramisRequestType.NON_MOTOR:
      case TiramisRequestType.MOTOR:
      case TiramisRequestType.MOTOR_FLEET:
        return 'cover-notes';

      case TiramisRequestType.REINSURANCE:
        return 'reinsurance';

      case TiramisRequestType.POLICY:
        return 'policies';

      case TiramisRequestType.CLAIM_NOTIFICATION:
      case TiramisRequestType.CLAIM_INTIMATION:
      case TiramisRequestType.CLAIM_ASSESSMENT:
      case TiramisRequestType.DISCHARGE_VOUCHER:
      case TiramisRequestType.CLAIM_PAYMENT:
      case TiramisRequestType.CLAIM_REJECTION:
        return 'claims';

      default:
        return 'tiramis';
    }
  }

  private resolveBusinessReference(dto: SubmitTiramisDto): string | null {
    const payload = dto.payload || {};

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
}
