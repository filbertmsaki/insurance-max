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

export interface TiramisRequestHeaders {
  'Content-Type': string;
  ClientCode: string;
  ClientKey: string;
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

  async getFullEndpointUrl(params: {
    environment: string;
    serviceType: string;
  }): Promise<string> {
    const configuration = await this.getActiveConfiguration(params.environment);
    const endpoint = await this.getEndpoint(params);

    return this.joinUrl(configuration.baseUrl, endpoint.endpointUrl);
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

  async getCertificatePaths(environment: string): Promise<{
    privateKeyPath?: string | null;
    privateKeyPassword?: string | null;
    publicCertificatePath?: string | null;
    tiraPublicCertificatePath?: string | null;
    signatureAlgorithm?: string | null;
  }> {
    const configuration = await this.getActiveConfiguration(environment);

    return {
      privateKeyPath: configuration.privateKeyPath,
      privateKeyPassword: configuration.privateKeyPassword,
      publicCertificatePath: configuration.publicCertificatePath,
      tiraPublicCertificatePath: configuration.tiraPublicCertificatePath,
      signatureAlgorithm: configuration.signatureAlgorithm,
    };
  }

  private joinUrl(baseUrl: string, path: string): string {
    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    const cleanPath = path.replace(/^\/+/, '');

    return `${cleanBaseUrl}/${cleanPath}`;
  }
}
