import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TiramisReinsuranceEntity } from '../entities/tiramis-reinsurance.entity';

@Injectable()
export class TiramisReinsuranceRepository {
  constructor(
    @InjectRepository(TiramisReinsuranceEntity)
    private readonly repository: Repository<TiramisReinsuranceEntity>,
  ) {}

  create(data: Partial<TiramisReinsuranceEntity>) {
    return this.repository.create(data);
  }

  save(entity: TiramisReinsuranceEntity) {
    return this.repository.save(entity);
  }

  findById(id: string) {
    return this.repository.findOne({
      where: { id },
      relations: {
        participants: true,
      },
    });
  }

  findByRequestId(requestId: string) {
    return this.repository.findOne({
      where: { requestId },
      relations: {
        participants: true,
      },
    });
  }

  findByCoverNoteReferenceNumber(coverNoteReferenceNumber: string) {
    return this.repository.find({
      where: { coverNoteReferenceNumber },
      relations: {
        participants: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async markFinalResponseByRequestId(params: {
    requestId: string;
    responseId: string;
    statusCode: string;
    statusDesc: string;
    payload: Record<string, any>;
  }) {
    await this.repository.update(
      { requestId: params.requestId },
      {
        finalResponseId: params.responseId,
        finalResponseStatusCode: params.statusCode,
        finalResponseStatusDesc: params.statusDesc,
        finalResponseReceivedAt: new Date(),
        finalResponsePayload: params.payload,
      },
    );

    return this.findByRequestId(params.requestId);
  }
}
