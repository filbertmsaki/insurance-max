import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';

import { unwrapApiResponse } from '@insurance-max/contracts';
import {
  HTTP_HEADERS,
  RequestContextService,
} from '@insurance-max/shared-kernel';
import { TiramisCompanyConfigurationEntity } from '../../tiramis/entities/tiramis-company-configuration.entity';
import { TiramisServiceApiKeyVaultService } from '../../tiramis/services/tiramis-service-api-key-vault.service';

import { SubmitPortalTiraDto } from './dto/submit-portal-tira.dto';

@Injectable()
export class TiramisClientService {
  private readonly logger = new Logger(TiramisClientService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly requestContextService: RequestContextService,
    private readonly apiKeyVault: TiramisServiceApiKeyVaultService,
    @InjectRepository(TiramisCompanyConfigurationEntity)
    private readonly companyConfigurationRepository: Repository<TiramisCompanyConfigurationEntity>,
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

    try {
      return await this.request(
        pattern,
        payload,
        params.companyId,
        params.dto.serviceContext,
      );
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

    return this.request(
      'tiramis.submission.status',
      {
        requestId: params.requestId || null,
        businessReference: params.businessReference || null,
      },
      null,
    );
  }

  async getTrace(params: { requestId?: string; businessReference?: string }) {
    if (!params.requestId && !params.businessReference) {
      throw new BadRequestException(
        'requestId or businessReference is required',
      );
    }

    return this.request(
      'tiramis.submission.trace',
      {
        requestId: params.requestId || null,
        businessReference: params.businessReference || null,
      },
      null,
    );
  }

  private async request(
    pattern: string,
    command: Record<string, unknown>,
    companyId: string | null,
    serviceContext?: Record<string, unknown>,
  ) {
    const route = this.resolveHttpRoute(pattern);

    const isQuery =
      pattern === 'tiramis.submission.status' ||
      pattern === 'tiramis.submission.trace';

    const requestId = this.requestContextService.getRequestId();

    const correlationId =
      this.requestContextService.getCorrelationId() || requestId;

    const apiKey = await this.resolveApiKey(companyId);

    const response = await firstValueFrom(
      this.httpService.request({
        method: isQuery ? 'GET' : 'POST',

        url: route,

        params: isQuery ? command : undefined,

        data: isQuery ? undefined : command.payload,

        validateStatus: () => true,

        headers: {
          Accept: 'application/json',

          'X-API-Key': apiKey,

          ...(serviceContext
            ? { 'X-Service-Context': this.encodeServiceContext(serviceContext) }
            : {}),

          ...(requestId ? { [HTTP_HEADERS.REQUEST_ID]: requestId } : {}),

          ...(correlationId
            ? { [HTTP_HEADERS.CORRELATION_ID]: correlationId }
            : {}),
        },
      }),
    );

    if (response.status < 200 || response.status >= 300) {
      const error = new Error(
        `TIRAMIS HTTP request failed with status ${response.status}`,
      ) as Error & {
        response?: {
          data: unknown;
          status: number;
        };
      };

      error.response = { data: response.data, status: response.status };
      throw error;
    }

    return unwrapApiResponse(response.data);
  }

  private encodeServiceContext(context: Record<string, unknown>): string {
    return Buffer.from(JSON.stringify(context), 'utf8').toString('base64url');
  }

  private async resolveApiKey(companyId: string | null): Promise<string> {
    if (!companyId) {
      throw new BadRequestException(
        'A company context is required to resolve the TIRAMIS API key',
      );
    }

    const environment =
      this.configService.get<string>('tiramisClient.targetEnvironment') ??
      'test';
    const configuration = await this.companyConfigurationRepository
      .createQueryBuilder('configuration')
      .addSelect('configuration.serviceApiKeyEncrypted')
      .where('configuration.companyId = :companyId', { companyId })
      .andWhere('configuration.environment = :environment', { environment })
      .andWhere('configuration.isActive = true')
      .getOne();

    const apiKey = this.apiKeyVault.decrypt(
      configuration?.serviceApiKeyEncrypted,
    );

    if (!apiKey) {
      throw new BadRequestException(
        'TIRAMIS API key is not configured for the current company',
      );
    }

    return apiKey;
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
