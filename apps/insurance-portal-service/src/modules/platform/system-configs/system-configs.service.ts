import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SystemConfigEntity } from './entities/system-config.entity';
import { UpsertSystemConfigDto } from './dtos/upsert-system-config.dto';

@Injectable()
export class SystemConfigsService {
  constructor(
    @InjectRepository(SystemConfigEntity)
    private readonly repository: Repository<SystemConfigEntity>,
  ) {}

  findAll() {
    return this.repository.find({ order: { config_key: 'ASC' } });
  }

  async findOne(key: string): Promise<SystemConfigEntity> {
    const config = await this.repository.findOne({ where: { config_key: key } });

    if (!config) {
      throw new NotFoundException(`System config "${key}" not found`);
    }

    return config;
  }

  /** Typed read for internal callers — returns `fallback` instead of throwing. */
  async getValue<T = Record<string, unknown>>(key: string, fallback: T): Promise<T> {
    const config = await this.repository.findOne({
      where: { config_key: key, is_active: true },
    });

    return config ? (config.config_value as T) : fallback;
  }

  async upsert(key: string, dto: UpsertSystemConfigDto): Promise<SystemConfigEntity> {
    const existing = await this.repository.findOne({ where: { config_key: key } });

    const record = existing ?? this.repository.create({ config_key: key });

    record.config_value = dto.config_value;
    record.description = dto.description ?? record.description ?? null;
    record.is_active = dto.is_active ?? record.is_active ?? true;

    return this.repository.save(record);
  }

  async remove(key: string): Promise<void> {
    const config = await this.findOne(key);
    await this.repository.remove(config);
  }
}
