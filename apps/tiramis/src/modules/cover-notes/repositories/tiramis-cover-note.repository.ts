import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TiramisCoverNoteAddonEntity } from '../entities/tiramis-cover-note-addon.entity';
import { TiramisCoverNoteRiskEntity } from '../entities/tiramis-cover-note-risk.entity';
import { TiramisCoverNoteEntity } from '../entities/tiramis-cover-note.entity';
import { TiramisSubjectMatterEntity } from '../entities/tiramis-subject-matter.entity';

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

  /**
   * Inserts child collections for an already-saved cover note. Re-saving the
   * cover note instead would make TypeORM reload its existing relations
   * concurrently on one connection (deprecated in pg, removed in pg@9).
   */
  async addCollections(
    coverNoteId: string,
    collections: {
      risks: Partial<TiramisCoverNoteRiskEntity>[];
      subjectMatters: Partial<TiramisSubjectMatterEntity>[];
      addons: Partial<TiramisCoverNoteAddonEntity>[];
    },
  ) {
    const manager = this.repository.manager;
    const risks = await manager.save(
      TiramisCoverNoteRiskEntity,
      collections.risks.map((risk) => ({ ...risk, coverNoteId })),
    );
    const subjectMatters = await manager.save(
      TiramisSubjectMatterEntity,
      collections.subjectMatters.map((subject) => ({
        ...subject,
        coverNoteId,
      })),
    );
    const addons = await manager.save(
      TiramisCoverNoteAddonEntity,
      collections.addons.map((addon) => ({ ...addon, coverNoteId })),
    );
    return { risks, subjectMatters, addons };
  }

  /** Targeted column update: save() would reload every cascaded relation. */
  async setCurrentAttempt(id: string, currentAttemptId: string) {
    await this.repository.update(id, { currentAttemptId });
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

  async findSubmittedByInsuranceType(params: {
    insuranceType: 'MOTOR' | 'NON_MOTOR';
    page: number;
    limit: number;
  }) {
    const query = this.repository
      .createQueryBuilder('coverNote')
      .leftJoin('coverNote.transaction', 'transaction')
      .leftJoin('coverNote.currentAttempt', 'currentAttempt')
      .leftJoinAndSelect('coverNote.risks', 'risks')
      .leftJoinAndSelect('risks.discounts', 'riskDiscounts')
      .leftJoinAndSelect('risks.taxes', 'riskTaxes')
      .leftJoinAndSelect('coverNote.subjectMatters', 'subjectMatters')
      .leftJoinAndSelect('coverNote.policyHolders', 'policyHolders')
      .leftJoinAndSelect('coverNote.addons', 'addons')
      .leftJoinAndSelect('addons.taxes', 'addonTaxes')
      .select('coverNote')
      .addSelect([
        'risks',
        'riskDiscounts',
        'riskTaxes',
        'subjectMatters',
        'policyHolders',
        'addons',
        'addonTaxes',
        'transaction.id',
        'transaction.status',
        'transaction.serviceType',
        'transaction.businessReference',
        'transaction.currentRequestId',
        'transaction.successfulRequestId',
        'transaction.totalAttempts',
        'transaction.lastAttemptAt',
        'transaction.successfulAt',
        'transaction.lastError',
        'currentAttempt.id',
        'currentAttempt.requestId',
        'currentAttempt.attemptNo',
        'currentAttempt.status',
        'currentAttempt.sentAt',
        'currentAttempt.acknowledgementStatusCode',
        'currentAttempt.acknowledgementStatusDesc',
        'currentAttempt.responseStatusCode',
        'currentAttempt.responseStatusDesc',
        'currentAttempt.finalResponseReceivedAt',
      ])
      .where('coverNote.insuranceType = :insuranceType', {
        insuranceType: params.insuranceType,
      })
      .andWhere(
        `EXISTS (
          SELECT 1
          FROM tiramis_submission_attempts submittedAttempt
          WHERE submittedAttempt.transaction_id = "coverNote"."transaction_id"
            AND submittedAttempt.sent_at IS NOT NULL
        )`,
      )
      .orderBy('coverNote.createdAt', 'DESC')
      .skip((params.page - 1) * params.limit)
      .take(params.limit);

    const [items, total] = await query.getManyAndCount();

    return {
      items,
      meta: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    };
  }
}
