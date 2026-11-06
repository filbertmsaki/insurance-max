import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quotation } from '../entities/quotation.entity';
import { QuotationLifecycleService } from './quotation-lifecycle.service';

@Injectable()
export class QuotationOfferExpiryJob {
  private readonly logger = new Logger(QuotationOfferExpiryJob.name);
  constructor(
    @InjectRepository(Quotation)
    private readonly quotations: Repository<Quotation>,
    private readonly lifecycle: QuotationLifecycleService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expireDueOffers(): Promise<void> {
    const now = new Date();
    const due = await this.quotations
      .createQueryBuilder('quotation')
      .select(['quotation.id', 'quotation.company_id'])
      .where('quotation.offer_expires_at <= :now', { now })
      .andWhere('quotation.deleted_at IS NULL')
      .andWhere('quotation.source_policy_transaction_id IS NULL')
      .andWhere('quotation.tira_status = :tira', { tira: 'NOT_SUBMITTED' })
      .andWhere('quotation.status IN (:...statuses)', {
        statuses: ['DRAFT', 'PENDING_REQUIREMENTS', 'READY_FOR_SUBMISSION'],
      })
      .orderBy('quotation.offer_expires_at', 'ASC')
      .addOrderBy('quotation.id', 'ASC')
      .take(100)
      .getMany();
    for (const quotation of due) {
      try {
        await this.lifecycle.expireQuotation(
          quotation.company_id,
          quotation.id,
          {
            source: 'SYSTEM',
            changedByType: 'SYSTEM',
            reason: 'Quotation offer validity elapsed',
          },
          { onlyWhenDue: true },
        );
      } catch (error) {
        this.logger.error(
          `Unable to expire quotation ${quotation.id}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }
}
