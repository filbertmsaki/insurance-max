import { Injectable, NotFoundException } from '@nestjs/common';
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
  ) {}

  findAll(companyId: string) {
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
    return this.dataSource.transaction(async (manager) => {
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
          serviceApiKeyEncrypted: this.apiKeyVault.encrypt(
            dto.tiramis_service_api_key,
          ),
          baseUrl: null,
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
}
