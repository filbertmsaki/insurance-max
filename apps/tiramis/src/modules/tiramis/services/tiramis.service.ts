import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateTiramisItemDto } from '../dto/create-tiramis-item.dto';
import { TiramisItemEntity } from '../entities/tiramis-item.entity';

@Injectable()
export class TiramisService {
  constructor(
    @InjectRepository(TiramisItemEntity)
    private readonly tiramisRepository: Repository<TiramisItemEntity>,
  ) {}

  getStatus() {
    return {
      status: 'ok',
      service: 'tiramis',
    };
  }

  async create(createDto: CreateTiramisItemDto) {
    const item = this.tiramisRepository.create(createDto);
    return this.tiramisRepository.save(item);
  }

  async findAll() {
    return this.tiramisRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  ping(payload: Record<string, unknown>) {
    return {
      message: 'pong from tiramis',
      payload,
    };
  }
}
