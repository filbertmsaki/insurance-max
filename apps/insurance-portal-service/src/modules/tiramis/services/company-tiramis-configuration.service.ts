import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { AuditService } from '../../shared/audit/audit.service';
import { Company } from '../../platform/companies/entities/company.entity';
import { TiramisCompanyConfigurationEntity } from '../entities/tiramis-company-configuration.entity';
import { TiramisClientService } from './tiramis-client.service';
import { TiramisServiceApiKeyVaultService } from './tiramis-service-api-key-vault.service';
import { UpsertCompanyTiramisConfigurationDto } from '../dto/upsert-company-tiramis-configuration.dto';

@Injectable()
export class CompanyTiramisConfigurationService {
  constructor(
    @InjectRepository(TiramisCompanyConfigurationEntity)
    private readonly repository: Repository<TiramisCompanyConfigurationEntity>,

    private readonly dataSource: DataSource,
    private readonly tiramisClientService: TiramisClientService,
    private readonly auditService: AuditService,
    private readonly apiKeyVault: TiramisServiceApiKeyVaultService,
    private readonly configService: ConfigService,
  ) {}

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

    return configs.map((configuration) =>
      this.toResponse(
        configuration,
        configuration.environment === targetEnvironment,
      ),
    );
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

  async validate(companyId: string, environment: 'test' | 'live') {
    const configuration = await this.repository.findOne({
      where: { companyId, environment, isActive: true },
    });

    if (!configuration) {
      throw new NotFoundException(
        'Active TIRAMIS configuration was not found.',
      );
    }

    try {
      const result =
        await this.tiramisClientService.validateOrganizationConfiguration({
          companyId,
          environment,
          companyCode: configuration.companyCode,
          systemCode: configuration.systemCode,
          insurerCompanyCode: configuration.insurerCompanyCode,
        });

      configuration.validationStatus = result.valid ? 'VALID' : 'INVALID';
      configuration.validatedAt = new Date();
      configuration.validationMessage = result.message ?? null;

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
        });
      const hadExistingApiKey = Boolean(configuration.serviceApiKeyEncrypted);
      configuration.serviceApiKeyEncrypted =
        this.apiKeyVault.encrypt(generatedApiKey);
      configuration.validationStatus = 'NOT_VALIDATED';
      configuration.validatedAt = null;
      configuration.validationMessage = null;

      const saved = await repository.save(configuration);

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
    return {
      ...configuration,
      environmentLabel:
        configuration.environment === 'live' ? 'Live/Production' : 'Test/UAT',
      isTargetEnvironment,
      apiKeyStatus: configuration.serviceApiKeyEncrypted
        ? 'ACTIVE'
        : 'NOT_CONFIGURED',
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
      serviceApiKeyMasked: this.apiKeyVault.mask(
        configuration.serviceApiKeyEncrypted,
      ),
      serviceApiKeyConfigured: Boolean(configuration.serviceApiKeyEncrypted),
      serviceApiKeyEncrypted: undefined,
      clientKey: undefined,
    };
  }

  private async assertEnvironmentCanBeActivated(params: {
    companyId: string;
    environment: 'test' | 'live';
    companyCode: string;
    systemCode: string | null;
    insurerCompanyCode?: string | null;
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

  private resolveCallbackUrl(configuration: TiramisCompanyConfigurationEntity) {
    return (
      configuration.callbackUrl?.trim() ||
      this.configService.get<string>('TIRAMIS_CALLBACK_URL')?.trim() ||
      this.configService.get<string>('TIRA_CALLBACK_URL')?.trim() ||
      this.configService.get<string>('INSURANCE_PORTAL_WEBHOOK_URL')?.trim() ||
      null
    );
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
}
