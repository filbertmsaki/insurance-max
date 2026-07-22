import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { catchError, firstValueFrom, of, timeout } from 'rxjs';

import { SubmitPortalTiraDto } from './dto/submit-portal-tira.dto';

@Injectable()
export class TiramisClientService {
  private readonly logger = new Logger(TiramisClientService.name);

  constructor(
    @Inject('TIRAMIS_SERVICE_CLIENT')
    private readonly tiramisClient: ClientProxy,
  ) {}

  async submit(params: {
    companyId: string;
    userId?: string | null;
    dto: SubmitPortalTiraDto;
  }) {
    const pattern = this.resolveSubmitPattern(params.dto.requestType);

    const payload = {
      sourceService: 'insurance-portal-service',
      sourceCompanyId: params.companyId,
      sourceUserId: params.userId || null,
      sourceModule: params.dto.source_module || null,
      sourceRecordId:
        params.dto.source_record_id ||
        params.dto.policy_id ||
        params.dto.quotation_id ||
        null,
      policyId: params.dto.policy_id || null,
      quotationId: params.dto.quotation_id || null,
      businessReference: params.dto.business_reference,
      requestId: params.dto.requestId || null,
      requestType: params.dto.requestType,
      payload: params.dto.payload,
    };

    const response = await firstValueFrom(
      this.tiramisClient.send(pattern, payload).pipe(
        timeout(30000),
        catchError((error) => {
          this.logger.error(
            `TIRAMIS submit failed for ${params.dto.business_reference}: ${
              error?.message || 'Unknown error'
            }`,
            error?.stack,
          );

          return of({
            ok: false,
            error:
              error?.message || 'Failed to submit request to TIRAMIS service',
          });
        }),
      ),
    );

    if (!response || response.ok === false) {
      throw new BadGatewayException(
        response?.error || 'TIRAMIS service did not return a valid response',
      );
    }

    return response;
  }

  async getStatus(params: { requestId?: string; businessReference?: string }) {
    if (!params.requestId && !params.businessReference) {
      throw new BadRequestException(
        'requestId or businessReference is required',
      );
    }

    return firstValueFrom(
      this.tiramisClient
        .send('tiramis.submission.status', {
          requestId: params.requestId || null,
          businessReference: params.businessReference || null,
        })
        .pipe(timeout(15000)),
    );
  }

  async getTrace(params: { requestId?: string; businessReference?: string }) {
    if (!params.requestId && !params.businessReference) {
      throw new BadRequestException(
        'requestId or businessReference is required',
      );
    }

    return firstValueFrom(
      this.tiramisClient
        .send('tiramis.submission.trace', {
          requestId: params.requestId || null,
          businessReference: params.businessReference || null,
        })
        .pipe(timeout(15000)),
    );
  }

  private resolveSubmitPattern(requestType: string): string {
    switch (requestType) {
      case 'NON_MOTOR':
        return 'tiramis.non_motor.submit';
      case 'MOTOR':
      case 'MOTOR_FLEET':
        return 'tiramis.motor.submit';
      case 'REINSURANCE':
        return 'tiramis.reinsurance.submit';
      case 'POLICY':
        return 'tiramis.policy.submit';
      case 'CLAIM_NOTIFICATION':
        return 'tiramis.claim.notification.submit';
      case 'CLAIM_INTIMATION':
        return 'tiramis.claim.intimation.submit';
      case 'CLAIM_ASSESSMENT':
        return 'tiramis.claim.assessment.submit';
      case 'DISCHARGE_VOUCHER':
        return 'tiramis.discharge_voucher.submit';
      case 'CLAIM_PAYMENT':
        return 'tiramis.claim.payment.submit';
      case 'CLAIM_REJECTION':
        return 'tiramis.claim.rejection.submit';
      default:
        throw new BadRequestException(
          `Unsupported TIRAMIS requestType: ${requestType}`,
        );
    }
  }
}
