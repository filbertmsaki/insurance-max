import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TiramisCoverNoteEntity } from '../entities/tiramis-cover-note.entity';

@Injectable()
export class TiramisCoverNoteRepository {
  constructor(
    @InjectRepository(TiramisCoverNoteEntity)
    private readonly repository: Repository<TiramisCoverNoteEntity>,
  ) {}

  create(data: Partial<TiramisCoverNoteEntity>) {
    return this.repository.create(data);
  }

  save(entity: TiramisCoverNoteEntity) {
    return this.repository.save(entity);
  }

  findById(id: string) {
    return this.repository.findOne({
      where: { id },
      relations: {
        risks: {
          discounts: true,
          taxes: true,
        },
        subjectMatters: true,
        addons: {
          taxes: true,
        },
        policyHolders: true,
      },
    });
  }

  findByCoverNoteNumber(coverNoteNumber: string) {
    return this.repository.findOne({
      where: { coverNoteNumber },
    });
  }

  findByRequestId(requestId: string) {
    return this.repository.findOne({
      where: { requestId },
    });
  }

  findByTransactionId(transactionId: string) {
    return this.repository.findOne({
      where: { transactionId },
    });
  }

  findByCoverNoteReferenceNumber(coverNoteReferenceNumber: string) {
    return this.repository.findOne({
      where: { coverNoteReferenceNumber },
    });
  }
}
