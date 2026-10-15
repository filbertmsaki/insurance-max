import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  CompanyConfig,
  ConfigValueType,
} from './entities/company-config.entity';
import { UpsertCompanyConfigDto } from './dtos/upsert-company-config.dto';
import { AuditService } from '../../shared/audit/audit.service';
import {
  DEFAULT_POLICY_NUMBERING,
  POLICY_NUMBERING_KEY,
  policySequenceName,
  validatePolicyNumbering,
} from '../../tenant/policies/utils/policy-number';

const NUMBERING_TABLES = {
  branches: {
    table: 'branches',
    name: 'name',
    code: 'code',
    link: 'branch_id',
  },
  products: {
    table: 'insurance_products',
    name: 'product_name',
    code: 'product_code',
    link: 'product_id',
  },
  categories: {
    table: 'insurance_categories',
    name: 'name',
    code: 'code',
    link: 'category_id',
  },
} as const;

@Injectable()
export class CompanyConfigsService {
  constructor(
    @InjectRepository(CompanyConfig)
    private readonly repository: Repository<CompanyConfig>,
    private readonly auditService: AuditService,
  ) {}

  async numberingStatus(companyId: string) {
    const manager = this.repository.manager;
    const [company] = await manager.query(
      'SELECT id, operating_timezone FROM companies WHERE id = $1 AND deleted_at IS NULL',
      [companyId],
    );
    if (!company) throw new NotFoundException('Company not found');
    const config = await this.getValue(
      companyId,
      POLICY_NUMBERING_KEY,
      DEFAULT_POLICY_NUMBERING,
    );
    const [sequence] = await manager.query(
      `SELECT last_value::text, is_called FROM public.${policySequenceName(companyId)}`,
    );
    const codes: Record<string, unknown> = {};
    for (const [kind, spec] of Object.entries(NUMBERING_TABLES)) {
      codes[kind] = await manager.query(
        `SELECT e.id, e.${spec.name} AS name, e.${spec.code} AS code,
        e.policy_numbering_code, e.deleted_at,
        EXISTS(SELECT 1 FROM policies p WHERE p.${spec.link} = e.id AND p.policy_sequence IS NOT NULL) AS locked
        FROM ${spec.table} e WHERE e.company_id = $1 ORDER BY e.${spec.name}, e.id`,
        [companyId],
      );
    }
    return {
      configuration: validatePolicyNumbering(config),
      timezone: company.operating_timezone,
      sequence: {
        last_allocated: sequence.is_called ? sequence.last_value : null,
        scope: 'INSURER',
      },
      codes,
    };
  }

  async updateNumberingCode(
    companyId: string,
    kind: string,
    id: string,
    code: string,
    userId: string,
  ) {
    const spec = Object.hasOwn(NUMBERING_TABLES, kind)
      ? NUMBERING_TABLES[kind as keyof typeof NUMBERING_TABLES]
      : undefined;
    if (!spec || !/^[0-9]{1,12}$/.test(code))
      throw new BadRequestException('Invalid numbering kind or numeric code');
    try {
      return await this.repository.manager.transaction(async (manager) => {
        const [before] = await manager.query(
          `SELECT * FROM ${spec.table} WHERE id = $1 AND company_id = $2 FOR UPDATE`,
          [id, companyId],
        );
        if (!before) throw new NotFoundException('Numbering entity not found');
        const [after] = await manager.query(
          `UPDATE ${spec.table} SET policy_numbering_code = $1 WHERE id = $2 AND company_id = $3 RETURNING id, policy_numbering_code`,
          [code, id, companyId],
        );
        await this.auditService.logCritical(
          {
            userId,
            companyId,
            action: 'policy.numbering.code.updated',
            resource: spec.table,
            resourceId: id,
            beforeState: {
              policy_numbering_code: before.policy_numbering_code,
            },
            afterState: after,
          },
          manager,
        );
        return after;
      });
    } catch (error) {
      if (
        ['23505', '23514'].includes((error as { code?: string }).code ?? '')
      ) {
        throw new ConflictException(
          'The numbering code is already assigned or locked by issued policies',
        );
      }
      throw error;
    }
  }

  findAll(companyId: string) {
    return this.repository.find({
      where: { company_id: companyId },
      order: { config_key: 'ASC' },
    });
  }

  async findOne(companyId: string, key: string): Promise<CompanyConfig> {
    const config = await this.repository.findOne({
      where: { company_id: companyId, config_key: key },
    });

    if (!config) {
      throw new NotFoundException(`Company config "${key}" not found`);
    }

    return config;
  }

  /**
   * Typed read for internal callers — returns `fallback` if the key is
   * missing, inactive, or the stored value doesn't match its declared type,
   * rather than throwing, since this is meant to sit ahead of a hardcoded
   * default, not replace error handling.
   */
  async getValue<T extends string | number | boolean | unknown>(
    companyId: string,
    key: string,
    fallback: T,
  ): Promise<T> {
    const config = await this.repository.findOne({
      where: { company_id: companyId, config_key: key, is_active: true },
    });

    if (!config) {
      return fallback;
    }

    try {
      this.assertValueMatchesType(
        config.config_value,
        config.value_type as ConfigValueType,
      );
      return config.config_value as T;
    } catch {
      return fallback;
    }
  }

  async upsert(
    companyId: string,
    key: string,
    dto: UpsertCompanyConfigDto,
    userId?: string,
  ): Promise<CompanyConfig> {
    this.assertValueMatchesType(dto.config_value, dto.value_type);

    if (key === POLICY_NUMBERING_KEY) {
      if (dto.value_type !== ConfigValueType.JSON || dto.is_active === false) {
        throw new BadRequestException(
          'Policy numbering must be active JSON configuration',
        );
      }
      const configuration = validatePolicyNumbering(dto.config_value);
      return this.repository.manager.transaction(async (manager) => {
        const repo = manager.getRepository(CompanyConfig);
        await manager.query(
          'SELECT id FROM companies WHERE id = $1 FOR UPDATE',
          [companyId],
        );
        const existing = await repo.findOne({
          where: { company_id: companyId, config_key: key },
        });
        const beforeState = {
          configuration: existing?.config_value ?? DEFAULT_POLICY_NUMBERING,
        };
        const record =
          existing ?? repo.create({ company_id: companyId, config_key: key });
        record.config_value = configuration;
        record.value_type = ConfigValueType.JSON;
        record.is_active = true;
        record.description = dto.description ?? record.description ?? null;
        const saved = await repo.save(record);
        await this.auditService.logCritical(
          {
            userId,
            companyId,
            action: 'policy.numbering.configuration.updated',
            resource: 'company_config',
            resourceId: saved.id,
            beforeState,
            afterState: { configuration },
          },
          manager,
        );
        return saved;
      });
    }

    const existing = await this.repository.findOne({
      where: { company_id: companyId, config_key: key },
    });

    const record =
      existing ??
      this.repository.create({
        company_id: companyId,
        config_key: key,
      });

    record.config_value = dto.config_value;
    record.value_type = dto.value_type;
    record.description = dto.description ?? record.description ?? null;
    record.is_active = dto.is_active ?? record.is_active ?? true;

    return this.repository.save(record);
  }

  async remove(companyId: string, key: string): Promise<void> {
    if (key === POLICY_NUMBERING_KEY) {
      throw new BadRequestException(
        'Save the default policy numbering configuration instead of deleting it',
      );
    }
    const config = await this.findOne(companyId, key);
    await this.repository.remove(config);
  }

  private assertValueMatchesType(
    value: unknown,
    valueType: ConfigValueType,
  ): void {
    switch (valueType) {
      case ConfigValueType.STRING:
        if (typeof value !== 'string') {
          throw new BadRequestException(
            'config_value must be a string for value_type STRING',
          );
        }
        return;
      case ConfigValueType.NUMBER:
        if (typeof value !== 'number' || Number.isNaN(value)) {
          throw new BadRequestException(
            'config_value must be a number for value_type NUMBER',
          );
        }
        return;
      case ConfigValueType.BOOLEAN:
        if (typeof value !== 'boolean') {
          throw new BadRequestException(
            'config_value must be a boolean for value_type BOOLEAN',
          );
        }
        return;
      case ConfigValueType.JSON:
        return;
      default:
        throw new BadRequestException(`Unsupported value_type: ${valueType}`);
    }
  }
}
