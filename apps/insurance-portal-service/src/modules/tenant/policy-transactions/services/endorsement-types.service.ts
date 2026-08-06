import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { EndorsementType } from '../entities/endorsement-type.entity';

export interface UpsertEndorsementTypeInput {
  code: string;
  name: string;
  tira_endorsement_type?: number | null;
  requires_new_cover_note?: boolean;
  is_active?: boolean;
}

/**
 * CRUD over the governed `endorsement_types` lookup table. TIRA
 * endorsement-type numeric codes must always be resolved from here
 * (§13.4/§13.15) rather than hard-coded in application code.
 */
@Injectable()
export class EndorsementTypesService {
  constructor(
    @InjectRepository(EndorsementType)
    private readonly repository: Repository<EndorsementType>,
  ) {}

  findAll(companyId: string, includeInactive = false) {
    return this.repository.find({
      where: includeInactive
        ? { company_id: companyId }
        : { company_id: companyId, is_active: true },
      order: { name: 'ASC' },
    });
  }

  async findByCode(companyId: string, code: string) {
    return this.repository.findOne({
      where: { company_id: companyId, code },
    });
  }

  async requireActive(companyId: string, code: string): Promise<EndorsementType> {
    const type = await this.findByCode(companyId, code);

    if (!type || !type.is_active) {
      throw new NotFoundException(
        `Endorsement type "${code}" is not configured or is inactive.`,
      );
    }

    return type;
  }

  async create(companyId: string, input: UpsertEndorsementTypeInput) {
    const existing = await this.findByCode(companyId, input.code);

    if (existing) {
      throw new ConflictException(
        `Endorsement type "${input.code}" already exists.`,
      );
    }

    return this.repository.save(
      this.repository.create({
        company_id: companyId,
        code: input.code,
        name: input.name,
        tira_endorsement_type: input.tira_endorsement_type ?? null,
        requires_new_cover_note: input.requires_new_cover_note ?? true,
        is_active: input.is_active ?? true,
      }),
    );
  }

  async update(
    companyId: string,
    id: string,
    input: Partial<UpsertEndorsementTypeInput>,
  ) {
    const type = await this.repository.findOne({
      where: { id, company_id: companyId },
    });

    if (!type) {
      throw new NotFoundException('Endorsement type not found.');
    }

    Object.assign(type, {
      name: input.name ?? type.name,
      tira_endorsement_type:
        input.tira_endorsement_type ?? type.tira_endorsement_type,
      requires_new_cover_note:
        input.requires_new_cover_note ?? type.requires_new_cover_note,
      is_active: input.is_active ?? type.is_active,
    });

    return this.repository.save(type);
  }
}
