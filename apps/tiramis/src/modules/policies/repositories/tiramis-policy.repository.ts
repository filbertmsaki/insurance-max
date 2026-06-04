import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TiramisPolicyEntity } from '../entities/tiramis-policy.entity';

@Injectable()
export class TiramisPolicyRepository {
  constructor(
    @InjectRepository(TiramisPolicyEntity)
    private readonly repository: Repository<TiramisPolicyEntity>,
  ) {}

  create(data: Partial<TiramisPolicyEntity>) {
    return this.repository.create(data);
  }

  save(entity: TiramisPolicyEntity) {
    return this.repository.save(entity);
  }

  findById(id: string) {
    return this.repository.findOne({
      where: { id },
      relations: {
        coverNotes: true,
      },
    });
  }

  findByRequestId(requestId: string) {
    return this.repository.findOne({
      where: { requestId },
      relations: {
        coverNotes: true,
      },
    });
  }

  findByPolicyNumber(policyNumber: string) {
    return this.repository.findOne({
      where: { policyNumber },
      relations: {
        coverNotes: true,
      },
    });
  }

  findByCoverNoteReferenceNumber(coverNoteReferenceNumber: string) {
    return this.repository
      .createQueryBuilder('policy')
      .leftJoinAndSelect('policy.coverNotes', 'coverNote')
      .where(
        'coverNote.cover_note_reference_number = :coverNoteReferenceNumber',
        {
          coverNoteReferenceNumber,
        },
      )
      .orderBy('policy.created_at', 'DESC')
      .getMany();
  }
}
