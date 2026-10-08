import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';

import { AuditService } from '../../shared/audit/audit.service';
import { Company } from '../../platform/companies/entities/company.entity';
import { TiramisCompanyConfigurationEntity } from '../entities/tiramis-company-configuration.entity';
import {
  TiramisClientService,
  type TiramisSecretName,
} from './tiramis-client.service';
import { TiramisServiceApiKeyVaultService } from './tiramis-service-api-key-vault.service';
import { TiramisWebhookCredentialService } from './tiramis-webhook-credential.service';
import { UpsertCompanyTiramisConfigurationDto } from '../dto/upsert-company-tiramis-configuration.dto';
import { resolveTiramisPortalWebhookUrl } from '../utils/tiramis-portal-webhook-url.util';

@Injectable()
export class CompanyTiramisConfigurationService {
  private readonly logger = new Logger(CompanyTiramisConfigurationService.name);

  constructor(
    @InjectRepository(TiramisCompanyConfigurationEntity)
    private readonly repository: Repository<TiramisCompanyConfigurationEntity>,

    private readonly dataSource: DataSource,
    private readonly tiramisClientService: TiramisClientService,
    private readonly auditService: AuditService,
    private readonly apiKeyVault: TiramisServiceApiKeyVaultService,
    private readonly configService: ConfigService,
    private readonly webhookCredentialService: TiramisWebhookCredentialService,
  ) {}

  /**
   * Re-syncs the portal webhook API key for every active company
   * configuration. Used by `npm run tiramis:sync-webhook-keys` to repair
   * environments provisioned before keys were synced automatically.
   */
  async syncAllPortalWebhookApiKeys() {
    const configurations = await this.repository.find({
      where: { isActive: true },
    });
    const results: Array<{
      companyId: string;
      environment: string;
      ok: boolean;
      message?: string;
    }> = [];

    for (const configuration of configurations) {
      const environment = configuration.environment as 'test' | 'live';

      try {
        await this.syncPortalWebhookCredential(
          configuration.companyId,
          environment,
        );
        results.push({
          companyId: configuration.companyId,
          environment,
          ok: true,
        });
      } catch (error) {
        results.push({
          companyId: configuration.companyId,
          environment,
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  private async syncPortalWebhookApiKey(
    companyId: string,
    environment: 'test' | 'live',
    tiramisConfigurationId: string,
  ) {
    try {
      await this.webhookCredentialService.syncWebhookApiKey({
        companyId,
        environment,
        tiramisConfigurationId,
      });
    } catch (error) {
      throw new BadRequestException(
        `Failed to sync the portal webhook API key to TIRAMIS: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async findAll(companyId: string) {
    const [configs, company] = await Promise.all([
      this.repository
        .createQueryBuilder('configuration')
        .addSelect('configuration.serviceApiKeyEncrypted')
        .where('configuration.companyId = :companyId', { companyId })
        .orderBy('configuration.environment', 'ASC')
        .getMany(),
      this.dataSource.getRepository(Company).findOne({
        where: { id: companyId },
      }),
    ]);
    const targetEnvironment =
      company?.settings?.tiramis_target_environment ?? null;

    const responses: Array<Record<string, any>> = configs.map((configuration) =>
      this.toResponse(
        configuration,
        configuration.environment === targetEnvironment,
      ),
    );
    for (const response of responses) {
      try {
        const health = await this.getSecretHealth(
          companyId,
          response.environment as 'test' | 'live',
        );
        response.notificationCredentialStatus =
          health.secrets.find((secret) => secret.name === 'portalWebhookApiKey')
            ?.status ?? 'MISSING';
      } catch (error) {
        response.notificationCredentialStatus =
          error instanceof Error ? error.message : 'Unable to check';
      }
    }
    return responses;
  }

  findRaw(companyId: string) {
    return this.repository.find({
      where: { companyId },
      order: { environment: 'ASC' },
    });
  }

  async upsert(
    companyId: string,
    dto: UpsertCompanyTiramisConfigurationDto,
    actorId: string,
  ) {
    // The configuration (including the API key) is written and committed
    // in its own transaction first. Activation, when requested, validates
    // against TIRAMIS afterwards: validateOrganizationConfiguration reads
    // the configuration through a separate, non-transactional connection,
    // so calling it before this write commits means it can never see the
    // key that was just saved (READ COMMITTED isolation) and activation
    // fails every time with "TIRAMIS API key is not configured", even
    // though the key was provided and about to be saved. Committing first
    // also means a failed live-activation no longer discards the
    // configuration the user just entered.
    const saved = await this.dataSource.transaction(async (manager) => {
      const companyRepository = manager.getRepository(Company);
      const repository = manager.getRepository(
        TiramisCompanyConfigurationEntity,
      );

      const company = await companyRepository.findOne({
        where: { id: companyId },
      });

      if (!company) {
        throw new NotFoundException('Company was not found.');
      }

      let configuration = await repository.findOne({
        where: { companyId, environment: dto.environment },
      });

      const beforeState = configuration
        ? {
            companyCode: configuration.companyCode,
            insurerCompanyCode: configuration.insurerCompanyCode,
            clientCode: configuration.clientCode,
            systemCode: configuration.systemCode,
            systemName: configuration.systemName,
            baseUrl: configuration.baseUrl,
            sourceService: configuration.sourceService,
            allowExpiredCertificates:
              configuration.allowExpiredCertificates ?? false,
            notificationEvents: configuration.notificationEvents ?? null,
            integrationPermissions:
              configuration.integrationPermissions ?? null,
            isActive: configuration.isActive,
          }
        : null;

      if (!configuration) {
        configuration = repository.create({
          companyId,
          environment: dto.environment,
          companyCode: dto.company_code,
          companyName: company.name,
          insurerCompanyCode: dto.insurer_company_code ?? dto.company_code,
          insurerCompanyName: company.name,
          clientCode: dto.client_code ?? null,
          systemCode: dto.system_code,
          systemName: dto.system_name ?? null,
          callbackUrl: dto.callback_url ?? null,
          baseUrl: dto.base_url ?? null,
          sourceService: dto.source_service ?? null,
          allowExpiredCertificates: dto.allow_expired_certificates ?? false,
          notificationEvents: dto.notification_events ?? null,
          integrationPermissions: dto.integration_permissions ?? [
            'submit',
            'read_status',
            'receive_notifications',
          ],
          serviceApiKeyEncrypted: this.apiKeyVault.encrypt(
            dto.tiramis_service_api_key,
          ),
          isActive: dto.is_active ?? true,
          validationStatus: 'NOT_VALIDATED',
          validatedAt: null,
          validationMessage: null,
          metadata: null,
        });
      } else {
        configuration.companyCode = dto.company_code;
        configuration.insurerCompanyCode =
          dto.insurer_company_code ?? dto.company_code;
        configuration.clientCode = dto.client_code ?? null;
        configuration.systemCode = dto.system_code;
        configuration.systemName = dto.system_name ?? null;
        configuration.callbackUrl = dto.callback_url ?? null;
        configuration.baseUrl = dto.base_url ?? null;
        configuration.sourceService = dto.source_service ?? null;
        configuration.allowExpiredCertificates =
          dto.allow_expired_certificates ??
          configuration.allowExpiredCertificates ??
          false;
        if (dto.notification_events !== undefined) {
          configuration.notificationEvents = dto.notification_events;
        }
        if (dto.integration_permissions !== undefined) {
          configuration.integrationPermissions = dto.integration_permissions;
        }
        if (dto.tiramis_service_api_key) {
          configuration.serviceApiKeyEncrypted = this.apiKeyVault.encrypt(
            dto.tiramis_service_api_key,
          );
        }
        configuration.isActive = dto.is_active ?? configuration.isActive;
        configuration.validationStatus = 'NOT_VALIDATED';
        configuration.validatedAt = null;
        configuration.validationMessage = null;
      }

      const saved = await repository.save(configuration);

      company.tira_integration_enabled = true;
      await companyRepository.save(company);

      await this.auditService.logCritical(
        {
          userId: actorId,
          companyId,
          action: 'tiramis.company_configuration.updated',
          eventCategory: 'organization',
          resource: 'tiramis_company_configuration',
          resourceId: saved.id,
          beforeState: beforeState ?? undefined,
          afterState: {
            environment: saved.environment,
            companyCode: saved.companyCode,
            insurerCompanyCode: saved.insurerCompanyCode,
            clientCode: saved.clientCode,
            systemCode: saved.systemCode,
            systemName: saved.systemName,
            baseUrl: saved.baseUrl,
            sourceService: saved.sourceService,
            allowExpiredCertificates: saved.allowExpiredCertificates,
            notificationEvents: saved.notificationEvents,
            integrationPermissions: saved.integrationPermissions,
            isActive: saved.isActive,
            serviceApiKeyMasked: this.apiKeyVault.mask(
              saved.serviceApiKeyEncrypted,
            ),
          },
        },
        manager,
      );

      return saved;
    });

    // Ensure TIRAMIS's own ClientConfiguration (the TIRA-issued
    // clientCode/clientKey/baseUrl/callbackBaseUrl) exists/updates to match
    // — this is what lets a platform admin link a company entirely through
    // this one form, with no seeder or manual DB work on the TIRAMIS side.
    // Runs after commit (not inside the transaction above) since it's an
    // outbound network call, not something that should hold a DB lock.
    try {
      // saved.baseUrl/saved.callbackUrl are a DIFFERENT concept (which
      // TIRAMIS instance the *portal* calls) from TIRAMIS's own
      // ClientConfiguration baseUrl/callbackBaseUrl (which TIRA gateway
      // *TIRAMIS* calls, and where it tells TIRA to send callbacks) — they
      // must never be conflated. There is currently no per-company override
      // field for the TIRA gateway URL, so this always lets TIRAMIS apply
      // its own environment default (TIRAMIS_TEST/LIVE_BASE_URL,
      // TIRAMIS_TEST/LIVE_CALLBACK_URL).
      const tiramisConfiguration =
        await this.tiramisClientService.upsertClientConfiguration({
          companyId,
          environment: saved.environment as 'test' | 'live',
          companyCode: saved.companyCode,
          systemCode: saved.systemCode!,
          insurerCompanyCode: saved.insurerCompanyCode ?? saved.companyCode,
          clientCode: saved.clientCode ?? saved.companyCode,
          clientKey: dto.client_key,
        });

      await this.syncPortalWebhookApiKey(
        companyId,
        saved.environment as 'test' | 'live',
        tiramisConfiguration.id,
      );
      await this.tiramisClientService.setPortalNotificationPolicy({
        companyId,
        environment: saved.environment as 'test' | 'live',
        tiramisConfigurationId: tiramisConfiguration.id,
        enabled: (
          saved.integrationPermissions ?? ['receive_notifications']
        ).includes('receive_notifications'),
        eventTypes: saved.notificationEvents ?? [],
      });
    } catch (error) {
      saved.validationStatus = 'INVALID';
      saved.validatedAt = new Date();
      saved.validationMessage =
        error instanceof Error
          ? `Failed to link this company to TIRAMIS: ${error.message}`
          : 'Failed to link this company to TIRAMIS.';
      await this.repository.save(saved);
      throw error;
    }

    if (!dto.use_as_target_environment) {
      const company = await this.dataSource
        .getRepository(Company)
        .findOne({ where: { id: companyId } });

      return this.toResponse(
        saved,
        company?.settings?.tiramis_target_environment === saved.environment,
      );
    }

    return this.activateSavedConfiguration(companyId, saved, actorId, {
      confirmLive: dto.confirm_live_activation,
      forceActivation: dto.force_activation,
    });
  }

  private async activateSavedConfiguration(
    companyId: string,
    saved: TiramisCompanyConfigurationEntity,
    actorId: string,
    options: { confirmLive?: boolean; forceActivation?: boolean },
  ) {
    const validation = await this.assertEnvironmentCanBeActivated({
      companyId,
      environment: saved.environment as 'test' | 'live',
      companyCode: saved.companyCode,
      systemCode: saved.systemCode,
      insurerCompanyCode: saved.insurerCompanyCode,
      allowExpiredCertificates: saved.allowExpiredCertificates,
      confirmLive: options.confirmLive,
      forceActivation: options.forceActivation,
    });
    const forced = options.forceActivation && !validation.valid;

    return this.dataSource.transaction(async (manager) => {
      const companyRepository = manager.getRepository(Company);

      const company = await companyRepository.findOne({
        where: { id: companyId },
      });

      if (!company) {
        throw new NotFoundException('Company was not found.');
      }

      const previousEnvironment =
        company.settings?.tiramis_target_environment ?? null;
      company.tira_integration_enabled = true;
      company.settings = {
        ...(company.settings ?? {}),
        tiramis_target_environment: saved.environment,
      };
      await companyRepository.save(company);

      await this.auditService.logCritical(
        {
          userId: actorId,
          companyId,
          action: forced
            ? 'tiramis.company_configuration.environment_activated_forced_despite_invalid_validation'
            : 'tiramis.company_configuration.environment_activated',
          eventCategory: 'organization',
          resource: 'tiramis_company_configuration',
          resourceId: saved.id,
          beforeState: { environment: previousEnvironment },
          afterState: {
            environment: saved.environment,
            validation,
            forced,
            serviceCallbackUrl: this.resolveCallbackUrl(saved),
          },
        },
        manager,
      );

      return this.toResponse(saved, true);
    });
  }

  async validate(
    companyId: string,
    environment: 'test' | 'live',
    options?: { allowExpiredCertificates?: boolean },
  ) {
    const configuration = await this.repository.findOne({
      where: { companyId, environment, isActive: true },
    });

    if (!configuration) {
      throw new NotFoundException(
        'Active TIRAMIS configuration was not found.',
      );
    }

    try {
      const allowExpiredCertificates =
        options?.allowExpiredCertificates ??
        configuration.allowExpiredCertificates ??
        false;
      const result =
        await this.tiramisClientService.validateOrganizationConfiguration({
          companyId,
          environment,
          companyCode: configuration.companyCode,
          systemCode: configuration.systemCode,
          insurerCompanyCode: configuration.insurerCompanyCode,
          allowExpiredCertificates,
        });

      // Self-heal: a configuration TIRAMIS cannot authenticate to our
      // webhook with only gets callback updates via the 2-minute status sync.
      if (result.configurationId && !result.portalWebhook?.apiKeyConfigured) {
        await this.syncPortalWebhookApiKey(
          companyId,
          environment,
          result.configurationId,
        );
        result.portalWebhook = { apiKeyConfigured: true };
      }

      configuration.validationStatus = result.valid ? 'VALID' : 'INVALID';
      configuration.validatedAt = new Date();
      configuration.validationMessage = this.buildStoredValidationMessage(
        result,
        allowExpiredCertificates,
      );

      await this.repository.save(configuration);

      return result;
    } catch (error) {
      configuration.validationStatus = 'INVALID';
      configuration.validatedAt = new Date();
      configuration.validationMessage =
        error instanceof Error
          ? error.message
          : 'Configuration validation failed.';

      await this.repository.save(configuration);

      throw error;
    }
  }

  async getPortalWebhookDiagnostics(
    companyId: string,
    environment: 'test' | 'live',
  ) {
    const configuration = await this.repository.findOne({
      where: { companyId, environment, isActive: true },
    });

    return {
      environment,
      webhookUrl: resolveTiramisPortalWebhookUrl(this.configService),
      configured: Boolean(configuration),
      validationStatus: configuration?.validationStatus ?? 'NOT_CONFIGURED',
      validatedAt: configuration?.validatedAt ?? null,
      webhookCredentialStatus: configuration?.validatedAt
        ? 'CHECK_ON_TEST'
        : 'NOT_CHECKED',
    };
  }

  async testPortalWebhook(companyId: string, environment: 'test' | 'live') {
    const configuration = await this.repository.findOne({
      where: { companyId, environment, isActive: true },
    });

    if (!configuration) {
      throw new NotFoundException(
        'Active TIRAMIS configuration was not found for this environment.',
      );
    }

    const validation = await this.validate(companyId, environment);
    if (!validation.configurationId) {
      throw new BadRequestException(
        validation.message || 'TIRAMIS configuration could not be resolved.',
      );
    }

    return this.tiramisClientService.testPortalWebhook({
      companyId,
      environment,
      tiramisConfigurationId: validation.configurationId,
      webhookUrl: resolveTiramisPortalWebhookUrl(this.configService),
    });
  }

  async getDeliveryDiagnostics(
    companyId: string,
    environment: 'test' | 'live',
    params: { requestId?: string; limit?: number },
  ) {
    const configuration = await this.repository.findOne({
      where: { companyId, environment, isActive: true },
    });
    if (!configuration)
      throw new NotFoundException(
        'Active TIRAMIS configuration was not found for this environment.',
      );
    const tiramisConfigurationId = await this.resolveTiramisConfigurationId(
      companyId,
      environment,
    );
    const result =
      await this.tiramisClientService.getTiramisDeliveryDiagnostics({
        companyId,
        environment,
        requestId: params.requestId,
        limit: params.limit,
      });
    return {
      environment,
      configurationId: tiramisConfigurationId,
      ...(result as object),
    };
  }

  async syncPortalWebhookCredential(
    companyId: string,
    environment: 'test' | 'live',
  ) {
    const tiramisConfigurationId = await this.resolveTiramisConfigurationId(
      companyId,
      environment,
    );

    await this.syncPortalWebhookApiKey(
      companyId,
      environment,
      tiramisConfigurationId,
    );

    return {
      success: true,
      environment,
      message:
        'Portal webhook credential rotated and synced to TIRAMIS. Run the connection test to confirm delivery.',
    };
  }

  async getSecretHealth(companyId: string, environment: 'test' | 'live') {
    const tiramisConfigurationId = await this.resolveTiramisConfigurationId(
      companyId,
      environment,
    );

    return this.tiramisClientService.getConfigurationSecretHealth({
      companyId,
      environment,
      tiramisConfigurationId,
    });
  }

  /**
   * One-click recovery after TIRAMIS_SECRET_ENCRYPTION_KEY changes: TIRAMIS
   * re-encrypts every secret it can still read (or that is supplied here)
   * with its current key, and the portal webhook key — which the portal
   * owns — is reissued whenever TIRAMIS cannot read it.
   */
  async repairSecrets(
    companyId: string,
    environment: 'test' | 'live',
    actorId: string,
    replacements: Partial<Record<TiramisSecretName, string>> = {},
  ) {
    const tiramisConfigurationId = await this.resolveTiramisConfigurationId(
      companyId,
      environment,
    );
    const suppliedReplacements = Object.fromEntries(
      Object.entries(replacements).filter(
        ([name, value]) => typeof value === 'string' && value.trim() !== '',
      ),
    ) as Partial<Record<TiramisSecretName, string>>;

    let health = await this.tiramisClientService.repairConfigurationSecrets({
      companyId,
      environment,
      tiramisConfigurationId,
      replacements: suppliedReplacements,
    });

    const webhookSecret = health.secrets.find(
      (secret) => secret.name === 'portalWebhookApiKey',
    );
    const webhookKeyReissued = webhookSecret?.status !== 'OK';
    if (webhookKeyReissued) {
      await this.syncPortalWebhookApiKey(
        companyId,
        environment,
        tiramisConfigurationId,
      );
      health = await this.tiramisClientService.getConfigurationSecretHealth({
        companyId,
        environment,
        tiramisConfigurationId,
      });
    }

    await this.auditService.logCritical({
      userId: actorId,
      companyId,
      action: 'tiramis.company_configuration.secrets_repaired',
      eventCategory: 'organization',
      resource: 'tiramis_company_configuration',
      resourceId: tiramisConfigurationId,
      afterState: {
        environment,
        replacedSecrets: Object.keys(suppliedReplacements),
        webhookKeyReissued,
        secrets: health.secrets.map(({ name, status }) => ({ name, status })),
      },
    });

    return { ...health, webhookKeyReissued };
  }

  /**
   * Finds the TIRAMIS client configuration id by company/system code
   * without decrypting any TIRAMIS secret, unlike validate().
   */
  private async resolveTiramisConfigurationId(
    companyId: string,
    environment: 'test' | 'live',
  ): Promise<string> {
    const configuration = await this.repository.findOne({
      where: { companyId, environment, isActive: true },
    });

    if (!configuration) {
      throw new NotFoundException(
        'Active TIRAMIS configuration was not found for this environment.',
      );
    }

    if (!configuration.systemCode) {
      throw new BadRequestException(
        'TIRAMIS configuration has no system code.',
      );
    }

    return this.tiramisClientService.resolveOrganizationConfigurationId({
      companyId,
      environment,
      companyCode: configuration.companyCode,
      systemCode: configuration.systemCode,
    });
  }

  async activate(
    companyId: string,
    environment: 'test' | 'live',
    actorId: string,
    options: { confirmLive?: boolean; forceActivation?: boolean } = {},
  ) {
    const configuration = await this.repository.findOne({
      where: { companyId, environment, isActive: true },
    });

    if (!configuration) {
      throw new NotFoundException(
        'Active TIRAMIS configuration was not found.',
      );
    }

    return this.activateSavedConfiguration(companyId, configuration, actorId, {
      confirmLive: options.confirmLive,
      forceActivation: options.forceActivation,
    });
  }

  async generateServiceApiKey(
    companyId: string,
    environment: 'test' | 'live',
    actorId: string,
    adminAccessToken: string,
    allowedIps: string[],
  ) {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(
        TiramisCompanyConfigurationEntity,
      );
      const companyRepository = manager.getRepository(Company);
      const [configuration, company] = await Promise.all([
        repository
          .createQueryBuilder('configuration')
          .addSelect('configuration.serviceApiKeyEncrypted')
          .where('configuration.companyId = :companyId', { companyId })
          .andWhere('configuration.environment = :environment', {
            environment,
          })
          .getOne(),
        companyRepository.findOne({ where: { id: companyId } }),
      ]);

      if (!configuration) {
        throw new NotFoundException(
          'TIRAMIS configuration must be created before an API key can be generated.',
        );
      }

      const generatedApiKey =
        await this.tiramisClientService.rotateOrganizationApiKey({
          companyId,
          environment,
          companyCode: configuration.companyCode,
          systemCode: configuration.systemCode,
          adminAccessToken,
          allowedIps,
        });
      const hadExistingApiKey = Boolean(configuration.serviceApiKeyEncrypted);
      const encryptedKey = this.apiKeyVault.encrypt(generatedApiKey);
      configuration.serviceApiKeyEncrypted = encryptedKey;
      configuration.validationStatus = 'NOT_VALIDATED';
      configuration.validatedAt = null;
      configuration.validationMessage = null;

      const saved = await repository.save(configuration);
      await repository.update(
        {
          environment,
          sourceService: configuration.sourceService ?? IsNull(),
        },
        { serviceApiKeyEncrypted: encryptedKey },
      );

      await this.auditService.logCritical(
        {
          userId: actorId,
          companyId,
          action: 'tiramis.company_configuration.service_api_key.rotated',
          eventCategory: 'organization',
          resource: 'tiramis_company_configuration',
          resourceId: saved.id,
          beforeState: {
            environment,
            serviceApiKeyConfigured: hadExistingApiKey,
          },
          afterState: {
            environment,
            environmentLabel:
              environment === 'live' ? 'Live/Production' : 'Test/UAT',
            serviceApiKeyConfigured: true,
            serviceApiKeyMasked: this.apiKeyVault.mask(
              saved.serviceApiKeyEncrypted,
            ),
          },
        },
        manager,
      );

      return {
        ...this.toResponse(
          saved,
          company?.settings?.tiramis_target_environment === saved.environment,
        ),
        generatedApiKey,
      };
    });
  }

  private toResponse(
    configuration: TiramisCompanyConfigurationEntity,
    isTargetEnvironment: boolean,
  ) {
    const apiKey = this.describeServiceApiKey(configuration);

    return {
      ...configuration,
      notificationEvents: configuration.notificationEvents ?? [
        'TIRAMIS_ACK_RECEIVED',
        'TIRAMIS_ACK_FAILED',
        'TIRAMIS_FINAL_RESPONSE_RECEIVED',
        'TIRAMIS_FINAL_SUCCESS',
        'TIRAMIS_FINAL_FAILED',
        'TIRAMIS_FINAL_CALLBACK_OVERDUE',
        'TIRAMIS_RESPONSE_ACK_SENT',
        'TIRAMIS_CALLBACK_REJECTED',
        'TIRAMIS_SUBMISSION_FAILED',
      ],
      integrationPermissions: configuration.integrationPermissions ?? [
        'submit',
        'read_status',
        'receive_notifications',
      ],
      environmentLabel:
        configuration.environment === 'live' ? 'Live/Production' : 'Test/UAT',
      isTargetEnvironment,
      apiKeyStatus: apiKey.status,
      effectiveCallbackUrl: this.resolveCallbackUrl(configuration),
      effectiveBaseUrl: this.resolveBaseUrl(configuration),
      effectiveSourceService: this.resolveSourceService(configuration),
      effectiveTargetEnvironment: isTargetEnvironment
        ? configuration.environment
        : this.resolveDefaultTargetEnvironment(),
      serviceCallbackUrl: this.resolveCallbackUrl(configuration),
      tiramisCallbackUrl: this.resolveCallbackUrl(configuration),
      tiramisCallbackPath: null,
      isActiveCallback:
        isTargetEnvironment && Boolean(this.resolveCallbackUrl(configuration)),
      serviceApiKeyMasked: apiKey.masked,
      serviceApiKeyConfigured: Boolean(configuration.serviceApiKeyEncrypted),
      serviceApiKeyEncrypted: undefined,
      clientKey: undefined,
    };
  }

  private describeServiceApiKey(
    configuration: TiramisCompanyConfigurationEntity,
  ): {
    status: 'ACTIVE' | 'NOT_CONFIGURED' | 'RECOVERY_REQUIRED';
    masked: string | null;
  } {
    if (!configuration.serviceApiKeyEncrypted) {
      return { status: 'NOT_CONFIGURED', masked: null };
    }

    try {
      return {
        status: 'ACTIVE',
        masked: this.apiKeyVault.mask(configuration.serviceApiKeyEncrypted),
      };
    } catch {
      // Keep the management screen available so an owner can rotate a key
      // encrypted under a lost or superseded application encryption key.
      this.logger.warn(
        `TIRAMIS API key recovery is required for configuration ${configuration.id}.`,
      );
      return { status: 'RECOVERY_REQUIRED', masked: null };
    }
  }

  private async assertEnvironmentCanBeActivated(params: {
    companyId: string;
    environment: 'test' | 'live';
    companyCode: string;
    systemCode: string | null;
    insurerCompanyCode?: string | null;
    allowExpiredCertificates?: boolean;
    confirmLive?: boolean;
    forceActivation?: boolean;
  }) {
    if (params.environment === 'live' && params.confirmLive !== true) {
      throw new BadRequestException(
        'Switching to LIVE/PRODUCTION requires confirmation.',
      );
    }

    const validation =
      await this.tiramisClientService.validateOrganizationConfiguration({
        companyId: params.companyId,
        environment: params.environment,
        companyCode: params.companyCode,
        systemCode: params.systemCode,
        insurerCompanyCode: params.insurerCompanyCode,
        allowExpiredCertificates: params.allowExpiredCertificates,
      });

    if (!validation.valid && !params.forceActivation) {
      throw new BadRequestException({
        message:
          validation.message ||
          'TIRAMIS configuration validation failed. Active environment was not changed.',
        validation,
      });
    }

    return validation;
  }

  /**
   * This is a portal-local display field only — it is NOT the same concept
   * as TIRAMIS's own ClientConfiguration.callbackBaseUrl (where TIRAMIS
   * tells TIRA to send callbacks) or the per-submission portalWebhookUrl
   * (where TIRAMIS pushes async notifications to the portal). Neither of
   * those belongs in this fallback — if nothing was explicitly entered
   * here, there simply isn't a portal-local override configured.
   */
  private resolveCallbackUrl(configuration: TiramisCompanyConfigurationEntity) {
    return configuration.callbackUrl?.trim() || null;
  }

  private resolveBaseUrl(configuration: TiramisCompanyConfigurationEntity) {
    return (
      configuration.baseUrl?.trim() ||
      this.configService.get<string>('tiramisClient.baseUrl')?.trim() ||
      null
    );
  }

  private resolveSourceService(
    configuration: TiramisCompanyConfigurationEntity,
  ) {
    return (
      configuration.sourceService?.trim() ||
      this.configService.get<string>('tiramisClient.sourceService')?.trim() ||
      null
    );
  }

  private resolveDefaultTargetEnvironment() {
    return (
      this.configService.get<'test' | 'live'>(
        'tiramisClient.targetEnvironment',
      ) ?? 'test'
    );
  }

  private buildStoredValidationMessage(
    result: {
      valid: boolean;
      message?: string;
      warnings?: string[];
      certificates?: unknown;
    },
    allowExpiredCertificates: boolean,
  ): string | null {
    const warnings = result.warnings ?? [];
    const clientPrivateCertificate = this.extractCertificate(
      result.certificates,
      'clientPrivate',
    );
    const tiraPublicCertificate = this.extractTiraPublicCertificate(
      result.certificates,
    );

    if (!result.valid) {
      return result.message ?? null;
    }

    const expiredCertificates = [
      clientPrivateCertificate?.isExpired && clientPrivateCertificate.validTo
        ? `Client private certificate expired on ${clientPrivateCertificate.validTo}`
        : null,
      tiraPublicCertificate?.isExpired && tiraPublicCertificate.validTo
        ? `TIRA public certificate expired on ${tiraPublicCertificate.validTo}`
        : null,
    ].filter(Boolean);

    if (allowExpiredCertificates && expiredCertificates.length > 0) {
      return `Configuration validated with warning: ${expiredCertificates.join(' and ')}, but expiry validation was explicitly allowed.`;
    }

    if (warnings.length > 0) {
      return `Configuration validated with warning: ${warnings.join('; ')}`;
    }

    return result.message ?? null;
  }

  private extractTiraPublicCertificate(certificates: unknown): {
    isExpired?: boolean;
    validTo?: string;
  } | null {
    return this.extractCertificate(certificates, 'tiraPublic');
  }

  private extractCertificate(
    certificates: unknown,
    key: 'clientPrivate' | 'tiraPublic',
  ): { isExpired?: boolean; validTo?: string } | null {
    if (!certificates || typeof certificates !== 'object') {
      return null;
    }

    const value = (certificates as Record<string, unknown>)[key];

    if (!value || typeof value !== 'object') {
      return null;
    }

    const certificate = value as {
      isExpired?: boolean;
      validTo?: string;
    };

    return {
      isExpired: certificate.isExpired,
      validTo: certificate.validTo,
    };
  }
}
