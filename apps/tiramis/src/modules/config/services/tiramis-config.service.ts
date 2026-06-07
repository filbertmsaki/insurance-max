import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TiramisClientConfigurationEntity } from '../entities/tiramis-client-configuration.entity';
import { TiramisResponseCodeEntity } from '../entities/tiramis-response-code.entity';
import { TiramisServiceEndpointEntity } from '../entities/tiramis-service-endpoint.entity';
import { resolveTiramisCertificatePath } from '../utils/tiramis-certificate-path.util';

export interface TiramisRequestHeaders {
  [key: string]: string;
  'Content-Type': string;
  ClientCode: string;
  ClientKey: string;
}

export interface TiramisResolvedRequestDtoFields {
  environment: string;
  clientConfigurationId: string;
  sourceRecordId: string;
  companyCode: string;
  systemCode: string;
  callbackUrl: string;
  insurerCompanyCode: string;
  tranCompanyCode?: string | null;
}

export interface TiramisResolvedRequestContext<TDto> {
  configuration: TiramisClientConfigurationEntity;
  dto: TDto & TiramisResolvedRequestDtoFields;
}

@Injectable()
export class TiramisConfigService {
  constructor(
    @InjectRepository(TiramisClientConfigurationEntity)
    private readonly clientConfigurationRepository: Repository<TiramisClientConfigurationEntity>,
    @InjectRepository(TiramisServiceEndpointEntity)
    private readonly serviceEndpointRepository: Repository<TiramisServiceEndpointEntity>,
    @InjectRepository(TiramisResponseCodeEntity)
    private readonly responseCodeRepository: Repository<TiramisResponseCodeEntity>,
  ) {}

  resolveRuntimeEnvironment(appEnv = process.env.APP_ENV || process.env.NODE_ENV || 'development') {
    return appEnv === 'production' ? 'live' : 'test';
  }

  async getActiveRuntimeConfiguration(): Promise<TiramisClientConfigurationEntity> {
    return this.getActiveConfiguration(this.resolveRuntimeEnvironment());
  }

  async getActiveConfiguration(
    environment: string,
  ): Promise<TiramisClientConfigurationEntity> {
    const configuration = await this.clientConfigurationRepository.findOne({
      where: {
        environment,
        isActive: 1,
      },
      relations: {
        endpoints: true,
      },
    });

    if (!configuration) {
      throw new NotFoundException(
        `Active TIRAMIS configuration not found for environment: ${environment}`,
      );
    }

    return configuration;
  }

  async resolveSubmissionContext<TDto>(
    dto: TDto,
    sourceRecordId: string,
  ): Promise<TiramisResolvedRequestContext<TDto>> {
    const configuration = await this.getActiveRuntimeConfiguration();

    return {
      configuration,
      dto: {
        ...dto,
        environment: configuration.environment,
        clientConfigurationId: configuration.id,
        sourceRecordId,
        companyCode: configuration.companyCode,
        systemCode: configuration.systemCode,
        callbackUrl: configuration.callbackBaseUrl,
        insurerCompanyCode: configuration.insurerCompanyCode,
        tranCompanyCode: configuration.tranCompanyCode || null,
      } as TDto & TiramisResolvedRequestDtoFields,
    };
  }

  async getConfigurationById(
    id: string,
  ): Promise<TiramisClientConfigurationEntity> {
    const configuration = await this.clientConfigurationRepository.findOne({
      where: { id },
      relations: {
        endpoints: true,
      },
    });

    if (!configuration) {
      throw new NotFoundException('TIRAMIS configuration not found');
    }

    return configuration;
  }

  async getEndpoint(params: {
    environment: string;
    serviceType: string;
  }): Promise<TiramisServiceEndpointEntity> {
    const configuration = await this.getActiveConfiguration(params.environment);

    const endpoint = await this.serviceEndpointRepository.findOne({
      where: {
        clientConfigurationId: configuration.id,
        serviceType: params.serviceType,
        isActive: 1,
      },
    });

    if (!endpoint) {
      throw new NotFoundException(
        `TIRAMIS endpoint not configured for service type: ${params.serviceType}`,
      );
    }

    return endpoint;
  }

  async getEndpointForConfiguration(
    configurationId: string,
    serviceType: string,
  ): Promise<TiramisServiceEndpointEntity> {
    const endpoint = await this.serviceEndpointRepository.findOne({
      where: {
        clientConfigurationId: configurationId,
        serviceType,
        isActive: 1,
      },
    });

    if (!endpoint) {
      throw new NotFoundException(
        `TIRAMIS endpoint not configured for service type: ${serviceType}`,
      );
    }

    return endpoint;
  }

  async getFullEndpointUrl(params: {
    environment: string;
    serviceType: string;
  }): Promise<string> {
    const configuration = await this.getActiveConfiguration(params.environment);
    const endpoint = await this.getEndpoint(params);

    return this.joinUrl(configuration.baseUrl, endpoint.endpointUrl);
  }

  async getFullEndpointUrlForConfiguration(params: {
    configuration: TiramisClientConfigurationEntity;
    serviceType: string;
  }): Promise<string> {
    const endpoint = await this.getEndpointForConfiguration(
      params.configuration.id,
      params.serviceType,
    );

    return this.joinUrl(params.configuration.baseUrl, endpoint.endpointUrl);
  }

  async getRequestHeaders(environment: string): Promise<TiramisRequestHeaders> {
    const configuration = await this.getActiveConfiguration(environment);

    if (!configuration.clientCode || !configuration.clientKey) {
      throw new BadRequestException(
        'TIRAMIS ClientCode or ClientKey is missing in configuration',
      );
    }

    return {
      'Content-Type': 'application/xml',
      ClientCode: configuration.clientCode,
      ClientKey: configuration.clientKey,
    };
  }

  async getRequestHeadersForConfiguration(
    configuration: TiramisClientConfigurationEntity,
  ): Promise<TiramisRequestHeaders> {
    if (!configuration.clientCode || !configuration.clientKey) {
      throw new BadRequestException(
        'TIRAMIS ClientCode or ClientKey is missing in configuration',
      );
    }

    return {
      'Content-Type': 'application/xml',
      ClientCode: configuration.clientCode,
      ClientKey: configuration.clientKey,
    };
  }

  async getCallbackUrl(params: {
    environment: string;
    callbackPath: string;
  }): Promise<string> {
    const configuration = await this.getActiveConfiguration(params.environment);

    return this.joinUrl(configuration.callbackBaseUrl, params.callbackPath);
  }

  async getResponseCode(
    code: string,
  ): Promise<TiramisResponseCodeEntity | null> {
    return this.responseCodeRepository.findOne({
      where: {
        code,
        isActive: 1,
      },
    });
  }

  async isSuccessResponse(code: string): Promise<boolean> {
    const responseCode = await this.getResponseCode(code);
    return responseCode?.isSuccess === 1;
  }

  async isRetryableResponse(code: string): Promise<boolean> {
    const responseCode = await this.getResponseCode(code);
    return responseCode?.isRetryable === 1;
  }

  async getPfxPaths(environment: string): Promise<{
    clientPrivateCertificatePath?: string | null;
    clientPrivateCertificatePassword?: string | null;
    tiraPublicCertificatePath?: string | null;
    tiraPublicCertificatePassword?: string | null;
    signatureAlgorithm?: string | null;
  }> {
    const configuration = await this.getActiveConfiguration(environment);

    return {
      clientPrivateCertificatePath: resolveTiramisCertificatePath(
        configuration.clientPrivateCertificatePath,
      ),
      clientPrivateCertificatePassword:
        configuration.clientPrivateCertificatePassword,
      tiraPublicCertificatePath: resolveTiramisCertificatePath(
        configuration.tiraPublicCertificatePath,
      ),
      tiraPublicCertificatePassword:
        configuration.tiraPublicCertificatePassword,
      signatureAlgorithm: configuration.signatureAlgorithm,
    };
  }

  async getPfxPathsForConfiguration(
    configuration: TiramisClientConfigurationEntity,
  ): Promise<{
    clientPrivateCertificatePath?: string | null;
    clientPrivateCertificatePassword?: string | null;
    tiraPublicCertificatePath?: string | null;
    tiraPublicCertificatePassword?: string | null;
    signatureAlgorithm?: string | null;
  }> {
    return {
      clientPrivateCertificatePath: resolveTiramisCertificatePath(
        configuration.clientPrivateCertificatePath,
      ),
      clientPrivateCertificatePassword:
        configuration.clientPrivateCertificatePassword,
      tiraPublicCertificatePath: resolveTiramisCertificatePath(
        configuration.tiraPublicCertificatePath,
      ),
      tiraPublicCertificatePassword:
        configuration.tiraPublicCertificatePassword,
      signatureAlgorithm: configuration.signatureAlgorithm,
    };
  }

  private joinUrl(baseUrl: string, path: string): string {
    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    const cleanPath = path.replace(/^\/+/, '');

    return `${cleanBaseUrl}/${cleanPath}`;
  }
}
