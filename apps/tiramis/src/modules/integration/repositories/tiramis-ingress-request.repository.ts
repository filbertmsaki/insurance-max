import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TiramisIngressRequestEntity } from '../entities/tiramis-ingress-request.entity';

@Injectable()
export class TiramisIngressRequestRepository {
  constructor(
    @InjectRepository(TiramisIngressRequestEntity)
    private readonly repository: Repository<TiramisIngressRequestEntity>,
  ) {}

  create(data: Partial<TiramisIngressRequestEntity>) {
    return this.repository.create(data);
  }

  save(entity: TiramisIngressRequestEntity) {
    return this.repository.save(entity);
  }

  findByIdempotency(params: {
    sourceCompanyId: string;
    requestType: string;
    idempotencyKey: string;
  }) {
    return this.repository.findOne({
      where: {
        sourceCompanyId: params.sourceCompanyId,
        requestType: params.requestType,
        idempotencyKey: params.idempotencyKey,
      },
    });
  }
}
