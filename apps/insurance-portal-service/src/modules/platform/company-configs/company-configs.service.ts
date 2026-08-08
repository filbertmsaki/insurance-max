import {
  BadRequestException,
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

@Injectable()
export class CompanyConfigsService {
  constructor(
    @InjectRepository(CompanyConfig)
    private readonly repository: Repository<CompanyConfig>,
  ) {}

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
  ): Promise<CompanyConfig> {
    this.assertValueMatchesType(dto.config_value, dto.value_type);

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
