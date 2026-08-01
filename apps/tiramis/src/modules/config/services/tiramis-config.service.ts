import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TiramisClientConfigurationEntity } from '../entities/tiramis-client-configuration.entity';
import { TiramisResponseCodeEntity } from '../entities/tiramis-response-code.entity';
import { TiramisServiceEndpointEntity } from '../entities/tiramis-service-endpoint.entity';
import { resolveTiramisCertificatePath } from '../utils/tiramis-certificate-path.util';
import { TiramisCertificateInspectorService } from '../../security/services/tiramis-certificate-inspector.service';
import { TiramisSecretCryptoService } from '../../security/services/tiramis-secret-crypto.service';

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

  /**
   * Technical TIRA identifiers controlled by the IDP platform.
   * These are injected from the active TIRAMIS configuration.
   */
  companyCode: string;
  systemCode: string;
  callbackUrl: string;

  /**
   * Business identifiers.
   * These should come from the portal/client request.
   * Legacy fallback from config is still supported temporarily.
   */
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
    private readonly secretCrypto: TiramisSecretCryptoService,
    private readonly certificateInspector: TiramisCertificateInspectorService,
    private readonly configService: ConfigService,
  ) {}

  resolveRuntimeEnvironment(appEnv?: string) {
    const configuredTarget =
      this.configService.get<string>('TIRAMIS_TARGET_ENV');

    if (configuredTarget === 'test' || configuredTarget === 'live') {
      return configuredTarget;
    }

    const environment =
      appEnv ??
      this.configService.get<string>('app.env') ??
      this.configService.get<string>('APP_ENV') ??
      'development';
    return environment === 'production' ? 'live' : 'test';
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
    const incomingDto = dto as Record<string, any>;

    const insurerCompanyCode = this.resolveBusinessCode({
      incomingValue: incomingDto.insurerCompanyCode,
      fallbackValue: configuration.insurerCompanyCode,
      fieldName: 'insurerCompanyCode',
      required: true,
    });

    const tranCompanyCode = this.resolveBusinessCode({
      incomingValue: incomingDto.tranCompanyCode,
      fallbackValue: configuration.tranCompanyCode || insurerCompanyCode,
      fieldName: 'tranCompanyCode',
      required: true,
    });

    return {
      configuration,
      dto: {
        ...dto,
        /**
         * IDP/platform technical configuration.
         * These values are controlled by tiramis-service.
         */
        environment: configuration.environment,
        clientConfigurationId: configuration.id,
        sourceRecordId,
        companyCode: configuration.companyCode,
        systemCode: configuration.systemCode,
        callbackUrl: configuration.callbackBaseUrl,

        /**
         * Client/company business identifiers.
         * Portal request value has priority.
         * Config fallback is temporary for backward compatibility.
         */
        insurerCompanyCode,
        tranCompanyCode,
      },
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

  async getRuntimeConfigurationById(
    clientConfigurationId: string,
  ): Promise<TiramisClientConfigurationEntity> {
    return this.getConfigurationById(clientConfigurationId);
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
    const clientKey = this.getClientKey(configuration);

    if (!configuration.clientCode || !clientKey) {
      throw new BadRequestException(
        'TIRAMIS ClientCode or ClientKey is missing in configuration',
      );
    }

    return {
      'Content-Type': 'application/xml',
      ClientCode: configuration.clientCode,
      ClientKey: clientKey,
    };
  }

  async getRequestHeadersForConfiguration(
    configuration: TiramisClientConfigurationEntity,
  ): Promise<TiramisRequestHeaders> {
    const clientKey = this.getClientKey(configuration);

    if (!configuration.clientCode || !clientKey) {
      throw new BadRequestException(
        'TIRAMIS ClientCode or ClientKey is missing in configuration',
      );
    }

    return {
      'Content-Type': 'application/xml',
      ClientCode: configuration.clientCode,
      ClientKey: clientKey,
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

    return this.getPfxPathsForConfiguration(configuration);
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
        this.getClientPrivateCertificatePassword(configuration),
      tiraPublicCertificatePath: resolveTiramisCertificatePath(
        configuration.tiraPublicCertificatePath,
      ),
      tiraPublicCertificatePassword:
        this.getTiraPublicCertificatePassword(configuration),
      signatureAlgorithm: configuration.signatureAlgorithm,
    };
  }

  async validateConfigurationSecurity(
    configuration: TiramisClientConfigurationEntity,
  ) {
    const errors: string[] = [];
    const warnings: string[] = [];

    const clientKey = this.getClientKey(configuration);

    if (!clientKey) {
      errors.push('ClientKey is missing');
    }

    if (!configuration.clientKeyEncrypted) {
      warnings.push('ClientKey is still stored in plaintext column');
    }

    if (
      configuration.clientPrivateCertificatePassword &&
      !configuration.clientPrivateCertificatePasswordEncrypted
    ) {
      warnings.push(
        'Client private certificate password is still stored in plaintext column',
      );
    }

    if (
      configuration.tiraPublicCertificatePassword &&
      !configuration.tiraPublicCertificatePasswordEncrypted
    ) {
      warnings.push(
        'TIRA public certificate password is still stored in plaintext column',
      );
    }

    if (!configuration.clientPrivateCertificatePath) {
      errors.push('Client private certificate path is missing');
    }

    if (!configuration.tiraPublicCertificatePath) {
      errors.push('TIRA public certificate path is missing');
    }

    let clientCertificate: any = null;
    let tiraCertificate: any = null;

    if (configuration.clientPrivateCertificatePath) {
      try {
        clientCertificate = this.certificateInspector.assertCertificateHealthy({
          label: 'Client private',
          certificatePath: configuration.clientPrivateCertificatePath,
          password: this.getClientPrivateCertificatePassword(configuration),
        });

        if (clientCertificate.isExpiringSoon) {
          warnings.push(
            `Client private certificate is expiring soon: ${clientCertificate.validTo}`,
          );
        }
      } catch (error: any) {
        errors.push(error?.message || 'Client private certificate is invalid');
      }
    }

    if (configuration.tiraPublicCertificatePath) {
      try {
        tiraCertificate = this.certificateInspector.assertCertificateHealthy({
          label: 'TIRA public',
          certificatePath: configuration.tiraPublicCertificatePath,
          password: this.getTiraPublicCertificatePassword(configuration),
        });

        if (tiraCertificate.isExpiringSoon) {
          warnings.push(
            `TIRA public certificate is expiring soon: ${tiraCertificate.validTo}`,
          );
        }
      } catch (error: any) {
        errors.push(error?.message || 'TIRA public certificate is invalid');
      }
    }

    return {
      ok: errors.length === 0,
      environment: configuration.environment,
      configurationId: configuration.id,
      companyCode: configuration.companyCode,
      systemCode: configuration.systemCode,
      clientCode: configuration.clientCode,
      clientKeyMasked: this.secretCrypto.mask(
        configuration.clientKeyEncrypted || configuration.clientKey,
      ),
      certificates: {
        clientPrivate: clientCertificate,
        tiraPublic: tiraCertificate,
      },
      warnings,
      errors,
    };
  }

  async encryptExistingPlaintextSecrets(configurationId: string) {
    const configuration = await this.getConfigurationById(configurationId);

    if (configuration.clientKey && !configuration.clientKeyEncrypted) {
      configuration.clientKeyEncrypted = this.secretCrypto.encrypt(
        configuration.clientKey,
      );
    }

    if (
      configuration.clientPrivateCertificatePassword &&
      !configuration.clientPrivateCertificatePasswordEncrypted
    ) {
      configuration.clientPrivateCertificatePasswordEncrypted =
        this.secretCrypto.encrypt(
          configuration.clientPrivateCertificatePassword,
        );
    }

    if (
      configuration.tiraPublicCertificatePassword &&
      !configuration.tiraPublicCertificatePasswordEncrypted
    ) {
      configuration.tiraPublicCertificatePasswordEncrypted =
        this.secretCrypto.encrypt(configuration.tiraPublicCertificatePassword);
    }

    await this.clientConfigurationRepository.save(configuration);

    return {
      id: configuration.id,
      environment: configuration.environment,
      encrypted: true,
      clientKeyMasked: this.secretCrypto.mask(configuration.clientKeyEncrypted),
    };
  }

  private resolveBusinessCode(params: {
    incomingValue: unknown;
    fallbackValue?: string | null;
    fieldName: string;
    required?: boolean;
  }): string {
    const incoming =
      params.incomingValue !== undefined && params.incomingValue !== null
        ? String(params.incomingValue).trim()
        : '';

    const fallback = params.fallbackValue ? params.fallbackValue.trim() : '';

    const value = incoming || fallback;

    if (params.required && !value) {
      throw new BadRequestException(
        `Missing required TIRA business identifier: ${params.fieldName}`,
      );
    }

    return value;
  }

  private getClientKey(
    configuration: TiramisClientConfigurationEntity,
  ): string | null {
    return (
      this.secretCrypto.decryptIfEncrypted(
        configuration.clientKeyEncrypted || configuration.clientKey || null,
      ) || null
    );
  }

  private getClientPrivateCertificatePassword(
    configuration: TiramisClientConfigurationEntity,
  ): string | null {
    return (
      this.secretCrypto.decryptIfEncrypted(
        configuration.clientPrivateCertificatePasswordEncrypted ||
          configuration.clientPrivateCertificatePassword ||
          null,
      ) || null
    );
  }

  private getTiraPublicCertificatePassword(
    configuration: TiramisClientConfigurationEntity,
  ): string | null {
    return (
      this.secretCrypto.decryptIfEncrypted(
        configuration.tiraPublicCertificatePasswordEncrypted ||
          configuration.tiraPublicCertificatePassword ||
          null,
      ) || null
    );
  }

  private joinUrl(baseUrl: string, path: string): string {
    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    const cleanPath = path.replace(/^\/+/, '');

    return `${cleanBaseUrl}/${cleanPath}`;
  }
}
