import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { join } from 'path';
import { Repository } from 'typeorm';

import type { ServicePrincipal } from '@insurance-max/contracts';
import { RequestContextService } from '@insurance-max/shared-kernel';

import { TiramisClientConfigurationEntity } from '../entities/tiramis-client-configuration.entity';
import { TiramisResponseCodeEntity } from '../entities/tiramis-response-code.entity';
import { TiramisServiceEndpointEntity } from '../entities/tiramis-service-endpoint.entity';
import { resolveTiramisCertificatePath } from '../utils/tiramis-certificate-path.util';
import { TiramisCertificateInspectorService } from '../../security/services/tiramis-certificate-inspector.service';
import { TiramisSecretCryptoService } from '../../security/services/tiramis-secret-crypto.service';
import { TiramisSystemProfileService } from './tiramis-system-profile.service';

/** Per-company secrets stored (encrypted) on the company configuration. */
export const TIRAMIS_SECRET_FIELDS = [
  {
    name: 'portalWebhookApiKey',
    label: 'Portal webhook API key',
    encryptedColumn: 'portalWebhookApiKeyEncrypted',
  },
] as const;

export type TiramisSecretName = (typeof TIRAMIS_SECRET_FIELDS)[number]['name'];

/**
 * Platform-wide TIRA system identity, read from the environment per TIRA
 * environment. Never stored per company.
 */
export const TIRAMIS_SYSTEM_ENV = {
  clientCode: 'TIRA_CLIENT_CODE',
  clientKey: 'TIRA_CLIENT_KEY',
  systemCode: 'TIRA_SYSTEM_CODE',
  systemName: 'TIRA_SYSTEM_NAME',
  clientPrivateCertificatePassword: 'TIRA_CLIENT_CERT_PASSWORD',
  tiraPublicCertificatePassword: 'TIRA_PUBLIC_CERT_PASSWORD',
} as const;

const DEFAULT_SIGNATURE_ALGORITHM = 'sha1WithRSAEncryption';

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

/** Company-specific settings only; the TIRA system identity comes from env. */
export interface UpsertTiramisClientConfigurationParams {
  environment?: string | null;
  companyCode: string;
  insurerCompanyCode: string;
  /** Default sale point, used only when a request carries no branch sale point. */
  salePointCode?: string | null;
  /** Defaults to the insurer company code when omitted. */
  tranCompanyCode?: string | null;
  isActive?: boolean;
}

export interface TiramisSystemIdentity {
  environment: string;
  clientCode: string;
  systemCode: string;
  systemName: string;
  baseUrl: string;
  callbackBaseUrl: string;
}

const DEFAULT_PORTAL_NOTIFICATION_EVENTS = [
  'TIRAMIS_ACK_RECEIVED',
  'TIRAMIS_ACK_FAILED',
  'TIRAMIS_FINAL_RESPONSE_RECEIVED',
  'TIRAMIS_FINAL_SUCCESS',
  'TIRAMIS_FINAL_FAILED',
  'TIRAMIS_FINAL_CALLBACK_OVERDUE',
  'TIRAMIS_RESPONSE_ACK_SENT',
  'TIRAMIS_CALLBACK_REJECTED',
  'TIRAMIS_SUBMISSION_FAILED',
];

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
    private readonly systemProfiles: TiramisSystemProfileService,
  ) {}

  resolveRuntimeEnvironment(appEnv?: string) {
    void appEnv;
    return this.systemProfiles.getActiveEnvironment();
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

    this.assertSystemCode(configuration, tenant?.systemCode);

    return configuration;
  }

  private resolveConfigurationByTenantTriple(
    tenant: ServicePrincipal['tenant'],
  ): Promise<TiramisClientConfigurationEntity> {
    if (!tenant?.companyCode || !tenant.environment) {
      throw new BadRequestException({
        code: 'TIRAMIS_ORGANIZATION_CONTEXT_REQUIRED',
        message:
          'Company code and environment are required for this TIRAMIS operation.',
      });
    }

    return this.getActiveConfiguration({
      environment: tenant.environment,
      companyCode: tenant.companyCode,
      systemCode: tenant.systemCode,
    });
  }

  /**
   * The system code is platform-wide, so it never selects a configuration;
   * a caller that supplies one must match the platform's system code.
   */
  private assertSystemCode(
    configuration: TiramisClientConfigurationEntity,
    systemCode: string | null | undefined,
  ) {
    if (systemCode && systemCode !== configuration.systemCode) {
      throw new ForbiddenException({
        code: 'TIRAMIS_SYSTEM_CODE_MISMATCH',
        message: `System code ${systemCode} does not match this platform's TIRA system code.`,
      });
    }
  }

  /**
   * @param environment Legacy single-environment lookup, kept for internal
   * helper methods (`getCallbackUrl`, etc.) that only need the platform-wide
   * system identity for an environment, not a specific company.
   *
   * Prefer the `{ environment, companyCode }` form for any path that resolves
   * a configuration on behalf of a Portal-originated, company-scoped request —
   * it is unsafe to pick "the first active configuration" on a multi-company
   * platform.
   */
  async getActiveConfiguration(
    environment: string,
  ): Promise<TiramisClientConfigurationEntity>;
  async getActiveConfiguration(params: {
    environment: string;
    companyCode: string;
    systemCode?: string | null;
  }): Promise<TiramisClientConfigurationEntity>;
  async getActiveConfiguration(
    environmentOrParams:
      | string
      | {
          environment: string;
          companyCode: string;
          systemCode?: string | null;
        },
  ): Promise<TiramisClientConfigurationEntity> {
    if (typeof environmentOrParams === 'string') {
      const environment = environmentOrParams;

      const configuration = await this.clientConfigurationRepository.findOne({
        where: {
          environment,
          isActive: 1,
        },
      });

      if (!configuration) {
        throw new NotFoundException(
          `Active TIRAMIS configuration not found for environment: ${environment}`,
        );
      }

      return this.withEnvironmentRuntimeConfiguration(configuration);
    }

    const params = environmentOrParams;

    const stored = await this.clientConfigurationRepository.findOne({
      where: {
        environment: params.environment,
        companyCode: params.companyCode,
        isActive: 1,
      },
    });

    if (!stored) {
      throw new NotFoundException({
        code: 'TIRAMIS_CLIENT_CONFIGURATION_NOT_FOUND',
        message:
          'No active TIRAMIS client configuration matches the supplied company context.',
        details: {
          environment: params.environment,
          companyCode: params.companyCode,
        },
      });
    }

    const configuration = this.withEnvironmentRuntimeConfiguration(stored);
    this.assertSystemCode(configuration, params.systemCode);
    return configuration;
  }

  /**
   * Runtime configuration carrying only the platform system identity for an
   * environment (no company). For work that is not tied to a company, such as
   * verifying a callback whose request is unknown.
   */
  getSystemRuntimeConfiguration(
    environment: string,
  ): TiramisClientConfigurationEntity {
    const env = this.normalizeConfigurationEnvironment(environment);
    return this.withEnvironmentRuntimeConfiguration(
      Object.assign(new TiramisClientConfigurationEntity(), {
        environment: env,
        companyCode: '',
        insurerCompanyCode: '',
        isActive: 1,
      }),
    );
  }

  /** The platform-wide TIRA system identity for an environment. */
  getSystemIdentity(environment: string): TiramisSystemIdentity {
    const env = this.normalizeConfigurationEnvironment(environment);
    return {
      environment: env,
      clientCode: this.systemEnv('clientCode', env) ?? '',
      systemCode: this.systemEnv('systemCode', env) ?? '',
      systemName: this.systemEnv('systemName', env) ?? '',
      baseUrl: this.resolveDefaultBaseUrl(env),
      callbackBaseUrl: this.resolveDefaultCallbackUrl(env),
    };
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
        callbackUrl: this.resolveRequestCallbackUrl(
          configuration,
          incomingDto.callbackUrl ?? incomingDto.callback_url,
        ),

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
    });

    if (!configuration) {
      throw new NotFoundException('TIRAMIS configuration not found');
    }

    return this.withEnvironmentRuntimeConfiguration(configuration);
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
    const environment = this.normalizeConfigurationEnvironment(
      params.environment,
    );
    const endpoint = await this.serviceEndpointRepository.findOne({
      where: {
        environment,
        serviceType: params.serviceType,
        isActive: 1,
      },
    });

    if (!endpoint) {
      throw new NotFoundException(
        `TIRAMIS endpoint not configured for service type: ${params.serviceType} (${environment})`,
      );
    }

    return endpoint;
  }

  async getFullEndpointUrl(params: {
    environment: string;
    serviceType: string;
  }): Promise<string> {
    const endpoint = await this.getEndpoint(params);

    return this.joinUrl(
      this.resolveDefaultBaseUrl(
        this.normalizeConfigurationEnvironment(params.environment),
      ),
      endpoint.endpointUrl,
    );
  }

  async getFullEndpointUrlForConfiguration(params: {
    configuration: TiramisClientConfigurationEntity;
    serviceType: string;
  }): Promise<string> {
    return this.getFullEndpointUrl({
      environment: params.configuration.environment,
      serviceType: params.serviceType,
    });
  }

  async getRequestHeaders(environment: string): Promise<TiramisRequestHeaders> {
    const env = this.normalizeConfigurationEnvironment(environment);
    return this.buildRequestHeaders(
      this.systemEnv('clientCode', env),
      this.systemEnv('clientKey', env),
      env,
    );
  }

  async getRequestHeadersForConfiguration(
    configuration: TiramisClientConfigurationEntity,
  ): Promise<TiramisRequestHeaders> {
    return this.getRequestHeaders(configuration.environment);
  }

  private buildRequestHeaders(
    clientCode: string | null,
    clientKey: string | null,
    environment: 'uat' | 'production',
  ): TiramisRequestHeaders {
    if (!clientCode || !clientKey) {
      throw new BadRequestException(
        `TIRA ClientCode or ClientKey is not configured (set ${TIRAMIS_SYSTEM_ENV.clientCode} and ${TIRAMIS_SYSTEM_ENV.clientKey}).`,
      );
    }

    return {
      'Content-Type': 'application/xml',
      ClientCode: clientCode,
      ClientKey: clientKey,
    };
  }

  async getCallbackUrl(params: {
    environment: string;
    callbackPath: string;
  }): Promise<string> {
    return this.joinUrl(
      this.resolveDefaultCallbackUrl(
        this.normalizeConfigurationEnvironment(params.environment),
      ),
      params.callbackPath,
    );
  }

  private resolveTiraCallbackUrl(
    configuration: TiramisClientConfigurationEntity,
  ): string {
    configuration = this.withEnvironmentRuntimeConfiguration(configuration);
    const configuredUrl = configuration.callbackBaseUrl.trim();

    const legacyEnvironmentPath =
      /\/api\/tiramis\/callbacks\/(uat|test|production|live)\/?$/i;
    if (legacyEnvironmentPath.test(configuredUrl)) {
      return configuredUrl.replace(
        legacyEnvironmentPath,
        '/api/tiramis/callbacks',
      );
    }

    if (/\/api\/tiramis\/callbacks\/?$/i.test(configuredUrl)) {
      return configuredUrl.replace(/\/+$/, '');
    }

    return this.joinUrl(configuredUrl, 'api/tiramis/callbacks');
  }

  getTiraCallbackUrlForConfiguration(
    configuration: TiramisClientConfigurationEntity,
  ): string {
    return this.resolveTiraCallbackUrl(configuration);
  }

  private resolveRequestCallbackUrl(
    configuration: TiramisClientConfigurationEntity,
    requestCallbackUrl: unknown,
  ): string {
    const defaultCallbackUrl = this.resolveTiraCallbackUrl(configuration);
    if (typeof requestCallbackUrl !== 'string') return defaultCallbackUrl;

    const override = requestCallbackUrl.trim();
    if (!override) return defaultCallbackUrl;
    if (/^[a-z][a-z\d+.-]*:\/\//i.test(override)) return override;

    if (/^\/?api\/tiramis\/callbacks(\/|$)/i.test(override)) {
      try {
        const defaultUrl = new URL(defaultCallbackUrl);
        return this.joinUrl(defaultUrl.origin, override);
      } catch {
        return this.joinUrl(defaultCallbackUrl, override);
      }
    }

    return this.joinUrl(defaultCallbackUrl, override);
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
    configuration = this.withEnvironmentRuntimeConfiguration(configuration);

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
    configuration = this.withEnvironmentRuntimeConfiguration(configuration);

    const errors: string[] = [];
    const warnings: string[] = [];
    // Certificates are platform-wide, so expiry tolerance is a system setting
    // (TIRA_ALLOW_EXPIRED_CERTIFICATES); an explicit per-call flag overrides it.
    const allowExpiredCertificates =
      options?.allowExpiredCertificates ??
      this.systemProfiles.getEffective(
        this.normalizeConfigurationEnvironment(configuration.environment),
      ).allowExpiredCertificates;

    for (const [field, label] of [
      ['clientCode', 'ClientCode'],
      ['clientKey', 'ClientKey'],
      ['systemCode', 'SystemCode'],
    ] as const) {
      if (!configuration[field]) {
        errors.push(
          `${label} is not configured (set ${TIRAMIS_SYSTEM_ENV[field]})`,
        );
      }
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
          const message = `Client private certificate expired on ${clientCertificate.validTo}`;
          if (allowExpiredCertificates) {
            warnings.push(
              `${message}, but expiry validation was explicitly allowed.`,
            );
          } else {
            errors.push(
              `Client private certificate has expired on ${clientCertificate.validTo}`,
            );
          }
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
      allowExpiredCertificates,
      environment: configuration.environment,
      configurationId: configuration.id,
      companyCode: configuration.companyCode,
      systemCode: configuration.systemCode,
      systemName: configuration.systemName,
      clientCode: configuration.clientCode,
      clientKeyMasked: this.maskPlain(configuration.clientKey),
      certificates: {
        clientPrivate: clientCertificate,
        tiraPublic: tiraCertificate,
      },
      warnings,
      errors,
    };
  }

  /**
   * Creates or updates a company's TIRAMIS configuration. Only company
   * settings are stored; the TIRA system identity is platform-wide (env).
   */
  async upsertClientConfiguration(
    params: UpsertTiramisClientConfigurationParams,
  ): Promise<TiramisClientConfigurationEntity> {
    const environment = this.normalizeConfigurationEnvironment(
      params.environment ?? this.systemProfiles.getActiveEnvironment(),
    );
    let configuration = await this.clientConfigurationRepository.findOne({
      where: { environment, companyCode: params.companyCode },
    });

    if (!configuration) {
      configuration = this.clientConfigurationRepository.create({
        environment,
        companyCode: params.companyCode,
      });
    }

    configuration.insurerCompanyCode = params.insurerCompanyCode;
    configuration.salePointCode = params.salePointCode?.trim() || null;
    configuration.tranCompanyCode = params.tranCompanyCode?.trim() || null;
    configuration.isActive = params.isActive === false ? 0 : 1;

    const saved = await this.clientConfigurationRepository.save(configuration);
    return this.withEnvironmentRuntimeConfiguration(saved);
  }

  private resolveDefaultBaseUrl(environment: string): string {
    const configured = this.systemProfiles.getEffective(
      this.normalizeConfigurationEnvironment(environment),
    ).baseUrl;

    if (!configured) {
      throw new BadRequestException({
        code: 'TIRAMIS_BASE_URL_REQUIRED',
        message: `No TIRA base URL is configured for the ${environment} environment (set it under Platform -> TIRAMIS Integration, or TIRAMIS_BASE_URL).`,
      });
    }

    return configured;
  }

  /**
   * callbackBaseUrl is embedded in outbound requests to TIRA, telling it
   * where to POST its async callback — TIRAMIS's own public base URL, not the
   * portal's webhook. Platform profile, then environment, then APP_URL.
   */
  private resolveDefaultCallbackUrl(environment: string): string {
    const configured =
      this.systemProfiles.getEffective(
        this.normalizeConfigurationEnvironment(environment),
      ).callbackUrl || this.configService.get<string>('tiramisService.url');

    if (!configured) {
      throw new BadRequestException({
        code: 'TIRAMIS_CALLBACK_URL_REQUIRED',
        message: `No TIRA callback URL is configured for the ${environment} environment (set it under Platform -> TIRAMIS Integration, or TIRAMIS_CALLBACK_URL / APP_URL).`,
      });
    }

    return configured;
  }

  private withEnvironmentRuntimeConfiguration(
    configuration: TiramisClientConfigurationEntity,
  ): TiramisClientConfigurationEntity {
    const environment = this.normalizeConfigurationEnvironment(
      configuration.environment,
    );
    const runtimeConfiguration = Object.assign(
      Object.create(Object.getPrototypeOf(configuration)),
      configuration,
    ) as TiramisClientConfigurationEntity;

    const profile = this.systemProfiles.getEffective(
      this.normalizeConfigurationEnvironment(environment),
    );
    runtimeConfiguration.systemCode = profile.systemCode ?? '';
    runtimeConfiguration.systemName = profile.systemName ?? '';
    runtimeConfiguration.clientCode = profile.clientCode ?? '';
    runtimeConfiguration.clientKey = profile.clientKey ?? '';
    runtimeConfiguration.baseUrl = this.resolveDefaultBaseUrl(environment);
    runtimeConfiguration.callbackBaseUrl =
      this.resolveDefaultCallbackUrl(environment);
    runtimeConfiguration.clientPrivateCertificatePath =
      profile.clientCertificatePath;
    runtimeConfiguration.clientPrivateCertificatePassword =
      profile.clientCertificatePassword;
    runtimeConfiguration.tiraPublicCertificatePath =
      profile.publicCertificatePath;
    runtimeConfiguration.tiraPublicCertificatePassword =
      profile.publicCertificatePassword;
    runtimeConfiguration.signatureAlgorithm = profile.signatureAlgorithm;

    return runtimeConfiguration;
  }

  private systemEnv(
    field: keyof typeof TIRAMIS_SYSTEM_ENV,
    environment: string,
  ): string | null {
    const profile = this.systemProfiles.getEffective(
      this.normalizeConfigurationEnvironment(environment),
    );
    const values: Record<keyof typeof TIRAMIS_SYSTEM_ENV, string | null> = {
      clientCode: profile.clientCode,
      clientKey: profile.clientKey,
      systemCode: profile.systemCode,
      systemName: profile.systemName,
      clientPrivateCertificatePassword: profile.clientCertificatePassword,
      tiraPublicCertificatePassword: profile.publicCertificatePassword,
    };
    return values[field];
  }

  private maskPlain(value: string | null | undefined): string | null {
    if (!value) return null;
    return value.length <= 4 ? '****' : `****${value.slice(-4)}`;
  }

  private normalizeConfigurationEnvironment(
    environment: string,
  ): 'uat' | 'production' {
    try {
      return this.systemProfiles.normalizeEnvironment(environment);
    } catch {
      throw new BadRequestException({
        code: 'TIRAMIS_ENVIRONMENT_INVALID',
        message: `Unsupported TIRAMIS environment: ${environment}`,
      });
    }
  }

  private getCertificateBaseDir(): string {
    return (
      this.configService.get<string>('TIRAMIS_CERTIFICATE_BASE_DIR')?.trim() ||
      '/opt/apps/tiramis/certificates'
    );
  }

  /** Validated config can hold booleans/numbers (Joi converts them). */
  private envValue(name: string): string | null {
    const value = this.configService.get<unknown>(name);
    if (value === undefined || value === null) return null;
    return String(value).trim() || null;
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

  async setPortalNotificationPolicy(
    configurationId: string,
    policy: { enabled?: boolean; eventTypes?: string[] },
  ) {
    const configuration = await this.clientConfigurationRepository.findOne({
      where: { id: configurationId },
    });
    if (!configuration)
      throw new NotFoundException('TIRAMIS client configuration was not found');
    configuration.portalNotificationEvents =
      policy.enabled === false
        ? []
        : (policy.eventTypes ?? DEFAULT_PORTAL_NOTIFICATION_EVENTS);
    const saved = await this.clientConfigurationRepository.save(configuration);
    return {
      configurationId: saved.id,
      enabled: configuration.portalNotificationEvents.length > 0,
      eventTypes: configuration.portalNotificationEvents,
      updatedAt: saved.updatedAt,
    };
  }

  /**
   * Reports, per stored secret, whether this process can still read it with
   * TIRAMIS_SECRET_ENCRYPTION_KEY (or a _PREVIOUS key). Never throws on an
   * unreadable value — that is exactly what it reports.
   */
  async getSecretHealth(configurationId: string) {
    const configuration = await this.getConfigurationById(configurationId);

    return this.buildSecretHealth(configuration);
  }

  /**
   * Brings every secret onto the current encryption key:
   * - a supplied plaintext value replaces the stored one;
   * - otherwise a readable value (legacy plaintext, previous key) is
   *   re-encrypted with the current key;
   * - an unreadable value with no replacement is left untouched and
   *   reported, so nothing that still works is ever lost.
   */
  async repairSecrets(
    configurationId: string,
    replacements: Partial<Record<TiramisSecretName, string | null>>,
  ) {
    const configuration = await this.clientConfigurationRepository.findOne({
      where: { id: configurationId },
    });

    if (!configuration) {
      throw new NotFoundException('TIRAMIS client configuration was not found');
    }

    for (const secret of TIRAMIS_SECRET_FIELDS) {
      const replacement = replacements[secret.name]?.trim();
      const current = this.readSecretValue(configuration, secret);
      const encrypted = replacement
        ? this.secretCrypto.encrypt(replacement)
        : this.secretCrypto.reEncrypt(current);

      if (!encrypted) {
        continue;
      }

      (configuration as any)[secret.encryptedColumn] = encrypted;
    }

    const saved = await this.clientConfigurationRepository.save(configuration);

    return this.buildSecretHealth(
      this.withEnvironmentRuntimeConfiguration(saved),
    );
  }

  private buildSecretHealth(configuration: TiramisClientConfigurationEntity) {
    const secrets = TIRAMIS_SECRET_FIELDS.map((secret) => ({
      name: secret.name,
      label: secret.label,
      status: this.secretCrypto.inspect(
        this.readSecretValue(configuration, secret),
      ),
    }));
    const systemSecrets = (
      [
        ['clientKey', 'TIRA client key'],
        [
          'clientPrivateCertificatePassword',
          'Client private certificate password',
        ],
        ['tiraPublicCertificatePassword', 'TIRA public certificate password'],
      ] as const
    ).map(([field, label]) => ({
      name: field,
      label,
      source: TIRAMIS_SYSTEM_ENV[field],
      status: configuration[field] ? 'OK' : 'MISSING',
    }));

    return {
      configurationId: configuration.id,
      environment: configuration.environment,
      companyCode: configuration.companyCode,
      systemCode: configuration.systemCode,
      healthy: [...secrets, ...systemSecrets].every(
        (secret) => secret.status === 'OK',
      ),
      secrets,
      systemSecrets,
    };
  }

  private readSecretValue(
    configuration: TiramisClientConfigurationEntity,
    secret: (typeof TIRAMIS_SECRET_FIELDS)[number],
  ): string | null {
    return (
      ((configuration as any)[secret.encryptedColumn] as string | null) ?? null
    );
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

  private getClientPrivateCertificatePassword(
    configuration: TiramisClientConfigurationEntity,
  ): string | null {
    return configuration.clientPrivateCertificatePassword || null;
  }

  private getTiraPublicCertificatePassword(
    configuration: TiramisClientConfigurationEntity,
  ): string | null {
    return configuration.tiraPublicCertificatePassword || null;
  }

  private joinUrl(baseUrl: string, path: string): string {
    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    const cleanPath = path.replace(/^\/+/, '');

    return `${cleanBaseUrl}/${cleanPath}`;
  }
}
