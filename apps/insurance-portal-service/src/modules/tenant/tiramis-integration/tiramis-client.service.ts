import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { environment } from '@insurance-max/shared-config';
import { firstValueFrom } from 'rxjs';

import { SubmitPortalTiraDto } from './dto/submit-portal-tira.dto';

@Injectable()
export class TiramisClientService {
  private readonly logger = new Logger(TiramisClientService.name);

  constructor(private readonly httpService: HttpService) {}

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

    try {
      return await this.request(pattern, payload);
    } catch (error: any) {
      this.logger.error(
        `TIRAMIS submit failed for ${params.dto.business_reference}: ${error?.message || 'Unknown error'}`,
        error?.stack,
      );
      throw new BadGatewayException(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to submit request to TIRAMIS service',
      );
    }
  }

  async getStatus(params: { requestId?: string; businessReference?: string }) {
    if (!params.requestId && !params.businessReference) {
      throw new BadRequestException(
        'requestId or businessReference is required',
      );
    }

    return this.request('tiramis.submission.status', {
      requestId: params.requestId || null,
      businessReference: params.businessReference || null,
    });
  }

  async getTrace(params: { requestId?: string; businessReference?: string }) {
    if (!params.requestId && !params.businessReference) {
      throw new BadRequestException(
        'requestId or businessReference is required',
      );
    }

    return this.request('tiramis.submission.trace', {
      requestId: params.requestId || null,
      businessReference: params.businessReference || null,
    });
  }

  private async request(pattern: string, command: Record<string, any>) {
    const baseUrl = String(environment.TIRAMIS_SERVICE_BASE_URL || '').replace(
      /\/+$/,
      '',
    );
    const route = this.resolveHttpRoute(pattern);
    const isQuery =
      pattern === 'tiramis.submission.status' ||
      pattern === 'tiramis.submission.trace';
    const response = await firstValueFrom(
      this.httpService.request({
        method: isQuery ? 'GET' : 'POST',
        url: `${baseUrl}${route}`,
        params: isQuery ? command : undefined,
        data: isQuery ? undefined : command.payload,
        timeout: Number(environment.TIRAMIS_HTTP_TIMEOUT_MS || 60000),
        validateStatus: () => true,
        headers: { Accept: 'application/json' },
      }),
    );

    if (response.status < 200 || response.status >= 300) {
      const error: any = new Error(
        `TIRAMIS HTTP request failed with status ${response.status}`,
      );
      error.response = { data: response.data, status: response.status };
      throw error;
    }

    return response.data;
  }

  private resolveHttpRoute(pattern: string): string {
    const routes: Record<string, string> = {
      'tiramis.submission.status': '/api/tiramis/submissions/status',
      'tiramis.submission.trace': '/api/tiramis/submissions/trace',
      'tiramis.non_motor.submit': '/api/tiramis/non-motor/cover-notes/submit',
      'tiramis.motor.submit': '/api/tiramis/motor/submit',
      'tiramis.reinsurance.submit': '/api/tiramis/reinsurance/submit',
      'tiramis.policy.submit': '/api/tiramis/policies/submit',
      'tiramis.claim.notification.submit':
        '/api/tiramis/claims/notification/submit',
      'tiramis.claim.intimation.submit':
        '/api/tiramis/claims/intimation/submit',
      'tiramis.claim.assessment.submit':
        '/api/tiramis/claims/assessment/submit',
      'tiramis.discharge_voucher.submit':
        '/api/tiramis/claims/discharge-voucher/submit',
      'tiramis.claim.payment.submit': '/api/tiramis/claims/payment/submit',
      'tiramis.claim.rejection.submit': '/api/tiramis/claims/rejection/submit',
    };

    const route = routes[pattern];
    if (!route) {
      throw new BadRequestException(
        `Unsupported TIRAMIS HTTP route: ${pattern}`,
      );
    }

    return route;
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
