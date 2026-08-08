import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CoverNote } from './entities/cover-note.entity';

@Injectable()
export class CoverNotesService {
  constructor(
    @InjectRepository(CoverNote)
    private readonly coverNoteRepository: Repository<CoverNote>,
  ) {}

  findAll(
    companyId: string,
    filters: { policyId?: string; quotationId?: string } = {},
  ) {
    return this.coverNoteRepository.find({
      where: {
        company_id: companyId,
        ...(filters.policyId ? { policy_id: filters.policyId } : {}),
        ...(filters.quotationId ? { quotation_id: filters.quotationId } : {}),
      },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(companyId: string, id: string) {
    const coverNote = await this.coverNoteRepository.findOne({
      where: { id, company_id: companyId },
    });

    if (!coverNote) {
      throw new NotFoundException('Cover note not found');
    }

    return coverNote;
  }
}
