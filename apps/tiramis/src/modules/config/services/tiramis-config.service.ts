import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { ServicePrincipal } from '@insurance-max/contracts';
import { RequestContextService } from '@insurance-max/shared-kernel';

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

export interface UpsertTiramisClientConfigurationParams {
  environment: 'test' | 'live';
  companyCode: string;
  systemCode: string;
  insurerCompanyCode: string;
  clientCode: string;
  /** The TIRA-issued client secret. Optional on update — omitted keeps the
   * existing encrypted value; required when creating a new configuration. */
  clientKey?: string;
  salePointCode?: string | null;
  tranCompanyCode?: string | null;
  /** Defaults to the platform's TIRAMIS_TEST_BASE_URL/TIRAMIS_LIVE_BASE_URL
   * for this environment when omitted — every company in an environment
   * talks to the same TIRA gateway, so this only needs overriding if a
   * company genuinely has a distinct endpoint. */
  baseUrl?: string;
  /** Defaults to TIRAMIS_TEST_CALLBACK_URL/TIRAMIS_LIVE_CALLBACK_URL (falling
   * back to INSURANCE_PORTAL_WEBHOOK_URL) when omitted. */
  callbackBaseUrl?: string;
  signatureAlgorithm?: string | null;
  isActive?: boolean;
}

@Injectable()
export class TiramisConfigService {
  /**
   * Caches the resolved ClientConfiguration per request (keyed by the
   * request's ServicePrincipal instance, which the API key guard creates
   * fresh per request). Avoids re-querying the same configuration row every
   * time getActiveRuntimeConfiguration/resolveSubmissionContext is called
   * during a single request's lifecycle.
   */
  private readonly configurationCache = new WeakMap<
    ServicePrincipal,
    Promise<TiramisClientConfigurationEntity>
  >();

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
    private readonly requestContextService: RequestContextService,
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

  /**
   * Resolves the active TIRAMIS configuration from caller-supplied
   * organization business context. API key authentication establishes trust in
   * the calling service; company/system codes are routing data.
   */
  async getActiveRuntimeConfiguration(): Promise<TiramisClientConfigurationEntity> {
    const principal = this.requestContextService.getServicePrincipal();
    return this.resolveConfigurationForPrincipal(principal);
  }

  /**
   * Resolves the ClientConfiguration bound to the current request's
   * authenticated tenant context, reusing a per-request cache so multiple
   * calls within the same request (e.g. resolveSubmissionContext followed
   * by getActiveRuntimeConfiguration) don't issue duplicate queries.
   */
  private resolveConfigurationForPrincipal(
    principal: ServicePrincipal | undefined,
  ): Promise<TiramisClientConfigurationEntity> {
    if (!principal) {
      throw new BadRequestException({
        code: 'TIRAMIS_ORGANIZATION_CONTEXT_REQUIRED',
        message:
          'Company code, system code, and environment are required for this TIRAMIS operation.',
      });
    }

    const cached = this.configurationCache.get(principal);
    if (cached) {
      return cached;
    }

    const tenant = principal.tenant;
    const resolution = tenant?.clientConfigurationId
      ? this.resolveConfigurationByIdForTenant(
          tenant.clientConfigurationId,
          tenant,
        )
      : this.resolveConfigurationByTenantTriple(tenant);

    this.configurationCache.set(principal, resolution);
    return resolution;
  }

  /**
   * Resolves configuration by the FK the API key is bound to, then
   * cross-checks it against the key's own free-text tenant fields (where
   * present). A test API key must never resolve a live configuration, and
   * vice versa — this guards against a stale/incorrect
   * clientConfigurationId (e.g. a bad manual edit or backfill) silently
   * pointing an authenticated key at the wrong environment or company.
   */
  private async resolveConfigurationByIdForTenant(
    clientConfigurationId: string,
    tenant: ServicePrincipal['tenant'],
  ): Promise<TiramisClientConfigurationEntity> {
    const configuration = await this.getConfigurationById(
      clientConfigurationId,
    );

    if (!configuration.isActive) {
      throw new NotFoundException({
        code: 'TIRAMIS_CLIENT_CONFIGURATION_NOT_FOUND',
        message:
          'The TIRAMIS client configuration for this API key is inactive.',
      });
    }

    if (
      tenant?.environment &&
      configuration.environment !== tenant.environment
    ) {
      throw new ForbiddenException({
        code: 'TIRAMIS_ENVIRONMENT_MISMATCH',
        message:
          'The API key environment does not match its configured TIRAMIS environment.',
      });
    }

    if (
      tenant?.companyCode &&
      configuration.companyCode !== tenant.companyCode
    ) {
      throw new ForbiddenException({
        code: 'TIRAMIS_ENVIRONMENT_MISMATCH',
        message:
          'The API key company code does not match its configured TIRAMIS configuration.',
      });
    }

    if (tenant?.systemCode && configuration.systemCode !== tenant.systemCode) {
      throw new ForbiddenException({
        code: 'TIRAMIS_ENVIRONMENT_MISMATCH',
        message:
          'The API key system code does not match its configured TIRAMIS configuration.',
      });
    }

    return configuration;
  }

  private resolveConfigurationByTenantTriple(
    tenant: ServicePrincipal['tenant'],
  ): Promise<TiramisClientConfigurationEntity> {
    if (!tenant?.companyCode || !tenant.systemCode || !tenant.environment) {
      throw new BadRequestException({
        code: 'TIRAMIS_ORGANIZATION_CONTEXT_REQUIRED',
        message:
          'Company code, system code, and environment are required for this TIRAMIS operation.',
      });
    }

    return this.getActiveConfiguration({
      environment: tenant.environment,
      companyCode: tenant.companyCode,
      systemCode: tenant.systemCode,
    });
  }

  /**
   * @param environment Legacy single-environment lookup, kept for internal
   * helper methods (`getEndpoint`, `getCallbackUrl`, etc.) that already
   * operate on a previously-resolved configuration's environment and don't
   * need company/system scoping.
   *
   * Prefer the `{ environment, companyCode, systemCode }` form for any path
   * that resolves a configuration on behalf of a Portal-originated,
   * company-scoped request — it is unsafe to pick "the first active
   * configuration" on a multi-company platform.
   */
  async getActiveConfiguration(
    environment: string,
  ): Promise<TiramisClientConfigurationEntity>;
  async getActiveConfiguration(params: {
    environment: string;
    companyCode: string;
    systemCode: string;
  }): Promise<TiramisClientConfigurationEntity>;
  async getActiveConfiguration(
    environmentOrParams:
      | string
      | { environment: string; companyCode: string; systemCode: string },
  ): Promise<TiramisClientConfigurationEntity> {
    if (typeof environmentOrParams === 'string') {
      const environment = environmentOrParams;

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

    const params = environmentOrParams;

    const configuration = await this.clientConfigurationRepository.findOne({
      where: {
        environment: params.environment,
        companyCode: params.companyCode,
        systemCode: params.systemCode,
        isActive: 1,
      },
      relations: {
        endpoints: true,
      },
    });

    if (!configuration) {
      throw new NotFoundException({
        code: 'TIRAMIS_CLIENT_CONFIGURATION_NOT_FOUND',
        message:
          'No active TIRAMIS client configuration matches the supplied company and system context.',
        details: {
          environment: params.environment,
          companyCode: params.companyCode,
          systemCode: params.systemCode,
        },
      });
    }

    return configuration;
  }

  async resolveSubmissionContext<TDto>(
    dto: TDto,
    sourceRecordId: string,
  ): Promise<TiramisResolvedRequestContext<TDto>> {
    const principal = this.requestContextService.getServicePrincipal();
    const tenant = principal?.tenant;
    const incomingDto = dto as Record<string, any>;

    /**
     * companyCode/systemCode/environment are authenticated routing data
     * resolved from the API-key-bound tenant context via
     * resolveConfigurationForPrincipal — they must never be accepted from
     * the caller's DTO, as that would let one authenticated client resolve
     * another client's configuration.
     */
    const organizationContext = {
      insurerCompanyCode:
        incomingDto.insurerCompanyCode ?? tenant?.insurerCompanyCode,
      salePointCode: incomingDto.salePointCode ?? tenant?.salePointCode,
    };

    const configuration =
      await this.resolveConfigurationForPrincipal(principal);

    const insurerCompanyCode =
      organizationContext.insurerCompanyCode ??
      this.resolveBusinessCode({
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

    const salePointCode = this.resolveBusinessCode({
      incomingValue: organizationContext.salePointCode,
      fallbackValue: configuration.salePointCode,
      fieldName: 'salePointCode',
      required: false,
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
        callbackUrl: this.resolveTiraCallbackUrl(configuration),

        /**
         * Client/company business identifiers. The API-key-authenticated
         * tenant context (set by the Portal from the resolved
         * OrganizationContextService result) takes priority over anything
         * the caller passes in the DTO — TIRAMIS must never trust a
         * Portal-originated submission's self-reported business codes over
         * its own authenticated context, and must never fall back to a globally
         * configured default sales point/company code for such requests.
         */
        insurerCompanyCode,
        tranCompanyCode,
        ...(salePointCode ? { salePointCode } : {}),
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

  private resolveTiraCallbackUrl(
    configuration: TiramisClientConfigurationEntity,
  ): string {
    const configuredUrl = configuration.callbackBaseUrl.trim();

    if (/\/api\/tiramis\/callbacks\/(test|live)\/?$/i.test(configuredUrl)) {
      return configuredUrl;
    }

    return this.joinUrl(
      configuredUrl,
      `api/tiramis/callbacks/${configuration.environment.toLowerCase()}`,
    );
  }

  getTiraCallbackUrlForConfiguration(
    configuration: TiramisClientConfigurationEntity,
  ): string {
    return this.resolveTiraCallbackUrl(configuration);
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
    options?: { allowExpiredCertificates?: boolean },
  ) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const allowExpiredCertificates = options?.allowExpiredCertificates ?? false;

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

        if (clientCertificate.isExpired) {
          errors.push(
            `Client private certificate has expired on ${clientCertificate.validTo}`,
          );
        } else if (clientCertificate.isExpiringSoon) {
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

        if (tiraCertificate.isExpired) {
          const message = `TIRA public certificate expired on ${tiraCertificate.validTo}`;
          if (allowExpiredCertificates) {
            warnings.push(
              `${message}, but expiry validation was explicitly allowed.`,
            );
          } else {
            errors.push(
              `TIRA public certificate has expired on ${tiraCertificate.validTo}`,
            );
          }
        } else if (tiraCertificate.isExpiringSoon) {
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

  /**
   * Creates or updates the ClientConfiguration a company/environment's
   * TIRA-issued credentials live in. This is the one piece of data that
   * genuinely can't be self-generated by the platform — companyCode/
   * systemCode/clientCode/clientKey are issued by TIRA itself — so a
   * platform admin enters them once here, after which API key minting,
   * validation, and activation all work without any further seeder/DB work.
   */
  async upsertClientConfiguration(
    params: UpsertTiramisClientConfigurationParams,
  ): Promise<TiramisClientConfigurationEntity> {
    let configuration = await this.clientConfigurationRepository.findOne({
      where: {
        environment: params.environment,
        companyCode: params.companyCode,
        systemCode: params.systemCode,
      },
    });

    if (!configuration && !params.clientKey) {
      throw new BadRequestException({
        code: 'TIRAMIS_CLIENT_KEY_REQUIRED',
        message:
          'clientKey is required when creating a new TIRAMIS client configuration.',
      });
    }

    if (!configuration) {
      configuration = this.clientConfigurationRepository.create({
        environment: params.environment,
        companyCode: params.companyCode,
        systemCode: params.systemCode,
      });
    }

    configuration.insurerCompanyCode = params.insurerCompanyCode;
    configuration.clientCode = params.clientCode;
    configuration.salePointCode = params.salePointCode ?? null;
    configuration.tranCompanyCode = params.tranCompanyCode ?? null;
    configuration.baseUrl =
      params.baseUrl?.trim() || this.resolveDefaultBaseUrl(params.environment);
    configuration.callbackBaseUrl =
      params.callbackBaseUrl?.trim() ||
      this.resolveDefaultCallbackUrl(params.environment);
    if (params.signatureAlgorithm !== undefined) {
      configuration.signatureAlgorithm = params.signatureAlgorithm;
    }
    configuration.isActive = params.isActive === false ? 0 : 1;

    if (params.clientKey) {
      // The clientKey column is NOT NULL for legacy compatibility, but the
      // real secret only ever lives in the encrypted column — never store
      // the TIRA-issued secret in plaintext here.
      configuration.clientKey = '(encrypted)';
      configuration.clientKeyEncrypted = this.secretCrypto.encrypt(
        params.clientKey,
      );
    }

    return this.clientConfigurationRepository.save(configuration);
  }

  private resolveDefaultBaseUrl(environment: 'test' | 'live'): string {
    const configured =
      environment === 'live'
        ? this.configService.get<string>('tiramisService.liveBaseUrl')
        : this.configService.get<string>('tiramisService.testBaseUrl');

    if (!configured) {
      throw new BadRequestException({
        code: 'TIRAMIS_BASE_URL_REQUIRED',
        message: `No baseUrl was provided and no platform default is configured for the ${environment} environment (set TIRAMIS_${environment.toUpperCase()}_BASE_URL).`,
      });
    }

    return configured;
  }

  /**
   * callbackBaseUrl is embedded in outbound requests to TIRA, telling it
   * where to POST its async callback — TIRAMIS's own public base URL
   * (this service's TiramisCallbackController), not the portal's webhook.
   * Defaults to TIRAMIS_{TEST,LIVE}_CALLBACK_URL if set, else this
   * service's own APP_URL (the same host serving this request).
   */
  private resolveDefaultCallbackUrl(environment: 'test' | 'live'): string {
    const configured =
      (environment === 'live'
        ? this.configService.get<string>('tiramisService.liveCallbackUrl')
        : this.configService.get<string>('tiramisService.testCallbackUrl')) ||
      this.configService.get<string>('tiramisService.url');

    if (!configured) {
      throw new BadRequestException({
        code: 'TIRAMIS_CALLBACK_URL_REQUIRED',
        message: `No callbackBaseUrl was provided and no platform default is configured for the ${environment} environment (set TIRAMIS_${environment.toUpperCase()}_CALLBACK_URL or APP_URL).`,
      });
    }

    return configured;
  }

  async setPortalWebhookApiKey(configurationId: string, apiKey: string) {
    const configuration = await this.clientConfigurationRepository.findOne({
      where: { id: configurationId },
    });

    if (!configuration) {
      throw new NotFoundException('TIRAMIS client configuration was not found');
    }

    configuration.portalWebhookApiKeyEncrypted =
      this.secretCrypto.encrypt(apiKey);

    const saved = await this.clientConfigurationRepository.save(configuration);

    return {
      configurationId: saved.id,
      portalWebhookApiKeyMasked: this.secretCrypto.mask(
        saved.portalWebhookApiKeyEncrypted,
      ),
      updatedAt: saved.updatedAt,
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
